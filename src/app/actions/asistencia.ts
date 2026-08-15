"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoAsistencia } from "@/lib/types";

export interface RegistroAsistencia {
  estudiante_id: string;
  estado: EstadoAsistencia;
  observacion_individual?: string | null;
}

export async function guardarAsistencia(
  sesionId: string,
  registros: RegistroAsistencia[],
  observacionGeneral: string | null
) {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!usuario) throw new Error("Usuario no encontrado");

  // upsert: permite tanto el registro inicial como la corrección posterior (ASI-07)
  const filas = registros.map((r) => ({
    sesion_id: sesionId,
    estudiante_id: r.estudiante_id,
    estado: r.estado,
    observacion_individual: r.observacion_individual || null,
    usuario_registro: usuario.id,
  }));

  const { error: errorAsistencia } = await supabase
    .from("asistencias")
    .upsert(filas, { onConflict: "sesion_id,estudiante_id" });

  if (errorAsistencia) throw new Error(errorAsistencia.message);

  const { error: errorSesion } = await supabase
    .from("sesiones")
    .update({ estado: "registro_completado", observacion_general: observacionGeneral })
    .eq("id", sesionId);

  if (errorSesion) throw new Error(errorSesion.message);

  revalidatePath("/asistencia");
  revalidatePath(`/asistencia/${sesionId}`);
}

export async function cancelarSesion(sesionId: string, motivo: string) {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!usuario) throw new Error("Usuario no encontrado");

  const { error } = await supabase
    .from("sesiones")
    .update({
      estado: "cancelada",
      motivo_cancelacion: motivo,
      usuario_cancelacion: usuario.id,
      fecha_cancelacion: new Date().toISOString(),
    })
    .eq("id", sesionId);

  if (error) throw new Error(error.message);
  revalidatePath("/asistencia");
}
