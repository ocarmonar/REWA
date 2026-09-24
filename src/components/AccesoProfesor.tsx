"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarContrasenaProfesor, darAccesoProfesor } from "@/app/actions/profesores";
import DatosDeAcceso from "@/components/DatosDeAcceso";

const INPUT = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm";

export default function AccesoProfesor({
  profesorId,
  correoAcceso,
  correoProfesor,
  sugerencia,
}: {
  profesorId: string;
  correoAcceso: string | null; // null = todavía no tiene usuario para entrar
  correoProfesor: string | null;
  sugerencia: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState(correoProfesor ?? "");
  const [password, setPassword] = useState(sugerencia);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<{ email: string; password: string } | null>(null);
  const tieneAcceso = correoAcceso !== null;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const r = tieneAcceso
          ? await cambiarContrasenaProfesor(profesorId, password)
          : await darAccesoProfesor(profesorId, email, password);
        setDatos(r);
        setAbierto(false);
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
      <h2 className="font-semibold mb-2">Acceso a la app</h2>
      <p className="text-sm text-gray-600 mb-3">
        {tieneAcceso ? (
          <>Entra con el correo <strong>{correoAcceso}</strong>.</>
        ) : (
          "Todavía no tiene usuario para entrar a la app."
        )}
      </p>

      {datos && <div className="mb-3"><DatosDeAcceso email={datos.email} password={datos.password} /></div>}

      {!abierto ? (
        <button
          type="button"
          onClick={() => { setAbierto(true); setDatos(null); setPassword(sugerencia); }}
          className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          {tieneAcceso ? "Cambiar contraseña" : "Dar acceso"}
        </button>
      ) : (
        <form onSubmit={guardar} className="space-y-3">
          {!tieneAcceso && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Correo</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">{tieneAcceso ? "Contraseña nueva" : "Contraseña"}</label>
            <input
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${INPUT} font-mono`}
            />
            <p className="text-xs text-gray-500 mt-1">Sugerida según su rama y campus. Puedes cambiarla.</p>
          </div>
          {error && <p className="text-sm text-rewa-rojo">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
              {isPending ? "Guardando..." : tieneAcceso ? "Guardar contraseña" : "Crear acceso"}
            </button>
            <button type="button" disabled={isPending} onClick={() => { setAbierto(false); setError(null); }} className="bg-white border border-gray-300 px-4 py-2 rounded-md text-sm font-medium">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
