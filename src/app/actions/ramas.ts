"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function actualizarCostoRama(ramaId: string, montoMensualBase: number) {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("auth_user_id", user.id)
    .single();

  if (!usuario || (usuario.rol !== "administrador" && usuario.rol !== "gerente")) {
    throw new Error("No tiene permisos para modificar costos de mensualidad.");
  }

  if (!(montoMensualBase >= 0)) throw new Error("El monto debe ser mayor o igual a 0.");

  const { error } = await supabase
    .from("ramas")
    .update({ monto_mensual_base: montoMensualBase })
    .eq("id", ramaId);

  if (error) throw new Error(error.message); // el trigger bloquea a Gerente si intenta tocar otro campo
  revalidatePath("/ramas");
}
