import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { formatoFecha, fechaLocalDeHoy } from "@/lib/utils";

const ETIQUETA_ESTADO_SESION: Record<string, { texto: string; color: string }> = {
  programada: { texto: "Programada", color: "bg-gray-200 text-gray-800" },
  realizada: { texto: "Realizada", color: "bg-gray-200 text-gray-800" },
  registro_completado: { texto: "Registro completo", color: "bg-green-100 text-green-800" },
  sin_registro: { texto: "Sin registro", color: "bg-red-100 text-red-800" },
  cancelada: { texto: "Cancelada", color: "bg-gray-300 text-gray-600" },
  reprogramada: { texto: "Reprogramada", color: "bg-amber-100 text-amber-800" },
};

export default async function AsistenciaPage({
  searchParams,
}: {
  searchParams: { fecha?: string };
}) {
  const usuario = await obtenerUsuarioActual();
  const supabase = crearClienteServidor();
  const fecha = searchParams.fecha || fechaLocalDeHoy();

  const { data: sesiones } = await supabase
    .from("sesiones")
    .select("id, fecha, hora_inicio, hora_fin, estado, horarios(rama_id, campus_id, ramas(nombre), campus(nombre))")
    .eq("fecha", fecha)
    .order("hora_inicio");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-rewa-azul">Sesiones del día</h1>
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="fecha"
            defaultValue={fecha}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          <button className="bg-rewa-azul text-white text-sm px-3 py-1.5 rounded-md">Ver</button>
        </form>
      </div>

      <p className="text-sm text-gray-500 mb-4">{formatoFecha(fecha)}</p>

      {(() => {
        const porCampus = new Map<string, { nombre: string; sesiones: any[] }>();
        for (const s of sesiones ?? []) {
          const campusId = (s as any).horarios?.campus_id ?? "sin-campus";
          const campusNombre = (s as any).horarios?.campus?.nombre ?? "Sin campus";
          if (!porCampus.has(campusId)) porCampus.set(campusId, { nombre: campusNombre, sesiones: [] });
          porCampus.get(campusId)!.sesiones.push(s);
        }
        const grupos = [...porCampus.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

        if (grupos.length === 0) {
          return <p className="text-gray-500 text-sm">No hay sesiones programadas para esta fecha.</p>;
        }

        return grupos.map((grupo) => (
          <div key={grupo.nombre} className="mb-6">
            <h2 className="text-sm font-semibold text-rewa-azul mb-2">{grupo.nombre}</h2>
            <div className="space-y-3">
              {grupo.sesiones.map((s: any) => {
                const etiqueta = ETIQUETA_ESTADO_SESION[s.estado] ?? { texto: s.estado, color: "bg-gray-200" };
                const puedeRegistrar = usuario.rol !== "gerente" && s.estado !== "cancelada";
                const puedeVer = usuario.rol === "gerente" && s.estado !== "cancelada";
                return (
                  <div
                    key={s.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold">{s.horarios?.ramas?.nombre}</p>
                      <p className="text-sm text-gray-500">
                        {s.hora_inicio.slice(0, 5)} - {s.hora_fin.slice(0, 5)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${etiqueta.color}`}>
                        {etiqueta.texto}
                      </span>
                      {puedeRegistrar ? (
                        <Link
                          href={`/asistencia/${s.id}`}
                          className="text-sm font-medium text-rewa-azul hover:underline"
                        >
                          Pasar lista →
                        </Link>
                      ) : null}
                      {puedeVer ? (
                        <Link
                          href={`/asistencia/${s.id}`}
                          className="text-sm font-medium text-rewa-azul hover:underline"
                        >
                          Ver →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ));
      })()}
    </div>
  );
}
