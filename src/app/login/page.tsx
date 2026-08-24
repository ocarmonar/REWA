"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      // El cliente se crea aquí adentro, no en el cuerpo del componente: si se
      // creara arriba, Next.js lo ejecutaría también al pre-renderizar esta
      // página en el build, y si las variables de entorno de Supabase no están
      // disponibles en ese momento, tumbaría el build entero.
      const supabase = crearClienteNavegador();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        // Temporal: se muestra el mensaje real de Supabase para diagnosticar
        // el problema de acceso. Antes de mostrarlo a usuarios finales, volver
        // al mensaje genérico "Correo o contraseña incorrectos."
        setError(`${error.message} (código: ${error.status ?? "?"})`);
        setCargando(false);
        return;
      }
      // Recarga completa (no router.push del lado del cliente): así la
      // siguiente petición al servidor lleva ya la cookie de sesión recién
      // guardada. Con una navegación "suave" existía una condición de carrera
      // donde el servidor a veces no veía la cookie todavía y rebotaba de
      // vuelta a /login, entrando en un ciclo con el middleware.
      window.location.href = "/inicio";
    } catch (err: any) {
      // Cualquier excepción (p. ej. una URL de Supabase mal formada) se
      // muestra en pantalla en vez de tumbar toda la página.
      setError(`Excepción: ${err?.message ?? String(err)}`);
      setCargando(false);
    }
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

        {/* Temporal, solo para depurar el despliegue: confirma qué URL quedó
            realmente incluida en el sitio. Quitar una vez resuelto. */}
        <p className="text-center text-xs text-gray-400 mt-4 break-all">
          URL configurada: {process.env.NEXT_PUBLIC_SUPABASE_URL || "(vacía)"}
        </p>
      </div>
    </div>
  );
}
