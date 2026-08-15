import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import PaseLista from "@/components/PaseLista";

export default async function SesionPage({ params }: { params: { id: string } }) {
  const usuario = await obtenerUsuarioActual();
  const supabase = crearClienteServidor();

  const { data: sesion } = await supabase
    .from("sesiones")
    .select(
      "id, fecha, hora_inicio, hora_fin, estado, observacion_general, horarios(rama_id, campus_id, ramas(nombre), campus(nombre))"
    )
    .eq("id", params.id)
    .single();

  if (!sesion) {
    return <p className="text-sm text-gray-500">Sesión no encontrada.</p>;
  }

  const horario = sesion.horarios as any;

  if (usuario.rol === "profesor") {
    const { data: profesor } = await supabase
      .from("profesores")
      .select("id")
      .eq("usuario_id", usuario.id)
      .eq("activo", true)
      .maybeSingle();

    const { data: asignacion } = await supabase
      .from("profesor_rama")
      .select("id")
      .eq("profesor_id", profesor?.id ?? "")
      .eq("rama_id", horario.rama_id)
      .eq("campus_id", horario.campus_id)
      .eq("activo", true)
      .maybeSingle();

    if (!asignacion) {
      return <p className="text-sm text-gray-500">No tienes asignación para esta rama y campus.</p>;
    }
  }

  const { data: inscritos } = await supabase
    .from("estudiante_rama")
    .select("estudiante_id, estudiantes(id, nombres, apellidos, foto_url)")
    .eq("rama_id", horario.rama_id)
    .eq("campus_id", horario.campus_id)
    .eq("estado", "activo");

  const { data: asistenciasExistentes } = await supabase
    .from("asistencias")
    .select("estudiante_id, estado, observacion_individual")
    .eq("sesion_id", params.id);

  const estudiantes = (inscritos ?? [])
    .map((i: any) => i.estudiantes)
    .filter(Boolean)
    .sort((a: any, b: any) => a.apellidos.localeCompare(b.apellidos));

  return (
    <PaseLista
      sesionId={sesion.id}
      rama={horario.ramas?.nombre ?? ""}
      campus={horario.campus?.nombre ?? ""}
      horario={`${sesion.hora_inicio.slice(0, 5)} - ${sesion.hora_fin.slice(0, 5)}`}
      estudiantes={estudiantes}
      asistenciasExistentes={asistenciasExistentes ?? []}
      observacionGeneralInicial={sesion.observacion_general ?? ""}
      soloLectura={usuario.rol === "gerente" || sesion.estado === "cancelada"}
    />
  );
}
