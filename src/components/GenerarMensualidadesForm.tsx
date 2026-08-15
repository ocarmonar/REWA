"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { generarMensualidadesDelPeriodo } from "@/app/actions/pagos";

export default function GenerarMensualidadesForm({ mes, anio }: { mes: number; anio: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function generar() {
    startTransition(async () => {
      try {
        const total = await generarMensualidadesDelPeriodo(mes, anio);
        router.refresh();
        alert(`Se generaron mensualidades para el periodo (${total} inscripciones activas revisadas).`);
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  return (
    <button
      onClick={generar}
      disabled={isPending}
      className="bg-rewa-verde text-white text-sm px-4 py-2 rounded-md font-medium disabled:opacity-50"
    >
      {isPending ? "Generando..." : "Generar mensualidades del periodo"}
    </button>
  );
}
