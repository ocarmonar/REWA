"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

const LARGO_MINIMO = 8;

// Última pantalla del flujo "¿Olvidaste tu contraseña?". Se llega desde
// /auth/confirmar, que ya dejó la sesión iniciada con el enlace del correo;
// aquí solo se elige la contraseña nueva.
export default function ActualizarContrasenaPage() {
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < LARGO_MINIMO) {
      setError(`La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`);
      return;
    }
    if (password !== confirmacion) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    try {
      // Creado aquí adentro y no en el cuerpo del componente, por la misma
      // razón que en /login: si no, el build lo ejecutaría al pre-renderizar.
      const supabase = crearClienteNavegador();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(
          error.message.toLowerCase().includes("different")
            ? "La contraseña nueva debe ser distinta de la anterior."
            : "No se pudo cambiar la contraseña. Pide un enlace nuevo e intenta otra vez."
        );
        setGuardando(false);
        return;
      }
      // Recarga completa, como en /login, para que el servidor vea la sesión.
      window.location.href = "/inicio";
    } catch {
      setError("No se pudo cambiar la contraseña. Revisa tu conexión e intenta de nuevo.");
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-rewa-azul px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-rewa.png" alt="Club Deportivo REWA" width={80} height={80} className="mx-auto mb-2" />
          <h1 className="text-xl font-bold text-rewa-azul">Elige tu nueva contraseña</h1>
        </div>

        <form onSubmit={manejarSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rewa-azul"
            />
            <p className="text-xs text-gray-500 mt-1">Al menos {LARGO_MINIMO} caracteres.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Repite la contraseña</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rewa-azul"
            />
          </div>

          {error && <p className="text-sm text-rewa-rojo">{error}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="w-full bg-rewa-azul text-white rounded-md py-2 font-medium hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar y entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
