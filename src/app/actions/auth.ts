"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function cerrarSesion() {
  const supabase = crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
