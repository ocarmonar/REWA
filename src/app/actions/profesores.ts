"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import type { TipoAsignacionProfesor } from "@/lib/types";

async function usuarioGestionActual() {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, rol")
    .eq("auth_user_id", user.id)
    .single();

  if (!usuario || (usuario.rol !== "administrador" && usuario.rol !== "gerente")) {
    throw new Error("No tiene permisos para gestionar profesores.");
  }
  return { supabase, usuario };
}

// Mínimo que exige Supabase Auth por defecto.
const LARGO_MINIMO_CONTRASENA = 6;

function validarContrasena(password: string) {
  if (password.length < LARGO_MINIMO_CONTRASENA) {
    throw new Error(`La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`);
  }
}

function mensajeErrorAuth(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("already") || m.includes("exists")) return "Ya existe un usuario con ese correo.";
  if (m.includes("password")) return `Supabase rechazó la contraseña: ${mensaje}`;
  return mensaje;
}

// Crea el usuario de Supabase Auth (con la llave de servicio, así que no hace
// falta entrar al panel de Supabase), su fila en "usuarios" con rol profesor, y
// lo vincula al profesor. Si un paso falla, deshace los anteriores para no
// dejar un usuario a medias que después bloquee ese correo.
async function crearAccesoProfesor(
  supabase: ReturnType<typeof crearClienteServidor>,
  profesorId: string,
  nombres: string,
  apellidos: string,
  email: string,
  password: string
) {
  const admin = crearClienteAdmin();

  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (errorAuth || !creado.user) throw new Error(mensajeErrorAuth(errorAuth?.message ?? "No se pudo crear el usuario."));

  // "usuarios" solo lo escribe el administrador según RLS; el gerente también
  // puede dar acceso a profesores, por eso esta fila va con la llave de servicio.
  const { data: fila, error: errorUsuario } = await admin
    .from("usuarios")
    .insert({ auth_user_id: creado.user.id, nombres, apellidos, email, rol: "profesor" })
    .select("id")
    .single();
  if (errorUsuario || !fila) {
    await admin.auth.admin.deleteUser(creado.user.id);
    throw new Error(errorUsuario?.code === "23505" ? "Ya existe un usuario con ese correo." : errorUsuario?.message ?? "No se pudo crear el usuario.");
  }

  // El vínculo va con la sesión de quien da el acceso, para que la auditoría
  // de profesores registre quién lo hizo.
  const { error: errorVinculo } = await supabase
    .from("profesores")
    .update({ usuario_id: fila.id, email })
    .eq("id", profesorId);
  if (errorVinculo) {
    await admin.from("usuarios").delete().eq("id", fila.id);
    await admin.auth.admin.deleteUser(creado.user.id);
    throw new Error(errorVinculo.message);
  }
}

export interface ResultadoProfesor {
  profesorId: string;
  acceso: { email: string; password: string } | null;
  aviso: string | null;
}

// Registro completo en un solo paso: el profesor, opcionalmente su primera
// asignación (rama + campus) y opcionalmente su acceso a la app. Antes el
// acceso se creaba a mano en el panel de Supabase con SQL.
export async function crearProfesor(formData: FormData): Promise<ResultadoProfesor> {
  const { supabase, usuario } = await usuarioGestionActual();

  const nombres = String(formData.get("nombres") ?? "").trim();
  const apellidos = String(formData.get("apellidos") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const ramaId = String(formData.get("rama_id") ?? "");
  const campusId = String(formData.get("campus_id") ?? "");
  const darleAcceso = formData.get("dar_acceso") === "on";
  const password = String(formData.get("password") ?? "");

  if (!nombres || !apellidos) throw new Error("Nombres y apellidos son obligatorios.");
  if (darleAcceso) {
    if (!email) throw new Error("Para darle acceso a la app hace falta su correo.");
    validarContrasena(password);
    // Se revisa antes de crear nada, para no dejar un profesor registrado sin
    // acceso por el error más común (un correo que ya se usa).
    const { data: yaExiste } = await supabase.from("usuarios").select("id").eq("email", email).maybeSingle();
    if (yaExiste) throw new Error("Ya existe un usuario con ese correo.");
  }

  const { data: profesor, error } = await supabase
    .from("profesores")
    .insert({ nombres, apellidos, telefono, email })
    .select("id")
    .single();
  if (error || !profesor) throw new Error(error?.message ?? "No se pudo registrar al profesor.");

  const avisos: string[] = [];

  if (ramaId && campusId) {
    const { error: errorAsignacion } = await supabase.from("profesor_rama").insert({
      profesor_id: profesor.id,
      rama_id: ramaId,
      campus_id: campusId,
      tipo: "principal",
      asignado_por: usuario.id,
    });
    if (errorAsignacion) avisos.push(`No se pudo guardar su asignación (${errorAsignacion.message}); agrégala desde su ficha.`);
  }

  let acceso: ResultadoProfesor["acceso"] = null;
  if (darleAcceso && email) {
    try {
      await crearAccesoProfesor(supabase, profesor.id, nombres, apellidos, email, password);
      acceso = { email, password };
    } catch (e: any) {
      avisos.push(`No se pudo crear su acceso (${e.message}); puedes dárselo desde su ficha.`);
    }
  }

  revalidatePath("/profesores");
  return { profesorId: profesor.id, acceso, aviso: avisos.length ? avisos.join(" ") : null };
}

// Para un profesor ya registrado que todavía no tiene usuario.
export async function darAccesoProfesor(profesorId: string, emailIngresado: string, password: string) {
  const { supabase } = await usuarioGestionActual();
  const email = emailIngresado.trim().toLowerCase();
  if (!email) throw new Error("Escribe el correo del profesor.");
  validarContrasena(password);

  const { data: profesor } = await supabase
    .from("profesores")
    .select("id, nombres, apellidos, usuario_id")
    .eq("id", profesorId)
    .single();
  if (!profesor) throw new Error("Profesor no encontrado.");
  if (profesor.usuario_id) throw new Error("Este profesor ya tiene acceso.");

  const { data: yaExiste } = await supabase.from("usuarios").select("id").eq("email", email).maybeSingle();
  if (yaExiste) throw new Error("Ya existe un usuario con ese correo.");

  await crearAccesoProfesor(supabase, profesorId, profesor.nombres, profesor.apellidos, email, password);
  revalidatePath(`/profesores/${profesorId}`);
  revalidatePath("/profesores");
  return { email, password };
}

// También resuelve "olvidé mi contraseña" para los profesores sin depender
// del correo de recuperación: quien gestiona profesores le pone una nueva.
export async function cambiarContrasenaProfesor(profesorId: string, password: string) {
  const { supabase } = await usuarioGestionActual();
  validarContrasena(password);

  const { data: profesor } = await supabase
    .from("profesores")
    .select("usuario_id, usuarios(auth_user_id, rol, email)")
    .eq("id", profesorId)
    .single();
  const cuenta = (profesor as any)?.usuarios as { auth_user_id: string | null; rol: string; email: string } | null;
  if (!cuenta?.auth_user_id) throw new Error("Este profesor todavía no tiene acceso.");
  // Nunca cambiar por esta vía la contraseña de un administrador o gerente,
  // aunque alguna fila de profesor quedara vinculada a una de esas cuentas.
  if (cuenta.rol !== "profesor") throw new Error("Solo se puede cambiar la contraseña de cuentas de profesor.");

  const { error } = await crearClienteAdmin().auth.admin.updateUserById(cuenta.auth_user_id, { password });
  if (error) throw new Error(mensajeErrorAuth(error.message));
  return { email: cuenta.email, password };
}

export async function cambiarEstadoProfesor(profesorId: string, activo: boolean) {
  const { supabase } = await usuarioGestionActual();

  const { error } = await supabase
    .from("profesores")
    .update({ activo })
    .eq("id", profesorId);

  if (error) throw new Error(error.message);
  revalidatePath("/profesores");
  revalidatePath(`/profesores/${profesorId}`);
}

export async function crearAsignacion(
  profesorId: string,
  ramaId: string,
  campusId: string,
  tipo: TipoAsignacionProfesor
) {
  const { supabase, usuario } = await usuarioGestionActual();

  const { data: existente } = await supabase
    .from("profesor_rama")
    .select("id, activo")
    .eq("profesor_id", profesorId)
    .eq("rama_id", ramaId)
    .eq("campus_id", campusId)
    .eq("tipo", tipo)
    .maybeSingle();

  if (existente) {
    if (existente.activo) throw new Error("Ese profesor ya tiene esa asignación.");
    const { error } = await supabase
      .from("profesor_rama")
      .update({ activo: true, asignado_por: usuario.id, fecha_creacion: new Date().toISOString() })
      .eq("id", existente.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("profesor_rama").insert({
      profesor_id: profesorId,
      rama_id: ramaId,
      campus_id: campusId,
      tipo,
      asignado_por: usuario.id,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/profesores/${profesorId}`);
}

export async function quitarAsignacion(asignacionId: string, profesorId: string) {
  const { supabase } = await usuarioGestionActual();

  const { error } = await supabase
    .from("profesor_rama")
    .update({ activo: false })
    .eq("id", asignacionId);

  if (error) throw new Error(error.message);
  revalidatePath(`/profesores/${profesorId}`);
}

// Tablas que pueden guardar actividad hecha POR la cuenta del profesor. Si
// alguna la referencia, el profesor tiene historial y no se puede borrar.
const REFERENCIAS_A_USUARIO: [tabla: string, columna: string][] = [
  ["asistencias", "usuario_registro"],
  ["asistencias", "usuario_correccion"],
  ["justificaciones", "usuario_id"],
  ["sesiones", "usuario_cancelacion"],
  ["profesor_rama", "asignado_por"],
  ["mensualidades", "creado_por"],
  ["ajustes_mensualidad", "usuario_id"],
  ["pagos", "usuario_registro"],
  ["pagos", "usuario_anulacion"],
  ["importaciones_estudiantes", "usuario_id"],
  ["auditoria", "usuario_id"],
];

// Borrado real, solo para un profesor SIN historial: típicamente uno creado
// por error o de prueba, cuyo correo hay que liberar para registrar a la
// persona de verdad. Con historial se desactiva en vez de borrar: eliminarlo
// dejaría horarios sin responsable y asistencias registradas por "nadie".
// Todas las revisiones van antes del primer borrado, para no dejar nada a
// medias.
export async function eliminarProfesor(profesorId: string) {
  const { usuario } = await usuarioGestionActual();
  const admin = crearClienteAdmin();

  const { data: profesor } = await admin
    .from("profesores")
    .select("id, nombres, apellidos, telefono, email, activo, usuario_id, usuarios(id, auth_user_id, rol)")
    .eq("id", profesorId)
    .maybeSingle();
  if (!profesor) throw new Error("Profesor no encontrado.");

  const cuenta = (profesor as any).usuarios as { id: string; auth_user_id: string | null; rol: string } | null;
  // Nunca borrar por esta vía una cuenta de administrador o gerente.
  if (cuenta && cuenta.rol !== "profesor") {
    throw new Error("Esta ficha está vinculada a una cuenta que no es de profesor; no se puede eliminar desde aquí.");
  }

  async function contar(tabla: string, columna: string, valor: string) {
    const { count, error } = await admin.from(tabla).select("id", { count: "exact", head: true }).eq(columna, valor);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  const horarios = await contar("horarios", "profesor_id", profesorId);
  if (horarios > 0) {
    throw new Error(
      `No se puede eliminar: es responsable de ${horarios} horario${horarios === 1 ? "" : "s"}. Desactívalo en vez de eliminarlo.`
    );
  }
  if (cuenta) {
    for (const [tabla, columna] of REFERENCIAS_A_USUARIO) {
      if ((await contar(tabla, columna, cuenta.id)) > 0) {
        throw new Error("No se puede eliminar: ya tiene actividad registrada en la app (por ejemplo, pasó lista). Desactívalo en vez de eliminarlo.");
      }
    }
  }

  // Con la llave de servicio: la revisión de rol ya se hizo arriba, y así un
  // borrado bloqueado por RLS no pasa en silencio (RLS no da error, solo borra 0 filas).
  const pasos: [string, () => PromiseLike<{ error: { message: string } | null }>][] = [
    ["sus asignaciones", () => admin.from("profesor_rama").delete().eq("profesor_id", profesorId)],
    ["el profesor", () => admin.from("profesores").delete().eq("id", profesorId)],
  ];
  if (cuenta) pasos.push(["su usuario", () => admin.from("usuarios").delete().eq("id", cuenta.id)]);
  for (const [que, paso] of pasos) {
    const { error } = await paso();
    if (error) throw new Error(`No se pudo eliminar ${que}: ${error.message}`);
  }
  if (cuenta?.auth_user_id) {
    const { error } = await admin.auth.admin.deleteUser(cuenta.auth_user_id);
    if (error) throw new Error(`Se eliminó el profesor, pero no su cuenta de acceso: ${error.message}`);
  }

  // El trigger de auditoría de profesores no cubre DELETE: se registra aquí.
  const { usuarios: _cuenta, ...datos } = profesor as any;
  await admin.from("auditoria").insert({
    tabla_afectada: "profesores",
    registro_id: profesorId,
    accion: "eliminar",
    valor_anterior: datos,
    valor_nuevo: null,
    usuario_id: usuario.id,
  });

  revalidatePath("/profesores");
}
