"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
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

export async function crearProfesor(formData: FormData) {
  await usuarioGestionActual();
  const supabase = crearClienteServidor();

  const { error } = await supabase.from("profesores").insert({
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    telefono: formData.get("telefono") || null,
    email: formData.get("email") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/profesores");
  redirect("/profesores");
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
