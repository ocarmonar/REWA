import { createClient } from "@supabase/supabase-js";

// Cliente con la llave de servicio: se salta RLS y puede administrar usuarios
// de Supabase Auth (crearlos, cambiarles la contraseña). Úsalo SOLO en Server
// Actions o rutas del servidor, y siempre DESPUÉS de verificar el rol de quien
// llama. Si por error se importara desde un componente cliente, la variable
// no existe en el navegador (no lleva el prefijo NEXT_PUBLIC_) y esto lanza un
// error en vez de exponer la llave.
export function crearClienteAdmin() {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!llave) {
    throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
