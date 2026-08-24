import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import ImportarEstudiantes from "@/components/ImportarEstudiantes";

export default async function ImportarEstudiantesPage() {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador"]);

  const supabase = crearClienteServidor();
  const { data: campus } = await supabase.from("campus").select("*").eq("activo", true).order("nombre");
  const { data: existentes } = await supabase.from("estudiantes").select("nombres, apellidos, fecha_nacimiento");

  return (
    <div className="max-w-3xl">
      <a href="/estudiantes" className="text-sm font-medium text-rewa-azul hover:underline mb-3 inline-block">
        ← Volver a estudiantes
      </a>
      <h1 className="text-xl font-bold text-rewa-azul mb-6">Importar estudiantes (Excel/CSV)</h1>
      <ImportarEstudiantes campus={campus ?? []} existentes={existentes ?? []} />
    </div>
  );
}
