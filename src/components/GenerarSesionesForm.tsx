"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generarSesiones } from "@/app/actions/horarios";

// Suma días a una fecha "AAAA-MM-DD" sin pasar por Date, para no arrastrar
// desfases de zona horaria (el navegador del usuario puede no estar en Ecuador).
function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

export default function GenerarSesionesForm({
  hoy,
  sesionesFuturas,
  puedeGenerar,
}: {
  // "Hoy" llega calculado desde el servidor en hora de Ecuador: si se calculara
  // aquí, el servidor (UTC) y el navegador podrían renderizar fechas distintas.
  hoy: string;
  sesionesFuturas: number;
  puedeGenerar: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(sumarDias(hoy, 30));
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generar() {
    setMensaje(null);
    setError(null);
    startTransition(async () => {
      try {
        const creadas = await generarSesiones(desde, hasta);
        setMensaje(
          creadas === 0
            ? "No había sesiones nuevas que crear: ese rango ya estaba cubierto."
            : `Se crearon ${creadas} sesión${creadas === 1 ? "" : "es"} nueva${creadas === 1 ? "" : "s"}.`
        );
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
      <h2 className="font-semibold mb-1">Sesiones programadas</h2>
      <p className="text-sm text-gray-500 mb-4">
        {sesionesFuturas === 0
          ? "No hay ninguna sesión creada de hoy en adelante: Asistencia va a aparecer vacía hasta que se generen."
          : `Hay ${sesionesFuturas} sesión${sesionesFuturas === 1 ? "" : "es"} creada${sesionesFuturas === 1 ? "" : "s"} de hoy en adelante.`}{" "}
        Todos los días, cerca de las 7:00, se generan solas las de los próximos 30 días; este botón sirve para
        adelantarlas o para crearlas de inmediato después de agregar un horario.
      </p>

      {puedeGenerar && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={generar}
              disabled={isPending}
              className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {isPending ? "Generando..." : "Generar sesiones"}
            </button>
          </div>

          {mensaje && <p className="text-sm text-rewa-verde mt-3">{mensaje}</p>}
          {error && <p className="text-sm text-rewa-rojo mt-3">{error}</p>}
        </>
      )}
    </div>
  );
}
