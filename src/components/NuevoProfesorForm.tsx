"use client";

import { useState, useTransition } from "react";
import { crearProfesor, type ResultadoProfesor } from "@/app/actions/profesores";
import { sugerirContrasena } from "@/lib/utils";
import DatosDeAcceso from "@/components/DatosDeAcceso";

const INPUT = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm";

export default function NuevoProfesorForm({
  campus,
  ramas,
}: {
  campus: { id: string; nombre: string }[];
  ramas: { id: string; nombre: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [campusId, setCampusId] = useState("");
  const [ramaId, setRamaId] = useState("");
  const [darAcceso, setDarAcceso] = useState(true);
  const [password, setPassword] = useState(sugerirContrasena());
  // Mientras nadie la toque, la contraseña sugerida sigue a la rama y el campus
  // elegidos; si la escriben a mano, se respeta lo que escribieron.
  const [editada, setEditada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoProfesor | null>(null);

  function actualizarSugerencia(nuevoRamaId: string, nuevoCampusId: string) {
    if (editada) return;
    const rama = ramas.find((r) => r.id === nuevoRamaId)?.nombre;
    const sede = campus.find((c) => c.id === nuevoCampusId)?.nombre;
    setPassword(sugerirContrasena(rama, sede));
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        setResultado(await crearProfesor(fd));
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  if (resultado) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <p className="font-semibold text-rewa-verde">Profesor registrado.</p>
        {resultado.acceso && <DatosDeAcceso email={resultado.acceso.email} password={resultado.acceso.password} />}
        {resultado.aviso && (
          <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3">{resultado.aviso}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <a href={`/profesores/${resultado.profesorId}`} className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium">
            Ver su ficha →
          </a>
          <a href="/profesores/nuevo" className="bg-white border border-gray-300 px-4 py-2 rounded-md text-sm font-medium">
            Registrar otro profesor
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
        <input name="nombres" required className={INPUT} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
        <input name="apellidos" required className={INPUT} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (opcional)</label>
        <input name="telefono" className={INPUT} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Correo {darAcceso ? "" : "(opcional)"}
        </label>
        <input name="email" type="email" required={darAcceso} className={INPUT} />
      </div>

      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Rama y campus donde trabajará (opcional)</p>
        <div className="grid grid-cols-2 gap-3">
          <select
            name="campus_id"
            value={campusId}
            onChange={(e) => { setCampusId(e.target.value); actualizarSugerencia(ramaId, e.target.value); }}
            className={INPUT}
          >
            <option value="">— Campus —</option>
            {campus.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select
            name="rama_id"
            value={ramaId}
            onChange={(e) => { setRamaId(e.target.value); actualizarSugerencia(e.target.value, campusId); }}
            className={INPUT}
          >
            <option value="">— Rama —</option>
            {ramas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Si trabaja en más grupos, agrégalos después desde su ficha.
        </p>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" name="dar_acceso" checked={darAcceso} onChange={(e) => setDarAcceso(e.target.checked)} />
          Darle acceso a la app
        </label>
        {darAcceso && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              name="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setEditada(true); }}
              required
              minLength={6}
              className={`${INPUT} font-mono`}
            />
            <p className="text-xs text-gray-500 mt-1">
              Se arma sola con la disciplina, el campus y el año. Puedes cambiarla.
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-rewa-rojo">{error}</p>}

      <button type="submit" disabled={isPending} className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
        {isPending ? "Registrando..." : "Registrar profesor"}
      </button>
    </form>
  );
}
