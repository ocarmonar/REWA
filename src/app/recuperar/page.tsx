"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // /auth/confirmar devuelve aquí con ?error=enlace cuando el enlace del correo
  // no sirvió. Se lee de window.location y no con useSearchParams, que en
  // Next 14 exige envolver la página en <Suspense> para poder compilarla.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "enlace") {
      setError(
        "El enlace venció, ya se usó o se abrió en otro navegador. Pide uno nuevo y ábrelo en este mismo dispositivo."
      );
    }
  }, []);

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const supabase = crearClienteNavegador();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirmar`,
      });

      // Antes el error se ignoraba y siempre se mostraba "enviado", aunque el
      // correo nunca saliera (p. ej. por el límite de envíos de Supabase).
      // Supabase no da error si el correo no está registrado, así que esto no
      // revela qué correos existen.
      if (error) {
        setError(
          error.status === 429 || error.message.toLowerCase().includes("rate limit")
            ? "Se pidieron demasiados correos en poco tiempo. Espera una hora e intenta de nuevo."
            : "No se pudo enviar el correo. Intenta de nuevo en unos minutos."
        );
        setEnviando(false);
        return;
      }
      setEnviado(true);
    } catch {
      setError("No se pudo enviar el correo. Revisa tu conexión e intenta de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-rewa-azul px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-8">
        <h1 className="text-xl font-bold text-rewa-azul mb-4">Recuperar contraseña</h1>
        {enviado ? (
          <p className="text-sm text-gray-700">
            Si el correo está registrado, te llegará un enlace para elegir una contraseña nueva. Revisa
            también la carpeta de spam.
          </p>
        ) : (
          <form onSubmit={manejarSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">Escribe tu correo y te enviaremos un enlace.</p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@rewa.ec"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rewa-azul"
            />
            {error && <p className="text-sm text-rewa-rojo">{error}</p>}
            <button
              disabled={enviando}
              className="w-full bg-rewa-azul text-white rounded-md py-2 font-medium hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}
        <p className="text-center text-sm mt-4">
          <a href="/login" className="text-rewa-azul hover:underline">Volver a ingresar</a>
        </p>
      </div>
    </div>
  );
}
