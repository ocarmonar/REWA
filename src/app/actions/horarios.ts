"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import type { DiaSemana } from "@/lib/types";

export async function crearHorario(formData: FormData) {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador"]);

  const supabase = crearClienteServidor();

  const horaInicio = String(formData.get("hora_inicio") ?? "");
  const horaFin = String(formData.get("hora_fin") ?? "");
  if (horaFin <= horaInicio) {
    throw new Error("La hora de fin debe ser posterior a la de inicio.");
  }

  const { error } = await supabase.from("horarios").insert({
    rama_id: formData.get("rama_id"),
    campus_id: formData.get("campus_id"),
    dia: formData.get("dia") as DiaSemana,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    profesor_id: formData.get("profesor_id"),
  });

  if (error) {
    // unique (rama_id, campus_id, dia, hora_inicio)
    if (error.code === "23505") {
      throw new Error("Ya existe un horario para esa rama, campus, día y hora de inicio.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/horarios");
}

export async function cambiarEstadoHorario(horarioId: string, suspender: boolean) {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador"]);

  const supabase = crearClienteServidor();
  const { error } = await supabase
    .from("horarios")
    .update({ estado: suspender ? "suspendido" : "activo" })
    .eq("id", horarioId);

  if (error) throw new Error(error.message);
  revalidatePath("/horarios");
  revalidatePath("/asistencia");
}

// Crea las sesiones de todos los horarios activos en el rango indicado.
// La lógica vive en la base (fn_generar_sesiones) para que el cron diario y
// esta pantalla generen exactamente lo mismo, en una sola transacción.
export async function generarSesiones(desde: string, hasta: string): Promise<number> {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador"]);

  const supabase = crearClienteServidor();
  const { data, error } = await supabase.rpc("fn_generar_sesiones", {
    p_desde: desde,
    p_hasta: hasta,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/horarios");
  revalidatePath("/asistencia");
  return (data as number) ?? 0;
}
