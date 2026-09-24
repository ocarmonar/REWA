"use client";

import { useState } from "react";

// Los datos que hay que entregarle al profesor, listos para copiar y pegar en
// un WhatsApp o un correo. Se muestran solo en este momento: la app no guarda
// la contraseña en ningún lugar visible.
export default function DatosDeAcceso({ email, password }: { email: string; password: string }) {
  const [copiado, setCopiado] = useState(false);
  const enlace = typeof window !== "undefined" ? window.location.origin : "https://rewa-registro.vercel.app";
  const mensaje = `Tu acceso a la app del Club Deportivo REWA:\nEnlace: ${enlace}\nCorreo: ${email}\nContraseña: ${password}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Algunos navegadores bloquean el portapapeles: los datos siguen a la vista.
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm">
      <p className="font-semibold text-rewa-azul mb-2">Entrégale estos datos al profesor:</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-gray-500">Enlace</dt>
        <dd className="break-all">{enlace}</dd>
        <dt className="text-gray-500">Correo</dt>
        <dd className="break-all">{email}</dd>
        <dt className="text-gray-500">Contraseña</dt>
        <dd className="font-mono font-semibold">{password}</dd>
      </dl>
      <button type="button" onClick={copiar} className="mt-3 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium">
        {copiado ? "Copiado ✓" : "Copiar datos"}
      </button>
    </div>
  );
}
