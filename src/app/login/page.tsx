"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = crearClienteNavegador();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setCargando(false);
    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/inicio");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-rewa-azul px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-rewa-azul">Club Deportivo REWA</h1>
          <p className="text-sm text-gray-500 mt-1">Asistencia y pagos mensuales</p>
        </div>

        <form onSubmit={manejarSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rewa-azul"
              placeholder="usuario@rewa.ec"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rewa-azul"
            />
          </div>

          {error && <p className="text-sm text-rewa-rojo">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-rewa-azul text-white rounded-md py-2 font-medium hover:opacity-90 disabled:opacity-50"
          >
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>

          <p className="text-center text-sm">
            <a href="/recuperar" className="text-rewa-azul hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
