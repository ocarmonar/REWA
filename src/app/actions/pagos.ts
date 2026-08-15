"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fechaLocal } from "@/lib/utils";
import type { MetodoPago, TipoAjuste, ValorTipoAjuste } from "@/lib/types";

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
    // RN-01/RN-02/RN-03: el profesor no gestiona pagos. RLS también lo bloquea;
    // este chequeo da un mensaje claro en vez de un error genérico de Postgres.
    throw new Error("No tiene permisos para gestionar pagos.");
  }
  return { supabase, usuario };
}

export async function generarMensualidad(
  estudianteId: string,
  ramaId: string,
  periodoMes: number,
  periodoAnio: number
) {
  const { supabase, usuario } = await usuarioGestionActual();

  const { data: rama } = await supabase
    .from("ramas")
    .select("monto_mensual_base")
    .eq("id", ramaId)
    .single();
  if (!rama) throw new Error("Rama no encontrada");

  const fechaLimite = new Date(periodoAnio, periodoMes, 5); // día 5 del mes siguiente (S4)

  const { error } = await supabase.from("mensualidades").insert({
    estudiante_id: estudianteId,
    rama_id: ramaId,
    periodo_mes: periodoMes,
    periodo_anio: periodoAnio,
    monto_base: rama.monto_mensual_base,
    total_a_pagar: rama.monto_mensual_base,
    saldo: rama.monto_mensual_base,
    fecha_limite: fechaLocal(fechaLimite),
    creado_por: usuario.id,
  });

  if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  revalidatePath("/pagos");
}

export async function generarMensualidadesDelPeriodo(periodoMes: number, periodoAnio: number) {
  const { supabase, usuario } = await usuarioGestionActual();

  const { data: inscripciones } = await supabase
    .from("estudiante_rama")
    .select("estudiante_id, rama_id, estado, estudiantes!inner(estado), ramas(monto_mensual_base)")
    .eq("estado", "activo");

  const activos = (inscripciones ?? []).filter((i: any) => i.estudiantes?.estado === "activo");
  const fechaLimite = fechaLocal(new Date(periodoAnio, periodoMes, 5));

  const filas = activos.map((i: any) => ({
    estudiante_id: i.estudiante_id,
    rama_id: i.rama_id,
    periodo_mes: periodoMes,
    periodo_anio: periodoAnio,
    monto_base: i.ramas.monto_mensual_base,
    total_a_pagar: i.ramas.monto_mensual_base,
    saldo: i.ramas.monto_mensual_base,
    fecha_limite: fechaLimite,
    creado_por: usuario.id,
  }));

  if (filas.length > 0) {
    // ignora duplicados (RN-04: una sola mensualidad por estudiante/rama/periodo)
    await supabase.from("mensualidades").upsert(filas, {
      onConflict: "estudiante_id,rama_id,periodo_mes,periodo_anio",
      ignoreDuplicates: true,
    });
  }

  revalidatePath("/pagos");
  return filas.length;
}

export async function registrarPago(
  mensualidadId: string,
  monto: number,
  fechaPago: string,
  metodoPago: MetodoPago,
  referencia: string,
  observacion: string,
  comprobante?: { url: string; nombre: string } | null
) {
  const { supabase, usuario } = await usuarioGestionActual();

  const { error } = await supabase.from("pagos").insert({
    mensualidad_id: mensualidadId,
    monto,
    fecha_pago: fechaPago,
    metodo_pago: metodoPago,
    referencia: referencia || null,
    observacion: observacion || null,
    comprobante_url: comprobante?.url ?? null,
    comprobante_nombre: comprobante?.nombre ?? null,
    usuario_registro: usuario.id,
  });

  if (error) throw new Error(error.message); // el trigger valida que no exceda el saldo (PAG-11)
  revalidatePath(`/pagos/${mensualidadId}`);
  revalidatePath("/pagos");
}

export async function editarPago(pagoId: string, mensualidadId: string, monto: number, observacion: string) {
  await usuarioGestionActual();
  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("pagos")
    .update({ monto, observacion: observacion || null })
    .eq("id", pagoId);

  if (error) throw new Error(error.message);
  revalidatePath(`/pagos/${mensualidadId}`);
}

export async function anularPago(pagoId: string, mensualidadId: string, motivo: string) {
  const { supabase, usuario } = await usuarioGestionActual();

  const { error } = await supabase
    .from("pagos")
    .update({
      estado: "anulado",
      motivo_anulacion: motivo,
      usuario_anulacion: usuario.id,
      fecha_anulacion: new Date().toISOString(),
    })
    .eq("id", pagoId);

  if (error) throw new Error(error.message);
  revalidatePath(`/pagos/${mensualidadId}`);
}

export async function agregarAjuste(
  mensualidadId: string,
  tipo: TipoAjuste,
  valorTipo: ValorTipoAjuste,
  valor: number,
  motivo: string
) {
  const { supabase, usuario } = await usuarioGestionActual();

  const { error } = await supabase.from("ajustes_mensualidad").insert({
    mensualidad_id: mensualidadId,
    tipo,
    valor_tipo: valorTipo,
    valor,
    motivo,
    usuario_id: usuario.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/pagos/${mensualidadId}`);
}

export async function anularAjuste(ajusteId: string, mensualidadId: string) {
  await usuarioGestionActual();
  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("ajustes_mensualidad")
    .update({ estado: "anulado" })
    .eq("id", ajusteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/pagos/${mensualidadId}`);
}
