"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarCostoRama } from "@/app/actions/ramas";
import { formatoMoneda } from "@/lib/utils";

export default function CostoRama({ ramaId, montoActual }: { ramaId: string; montoActual: number }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(montoActual));
  const [isPending, startTransition] = useTransition();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const monto = Number(valor);
    if (!(monto >= 0)) {
      alert("El monto debe ser mayor o igual a 0.");
      return;
    }
    startTransition(async () => {
      try {
        await actualizarCostoRama(ramaId, monto);
        setEditando(false);
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  if (!editando) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-semibold">{formatoMoneda(montoActual)}</span>
        <button onClick={() => { setValor(String(montoActual)); setEditando(true); }} className="text-xs font-medium text-rewa-azul hover:underline">
          Editar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="flex items-center gap-2">
      <input
        type="number"
        step="0.01"
        min="0"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        autoFocus
        className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm"
      />
      <button type="submit" disabled={isPending} className="text-xs font-medium bg-rewa-azul text-white px-2 py-1 rounded-md disabled:opacity-50">
        Guardar
      </button>
      <button type="button" disabled={isPending} onClick={() => setEditando(false)} className="text-xs font-medium text-gray-500">
        Cancelar
      </button>
    </form>
  );
}
