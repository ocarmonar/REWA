"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearAsignacion, quitarAsignacion } from "@/app/actions/profesores";
import type { Campus, Rama, TipoAsignacionProfesor } from "@/lib/types";

interface Asignacion {
  id: string;
  tipo: TipoAsignacionProfesor;
  rama: { nombre: string } | null;
  campus: { nombre: string } | null;
}

const TIPOS: { value: TipoAsignacionProfesor; label: string }[] = [
  { value: "principal", label: "Principal" },
  { value: "asistente", label: "Asistente" },
  { value: "suplente", label: "Suplente (rotación)" },
];

export default function AsignacionesProfesor({
  profesorId,
  asignaciones,
  campus,
  ramas,
}: {
  profesorId: string;
  asignaciones: Asignacion[];
  campus: Campus[];
  ramas: Rama[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function enviarNueva(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const campusId = String(fd.get("campus_id"));
    const ramaId = String(fd.get("rama_id"));
    const tipo = fd.get("tipo") as TipoAsignacionProfesor;

    startTransition(async () => {
      try {
        await crearAsignacion(profesorId, ramaId, campusId, tipo);
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  function quitar(asignacionId: string) {
    if (!confirm("¿Quitar esta asignación? El profesor dejará de ver ese campus/rama y de poder pasar asistencia ahí.")) return;
    startTransition(async () => {
      try {
        await quitarAsignacion(asignacionId, profesorId);
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-3">Ramas y campus asignados</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-1">Campus</th>
              <th className="py-1">Rama</th>
              <th className="py-1">Tipo</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {asignaciones.map((a) => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="py-2">{a.campus?.nombre}</td>
                <td className="py-2">{a.rama?.nombre}</td>
                <td className="py-2 capitalize">{a.tipo}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => quitar(a.id)}
                    disabled={isPending}
                    className="text-rewa-rojo text-xs font-medium hover:underline disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {asignaciones.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-center text-gray-500">
                  Sin asignaciones activas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-semibold mb-3">Nueva asignación</h2>
        <form onSubmit={enviarNueva} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Campus</label>
            <select name="campus_id" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {campus.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Rama</label>
            <select name="rama_id" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {ramas.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select name="tipo" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={isPending} className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
              Asignar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
