"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function RecuperarPage() {
  const supabase = crearClienteNavegador();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/actualizar-contrasena`,
    });
    setEnviado(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-rewa-azul px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-8">
        <h1 className="text-xl font-bold text-rewa-azul mb-4">Recuperar contraseña</h1>
        {enviado ? (
          <p className="text-sm text-gray-700">
            Si el correo existe en el sistema, se envió un enlace para restablecer la contraseña.
          </p>
        ) : (
          <form onSubmit={manejarSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@rewa.ec"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rewa-azul"
            />
            <button className="w-full bg-rewa-azul text-white rounded-md py-2 font-medium hover:opacity-90">
              Enviar enlace
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
