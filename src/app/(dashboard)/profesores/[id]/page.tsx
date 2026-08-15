import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import AsignacionesProfesor from "@/components/AsignacionesProfesor";
import EstadoProfesor from "@/components/EstadoProfesor";

export default async function ProfesorDetallePage({ params }: { params: { id: string } }) {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador", "gerente"]);

  const supabase = crearClienteServidor();

  const { data: profesor } = await supabase
    .from("profesores")
    .select("id, nombres, apellidos, telefono, activo")
    .eq("id", params.id)
    .single();

  if (!profesor) return <p className="text-sm text-gray-500">Profesor no encontrado.</p>;

  const { data: asignaciones } = await supabase
    .from("profesor_rama")
    .select("id, tipo, rama:ramas(nombre), campus:campus(nombre)")
    .eq("profesor_id", params.id)
    .eq("activo", true);

  const { data: campus } = await supabase.from("campus").select("*").eq("activo", true).order("nombre");
  const { data: ramas } = await supabase.from("ramas").select("*").eq("activo", true).order("nombre");

  return (
    <div className="max-w-2xl">
      <a href="/profesores" className="text-sm font-medium text-rewa-azul hover:underline mb-3 inline-block">
        ← Volver a profesores
      </a>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-rewa-azul">
          {profesor.apellidos} {profesor.nombres}
        </h1>
        <EstadoProfesor profesorId={profesor.id} activo={profesor.activo} />
      </div>
      <p className="text-sm text-gray-500 mb-6">{profesor.telefono}</p>

      <AsignacionesProfesor
        profesorId={profesor.id}
        asignaciones={(asignaciones as any) ?? []}
        campus={campus ?? []}
        ramas={ramas ?? []}
      />
    </div>
  );
}
