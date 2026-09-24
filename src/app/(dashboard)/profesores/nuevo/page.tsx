import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import NuevoProfesorForm from "@/components/NuevoProfesorForm";

export default async function NuevoProfesorPage() {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador", "gerente"]);

  const supabase = crearClienteServidor();
  const [{ data: campus }, { data: ramas }] = await Promise.all([
    supabase.from("campus").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("ramas").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  return (
    <div className="max-w-md">
      <a href="/profesores" className="text-sm font-medium text-rewa-azul hover:underline mb-3 inline-block">
        ← Volver a profesores
      </a>
      <h1 className="text-xl font-bold text-rewa-azul mb-6">Nuevo profesor</h1>
      <NuevoProfesorForm campus={campus ?? []} ramas={ramas ?? []} />
    </div>
  );
}
