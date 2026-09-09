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
        const { creadas, revisadas } = await generarMensualidadesDelPeriodo(mes, anio);
        router.refresh();
        // Se informa lo realmente creado, no las inscripciones revisadas: al
        // regenerar un periodo ya generado, repetir el total hacía creer que
        // se habían duplicado las mensualidades.
        alert(
          creadas === 0
            ? `No había mensualidades nuevas que generar: las ${revisadas} inscripciones activas ya tenían la de este periodo.`
            : `Se generaron ${creadas} mensualidad${creadas === 1 ? "" : "es"} nueva${creadas === 1 ? "" : "s"} (de ${revisadas} inscripciones activas revisadas).`
        );
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
