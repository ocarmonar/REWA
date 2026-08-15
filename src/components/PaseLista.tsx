"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarAsistencia, type RegistroAsistencia } from "@/app/actions/asistencia";
import { ETIQUETAS_ESTADO_ASISTENCIA } from "@/lib/utils";
import type { EstadoAsistencia } from "@/lib/types";

interface Estudiante {
  id: string;
  nombres: string;
  apellidos: string;
  foto_url: string | null;
}

interface AsistenciaExistente {
  estudiante_id: string;
  estado: EstadoAsistencia;
  observacion_individual: string | null;
}

const ESTADOS: EstadoAsistencia[] = ["presente", "falta", "tarde", "justificado", "permiso", "lesionado"];

export default function PaseLista({
  sesionId,
  rama,
  campus,
  horario,
  estudiantes,
  asistenciasExistentes,
  observacionGeneralInicial,
  soloLectura = false,
}: {
  sesionId: string;
  rama: string;
  campus: string;
  horario: string;
  estudiantes: Estudiante[];
  asistenciasExistentes: AsistenciaExistente[];
  observacionGeneralInicial: string;
  soloLectura?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [observacionGeneral, setObservacionGeneral] = useState(observacionGeneralInicial);
  const [guardado, setGuardado] = useState(false);

  const estadoInicial: Record<string, EstadoAsistencia> = {};
  for (const e of estudiantes) estadoInicial[e.id] = "presente";
  for (const a of asistenciasExistentes) estadoInicial[a.estudiante_id] = a.estado;

  const [estados, setEstados] = useState<Record<string, EstadoAsistencia>>(estadoInicial);

  const estudiantesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return estudiantes;
    return estudiantes.filter((e) =>
      `${e.nombres} ${e.apellidos}`.toLowerCase().includes(q)
    );
  }, [busqueda, estudiantes]);

  function marcarTodosPresentes() {
    const nuevo: Record<string, EstadoAsistencia> = {};
    for (const e of estudiantes) nuevo[e.id] = "presente";
    setEstados(nuevo);
  }

  function guardar() {
    const registros: RegistroAsistencia[] = estudiantes.map((e) => ({
      estudiante_id: e.id,
      estado: estados[e.id] ?? "presente",
    }));

    startTransition(async () => {
      try {
        await guardarAsistencia(sesionId, registros, observacionGeneral || null);
        setGuardado(true);
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  return (
    <div className="pb-24">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-rewa-azul">{rama}</h1>
        <p className="text-sm text-gray-500">{campus} · {horario}</p>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar estudiante..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        {!soloLectura && (
          <button
            onClick={marcarTodosPresentes}
            className="whitespace-nowrap text-sm font-medium bg-green-100 text-green-800 px-3 py-2 rounded-md"
          >
            Marcar todos presentes
          </button>
        )}
      </div>

      <div className="space-y-2">
        {estudiantesFiltrados.map((e) => (
          <div key={e.id} className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="font-medium mb-2">{e.apellidos} {e.nombres}</p>
            <div className="flex flex-wrap gap-1.5">
              {ESTADOS.map((estado) => {
                const activo = estados[e.id] === estado;
                const etiqueta = ETIQUETAS_ESTADO_ASISTENCIA[estado];
                return (
                  <button
                    key={estado}
                    disabled={soloLectura}
                    onClick={() => setEstados((prev) => ({ ...prev, [e.id]: estado }))}
                    className={`text-sm font-medium px-3 py-2 rounded-md border disabled:cursor-default ${
                      activo
                        ? `${etiqueta.color} border-transparent`
                        : "bg-white text-gray-500 border-gray-300"
                    }`}
                  >
                    {etiqueta.texto}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {estudiantesFiltrados.length === 0 && (
          <p className="text-sm text-gray-500">Sin resultados.</p>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Observación general (opcional)</label>
        <textarea
          value={observacionGeneral}
          onChange={(e) => setObservacionGeneral(e.target.value)}
          rows={2}
          readOnly={soloLectura}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm read-only:bg-gray-50"
        />
      </div>

      {!soloLectura && (
      <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-white border-t border-gray-200 p-3">
        <button
          onClick={guardar}
          disabled={isPending}
          className="w-full bg-rewa-azul text-white font-semibold py-3 rounded-md disabled:opacity-50"
        >
          {isPending ? "Guardando..." : guardado ? "Guardado ✓ — Guardar de nuevo" : "Guardar asistencia"}
        </button>
      </div>
      )}
    </div>
  );
}
