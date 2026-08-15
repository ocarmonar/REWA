"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";

export async function crearEstudiante(formData: FormData) {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador"]);

  const supabase = crearClienteServidor();

  const { data: estudiante, error } = await supabase
    .from("estudiantes")
    .insert({
      nombres: formData.get("nombres"),
      apellidos: formData.get("apellidos"),
      fecha_nacimiento: formData.get("fecha_nacimiento"),
      campus_principal_id: formData.get("campus_principal_id"),
      contacto_telefono: formData.get("contacto_telefono") || null,
      contacto_email: formData.get("contacto_email") || null,
      representante_nombre: formData.get("representante_nombre"),
      representante_telefono: formData.get("representante_telefono"),
      representante_email: formData.get("representante_email") || null,
      curso: formData.get("curso") || null,
      contacto_emergencia_nombre: formData.get("contacto_emergencia_nombre") || null,
      contacto_emergencia_telefono: formData.get("contacto_emergencia_telefono") || null,
      observaciones_medicas: formData.get("observaciones_medicas") || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const ramaId = formData.get("rama_id") as string;
  const campusId = formData.get("campus_principal_id") as string;
  if (ramaId) {
    const { error: errorInscripcion } = await supabase.from("estudiante_rama").insert({
      estudiante_id: estudiante.id,
      rama_id: ramaId,
      campus_id: campusId,
    });
    if (errorInscripcion) throw new Error(errorInscripcion.message);
  }

  revalidatePath("/estudiantes");
  redirect("/estudiantes");
}
