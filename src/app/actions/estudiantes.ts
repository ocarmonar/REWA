"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";

// El alta pasa por fn_guardar_estudiantes (una sola transacción en la base):
// antes se insertaba el estudiante y luego, por separado, su inscripción en la
// rama. Si fallaba la segunda, quedaba un estudiante sin rama —invisible para
// asistencia y para las mensualidades— y el usuario, al reintentar, lo duplicaba.
export async function crearEstudiante(formData: FormData) {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador"]);

  const supabase = crearClienteServidor();

  const { error } = await supabase.rpc("fn_guardar_estudiantes", {
    p_filas: [
      {
        nombres: formData.get("nombres"),
        apellidos: formData.get("apellidos"),
        fecha_nacimiento: formData.get("fecha_nacimiento"),
        campus_principal_id: formData.get("campus_principal_id"),
        rama_id: formData.get("rama_id") || null,
        contacto_telefono: formData.get("contacto_telefono") || null,
        contacto_email: formData.get("contacto_email") || null,
        representante_nombre: formData.get("representante_nombre"),
        representante_telefono: formData.get("representante_telefono"),
        representante_email: formData.get("representante_email") || null,
        curso: formData.get("curso") || null,
        contacto_emergencia_nombre: formData.get("contacto_emergencia_nombre") || null,
        contacto_emergencia_telefono: formData.get("contacto_emergencia_telefono") || null,
        observaciones_medicas: formData.get("observaciones_medicas") || null,
      },
    ],
  });

  if (error) throw new Error(error.message);

  revalidatePath("/estudiantes");
  redirect("/estudiantes");
}

export interface FilaImportacion {
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  campusId: string;
  // Sin rama el estudiante no aparece en ninguna lista de asistencia ni se le
  // genera mensualidad, así que la columna es obligatoria en la plantilla.
  ramaId: string;
  representante_nombre: string;
  representante_telefono: string;
  curso: string | null;
}

export async function importarEstudiantes(nombreArchivo: string, filas: FilaImportacion[]) {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador"]);
  const supabase = crearClienteServidor();

  let creados = 0;
  if (filas.length > 0) {
    // Misma función transaccional que el alta individual: cada estudiante
    // queda creado junto con su inscripción en la rama, o no queda ninguno.
    const { data, error } = await supabase.rpc("fn_guardar_estudiantes", {
      p_filas: filas.map((f) => ({
        nombres: f.nombres,
        apellidos: f.apellidos,
        fecha_nacimiento: f.fecha_nacimiento,
        campus_principal_id: f.campusId,
        rama_id: f.ramaId,
        representante_nombre: f.representante_nombre,
        representante_telefono: f.representante_telefono,
        curso: f.curso || null,
      })),
    });

    if (error) throw new Error(error.message);
    creados = (data as number) ?? 0;
  }

  // Auditoría de la importación (EST-12), aunque no todas las filas del
  // archivo original hayan sido válidas (esas ya se descartaron antes de
  // llegar aquí, en la vista previa).
  await supabase.from("importaciones_estudiantes").insert({
    nombre_archivo: nombreArchivo,
    usuario_id: usuario.id,
    total_filas: filas.length,
    total_creados: creados,
    total_actualizados: 0,
    total_errores: 0,
  });

  revalidatePath("/estudiantes");
  return { creados };
}
