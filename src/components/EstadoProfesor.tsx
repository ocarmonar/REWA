"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoProfesor } from "@/app/actions/profesores";

export default function EstadoProfesor({ profesorId, activo }: { profesorId: string; activo: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function alternar() {
    const mensaje = activo
      ? "¿Desactivar a este profesor? No se borra su historial de horarios ni asistencia registrada; solo deja de aparecer como disponible para nuevas asignaciones."
      : "¿Reactivar a este profesor?";
    if (!confirm(mensaje)) return;

    startTransition(async () => {
      try {
        await cambiarEstadoProfesor(profesorId, !activo);
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${activo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-800"}`}>
        {activo ? "Activo" : "Inactivo"}
      </span>
      <button
        onClick={alternar}
        disabled={isPending}
        className={`text-xs font-medium hover:underline disabled:opacity-50 ${activo ? "text-rewa-rojo" : "text-rewa-verde"}`}
      >
        {activo ? "Desactivar" : "Reactivar"}
      </button>
    </div>
  );
}
