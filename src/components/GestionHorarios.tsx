"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearHorario, cambiarEstadoHorario } from "@/app/actions/horarios";
import type { DiaSemana, EstadoHorario } from "@/lib/types";

interface HorarioFila {
  id: string;
  dia: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoHorario;
  ramas: { nombre: string } | null;
  campus: { nombre: string } | null;
  profesores: { nombres: string; apellidos: string } | null;
}

const DIAS: { value: DiaSemana; label: string }[] = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sábado" },
  { value: "domingo", label: "Domingo" },
];

const ETIQUETA_DIA: Record<string, string> = Object.fromEntries(DIAS.map((d) => [d.value, d.label]));

export default function GestionHorarios({
  horarios,
  campus,
  ramas,
  profesores,
  puedeEditar,
}: {
  horarios: HorarioFila[];
  campus: { id: string; nombre: string }[];
  ramas: { id: string; nombre: string }[];
  profesores: { id: string; nombres: string; apellidos: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const porCampus = new Map<string, HorarioFila[]>();
  for (const h of horarios) {
    const nombre = h.campus?.nombre ?? "Sin campus";
    if (!porCampus.has(nombre)) porCampus.set(nombre, []);
    porCampus.get(nombre)!.push(h);
  }
  const grupos = [...porCampus.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    startTransition(async () => {
      try {
        await crearHorario(fd);
        form.reset();
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function alternarEstado(h: HorarioFila) {
    const suspender = h.estado === "activo";
    const mensaje = suspender
      ? "¿Suspender este horario? Dejarán de crearse sesiones nuevas para él (las ya creadas se mantienen)."
      : "¿Reactivar este horario? Volverán a crearse sus sesiones.";
    if (!confirm(mensaje)) return;

    setError(null);
    startTransition(async () => {
      try {
        await cambiarEstadoHorario(h.id, suspender);
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <>
      {puedeEditar && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h2 className="font-semibold mb-3">Nuevo horario</h2>
          <form onSubmit={enviar} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Campus</label>
              <select name="campus_id" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                {campus.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rama</label>
              <select name="rama_id" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                {ramas.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Profesor</label>
              <select name="profesor_id" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                {profesores.map((p) => (
                  <option key={p.id} value={p.id}>{p.apellidos} {p.nombres}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Día</label>
              <select name="dia" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                {DIAS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hora inicio</label>
              <input type="time" name="hora_inicio" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hora fin</label>
              <input type="time" name="hora_fin" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>

            <div className="col-span-2 md:col-span-3">
              <button
                type="submit"
                disabled={isPending || ramas.length === 0 || campus.length === 0 || profesores.length === 0}
                className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                Agregar horario
              </button>
              {profesores.length === 0 && (
                <p className="text-sm text-rewa-ambar mt-2">
                  Primero registra al menos un profesor activo.
                </p>
              )}
              {error && <p className="text-sm text-rewa-rojo mt-2">{error}</p>}
            </div>
          </form>
        </div>
      )}

      {grupos.length === 0 ? (
        <p className="text-sm text-gray-500">
          Todavía no hay horarios cargados. Sin horarios no se pueden crear sesiones ni pasar lista.
        </p>
      ) : (
        grupos.map(([nombreCampus, filas]) => (
          <div key={nombreCampus} className="mb-6">
            <h2 className="text-sm font-semibold text-rewa-azul mb-2">{nombreCampus}</h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Día</th>
                    <th className="px-4 py-2">Horario</th>
                    <th className="px-4 py-2">Rama</th>
                    <th className="px-4 py-2">Profesor</th>
                    <th className="px-4 py-2">Estado</th>
                    {puedeEditar && <th className="px-4 py-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((h) => (
                    <tr key={h.id} className={`border-t border-gray-100 ${h.estado === "suspendido" ? "opacity-60" : ""}`}>
                      <td className="px-4 py-2">{ETIQUETA_DIA[h.dia] ?? h.dia}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {h.hora_inicio.slice(0, 5)} - {h.hora_fin.slice(0, 5)}
                      </td>
                      <td className="px-4 py-2">{h.ramas?.nombre}</td>
                      <td className="px-4 py-2">
                        {h.profesores ? `${h.profesores.apellidos} ${h.profesores.nombres}` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            h.estado === "activo" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-800"
                          }`}
                        >
                          {h.estado === "activo" ? "Activo" : "Suspendido"}
                        </span>
                      </td>
                      {puedeEditar && (
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => alternarEstado(h)}
                            disabled={isPending}
                            className="text-rewa-azul text-xs font-medium hover:underline disabled:opacity-50"
                          >
                            {h.estado === "activo" ? "Suspender" : "Reactivar"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </>
  );
}
