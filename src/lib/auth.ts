import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Usuario } from "@/lib/types";

export async function obtenerUsuarioActual(): Promise<Usuario> {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!usuario) redirect("/login");
  return usuario as Usuario;
}

export function requiereRol(usuario: Usuario, roles: Usuario["rol"][]) {
  if (!roles.includes(usuario.rol)) {
    redirect("/inicio");
  }
}
