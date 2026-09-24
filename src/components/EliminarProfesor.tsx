"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarProfesor } from "@/app/actions/profesores";

export default function EliminarProfesor({ profesorId, nombre }: { profesorId: string; nombre: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function eliminar() {
    const mensaje =
      `¿Eliminar a ${nombre}?\n\nSe borran su registro, su acceso a la app y sus asignaciones, ` +
      "y su correo queda libre. No se puede deshacer.";
    if (!confirm(mensaje)) return;
    setError(null);
    startTransition(async () => {
      try {
        await eliminarProfesor(profesorId);
        router.push("/profesores");
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="mt-6 bg-white border border-red-200 rounded-lg p-5">
      <h2 className="font-semibold text-rewa-rojo mb-1">Eliminar profesor</h2>
      <p className="text-sm text-gray-600 mb-3">
        Solo para un profesor creado por error o de prueba, que nunca pasó lista ni tiene horarios a su
        cargo. Borra también su acceso y sus asignaciones, y libera su correo. Si el profesor deja el club,
        usa <strong>Desactivar</strong>: así se conserva su historial.
      </p>
      {error && <p className="text-sm text-rewa-rojo mb-3">{error}</p>}
      <button
        type="button"
        onClick={eliminar}
        disabled={isPending}
        className="bg-rewa-rojo text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
      >
        {isPending ? "Eliminando..." : "Eliminar profesor"}
      </button>
    </div>
  );
}
