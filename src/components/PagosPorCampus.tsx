"use client";

import { useState } from "react";
import Link from "next/link";
import { formatoMoneda, ETIQUETAS_ESTADO_MENSUALIDAD } from "@/lib/utils";

interface FilaMensualidad {
  id: string;
  saldo: number;
  total_a_pagar: number;
  estado_efectivo: string;
  estudiantes: { nombres: string; apellidos: string; campus: { nombre: string } | null } | null;
  ramas: { nombre: string } | null;
}

export default function PagosPorCampus({
  filas,
  mensajeVacio,
}: {
  filas: FilaMensualidad[];
  mensajeVacio: string;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const porCampus = new Map<string, { nombre: string; filas: FilaMensualidad[] }>();
  for (const f of filas) {
    const nombre = f.estudiantes?.campus?.nombre ?? "Sin campus";
    if (!porCampus.has(nombre)) porCampus.set(nombre, { nombre, filas: [] });
    porCampus.get(nombre)!.filas.push(f);
  }
  const grupos = [...porCampus.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (grupos.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
        {mensajeVacio}
      </div>
    );
  }

  function toggle(nombre: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {grupos.map((g) => {
        const abierto = abiertos.has(g.nombre);
        const pendientes = g.filas.filter((f) => ["pendiente", "parcial", "vencido"].includes(f.estado_efectivo)).length;
        return (
          <div key={g.nombre} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(g.nombre)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="font-semibold text-rewa-azul">{g.nombre}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-medium bg-blue-50 text-rewa-azul px-2 py-1 rounded-full">
                  {g.filas.length} mensualidad{g.filas.length === 1 ? "" : "es"}
                </span>
                {pendientes > 0 && (
                  <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                    {pendientes} por cobrar
                  </span>
                )}
                <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
              </span>
            </button>
            {abierto && (
              <div className="overflow-x-auto">
              <table className="w-full text-sm border-t border-gray-200">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Estudiante</th>
                    <th className="px-4 py-2">Rama</th>
                    <th className="px-4 py-2">Total</th>
                    <th className="px-4 py-2">Saldo</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {g.filas.map((m) => {
                    const etiqueta = ETIQUETAS_ESTADO_MENSUALIDAD[m.estado_efectivo] ?? { texto: m.estado_efectivo, color: "bg-gray-200" };
                    return (
                      <tr key={m.id} className="border-t border-gray-100">
                        <td className="px-4 py-2">{m.estudiantes?.apellidos} {m.estudiantes?.nombres}</td>
                        <td className="px-4 py-2">{m.ramas?.nombre}</td>
                        <td className="px-4 py-2">{formatoMoneda(m.total_a_pagar)}</td>
                        <td className="px-4 py-2">{formatoMoneda(m.saldo)}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${etiqueta.color}`}>{etiqueta.texto}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link href={`/pagos/${m.id}`} className="text-rewa-azul font-medium hover:underline">
                            Ver →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
