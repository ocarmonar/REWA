"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  registrarPago,
  agregarAjuste,
  anularPago,
  anularAjuste,
} from "@/app/actions/pagos";
import { subirComprobante, obtenerUrlFirmada } from "@/lib/supabase/storage";
import { formatoMoneda, formatoFecha, fechaLocalDeHoy, ETIQUETAS_ESTADO_MENSUALIDAD, NOMBRES_MES } from "@/lib/utils";
import type { AjusteMensualidad, MetodoPago, Pago, RolUsuario, TipoAjuste, ValorTipoAjuste } from "@/lib/types";

const METODOS: MetodoPago[] = ["efectivo", "transferencia", "deposito", "tarjeta", "otro"];

export default function PagoDetalle({
  mensualidad,
  ajustes,
  pagos,
  rolUsuario,
}: {
  mensualidad: any;
  ajustes: AjusteMensualidad[];
  pagos: Pago[];
  rolUsuario: RolUsuario;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [observacionPago, setObservacionPago] = useState("");
  const [archivoComprobante, setArchivoComprobante] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const [tipoAjuste, setTipoAjuste] = useState<TipoAjuste>("descuento");
  const [valorTipoAjuste, setValorTipoAjuste] = useState<ValorTipoAjuste>("porcentaje");
  const [valorAjuste, setValorAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");

  const etiqueta = ETIQUETAS_ESTADO_MENSUALIDAD[mensualidad.estado_efectivo] ?? { texto: mensualidad.estado_efectivo, color: "bg-gray-200" };
  const esExoneradoOAnulado = mensualidad.estado_efectivo === "exonerado" || mensualidad.estado_efectivo === "anulado";

  function enviarPago(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = Number(monto);
    if (montoNum <= 0) return alert("El monto debe ser mayor a 0.");
    if (montoNum > mensualidad.saldo) return alert(`El abono no puede exceder el saldo (${formatoMoneda(mensualidad.saldo)}).`);

    startTransition(async () => {
      try {
        let comprobante = null;
        if (archivoComprobante) {
          setSubiendo(true);
          comprobante = await subirComprobante(archivoComprobante, "pagos");
          setSubiendo(false);
        }
        await registrarPago(mensualidad.id, montoNum, fechaLocalDeHoy(), metodo, referencia, observacionPago, comprobante);
        setMonto(""); setReferencia(""); setObservacionPago(""); setArchivoComprobante(null);
        router.refresh();
      } catch (err: any) {
        setSubiendo(false);
        alert(err.message);
      }
    });
  }

  async function verComprobante(ruta: string) {
    try {
      const url = await obtenerUrlFirmada(ruta);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      alert(err.message);
    }
  }

  function enviarAjuste(e: React.FormEvent) {
    e.preventDefault();
    const valorNum = Number(valorAjuste);
    if (!motivoAjuste.trim()) return alert("El motivo es obligatorio.");
    if (valorTipoAjuste === "porcentaje" && (valorNum <= 0 || valorNum > 100)) return alert("El porcentaje debe estar entre 1 y 100.");

    startTransition(async () => {
      try {
        await agregarAjuste(mensualidad.id, tipoAjuste, valorTipoAjuste, valorNum, motivoAjuste);
        setValorAjuste(""); setMotivoAjuste("");
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  function manejarAnularPago(pagoId: string) {
    const motivo = prompt("Motivo de anulación del pago:");
    if (!motivo) return;
    startTransition(async () => {
      try {
        await anularPago(pagoId, mensualidad.id, motivo);
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  function manejarAnularAjuste(ajusteId: string) {
    if (!confirm("¿Anular este ajuste? El saldo se recalculará automáticamente.")) return;
    startTransition(async () => {
      try {
        await anularAjuste(ajusteId, mensualidad.id);
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-rewa-azul">
          {mensualidad.estudiantes?.apellidos} {mensualidad.estudiantes?.nombres}
        </h1>
        <p className="text-sm text-gray-500">
          {mensualidad.ramas?.nombre} · {NOMBRES_MES[mensualidad.periodo_mes - 1]} {mensualidad.periodo_anio} · Fecha límite: {formatoFecha(mensualidad.fecha_limite)}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${etiqueta.color}`}>{etiqueta.texto}</span>
        </div>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-500">Monto base</dt>
          <dd className="text-right">{formatoMoneda(mensualidad.monto_base)}</dd>
          <dt className="text-gray-500">Descuentos</dt>
          <dd className="text-right text-rewa-ambar">- {formatoMoneda(mensualidad.total_descuentos)}</dd>
          <dt className="text-gray-500">Becas</dt>
          <dd className="text-right text-rewa-ambar">- {formatoMoneda(mensualidad.total_becas)}</dd>
          <dt className="text-gray-500">Exoneraciones</dt>
          <dd className="text-right text-rewa-ambar">- {formatoMoneda(mensualidad.total_exoneraciones)}</dd>
          <dt className="font-semibold border-t pt-2">Total a pagar</dt>
          <dd className="text-right font-semibold border-t pt-2">{formatoMoneda(mensualidad.total_a_pagar)}</dd>
          <dt className="text-gray-500">Total pagado</dt>
          <dd className="text-right text-rewa-verde">{formatoMoneda(mensualidad.total_pagado)}</dd>
          <dt className="font-bold">Saldo</dt>
          <dd className="text-right font-bold">{formatoMoneda(mensualidad.saldo)}</dd>
        </dl>
      </div>

      {!esExoneradoOAnulado && mensualidad.saldo > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h2 className="font-semibold mb-3">Registrar pago</h2>
          <form onSubmit={enviarPago} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Monto</label>
              <input
                type="number" step="0.01" min="0.01" max={mensualidad.saldo}
                value={monto} onChange={(e) => setMonto(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Método</label>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Referencia (opcional)</label>
              <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Observación (opcional)</label>
              <input value={observacionPago} onChange={(e) => setObservacionPago(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Comprobante (opcional, imagen o PDF, máx. 5 MB)</label>
              <input
                type="file" accept="image/*,application/pdf"
                onChange={(e) => setArchivoComprobante(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={isPending} className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                {subiendo ? "Subiendo comprobante..." : "Guardar pago parcial"}
              </button>
              <button
                type="button" disabled={isPending}
                onClick={() => setMonto(String(mensualidad.saldo))}
                className="bg-white border border-gray-300 px-4 py-2 rounded-md text-sm font-medium"
              >
                Usar saldo total
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-3">Historial de pagos</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id} className={`border-t border-gray-100 ${p.estado === "anulado" ? "opacity-50" : ""}`}>
                <td className="py-2">{formatoFecha(p.fecha_pago)}</td>
                <td className="py-2">{p.metodo_pago}</td>
                <td className="py-2">{formatoMoneda(p.monto)}</td>
                <td className="py-2">
                  {p.estado === "anulado" ? `Anulado: ${p.motivo_anulacion}` : (
                    p.comprobante_url && (
                      <button onClick={() => verComprobante(p.comprobante_url!)} className="text-rewa-azul text-xs font-medium hover:underline">
                        Ver comprobante
                      </button>
                    )
                  )}
                </td>
                <td className="py-2 text-right">
                  {p.estado === "activo" && (
                    <button onClick={() => manejarAnularPago(p.id)} className="text-rewa-rojo text-xs font-medium hover:underline">
                      Anular
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {pagos.length === 0 && (
              <tr><td colSpan={5} className="py-3 text-center text-gray-500">Sin pagos registrados.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-3">Descuentos, becas y exoneraciones</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm mb-4">
          <tbody>
            {ajustes.map((a) => (
              <tr key={a.id} className={`border-t border-gray-100 ${a.estado === "anulado" ? "opacity-50" : ""}`}>
                <td className="py-2 capitalize">{a.tipo}</td>
                <td className="py-2">{a.valor_tipo === "porcentaje" ? `${a.valor}%` : formatoMoneda(a.valor)}</td>
                <td className="py-2">{a.motivo}</td>
                <td className="py-2 text-right">
                  {a.estado === "activo" && (
                    <button onClick={() => manejarAnularAjuste(a.id)} className="text-rewa-rojo text-xs font-medium hover:underline">
                      Anular
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {ajustes.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-center text-gray-500">Sin ajustes.</td></tr>
            )}
          </tbody>
        </table>
        </div>

        <form onSubmit={enviarAjuste} className="grid grid-cols-2 gap-3 border-t pt-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select value={tipoAjuste} onChange={(e) => setTipoAjuste(e.target.value as TipoAjuste)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="descuento">Descuento</option>
              <option value="beca">Beca</option>
              <option value="exoneracion">Exoneración</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Valor</label>
            <div className="flex gap-1">
              <select value={valorTipoAjuste} onChange={(e) => setValorTipoAjuste(e.target.value as ValorTipoAjuste)} className="border border-gray-300 rounded-md px-2 py-2 text-sm">
                <option value="porcentaje">%</option>
                <option value="monto">$</option>
              </select>
              <input type="number" step="0.01" min="0" value={valorAjuste} onChange={(e) => setValorAjuste(e.target.value)} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm" required />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Motivo</label>
            <input value={motivoAjuste} onChange={(e) => setMotivoAjuste(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required />
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={isPending} className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
              Aplicar ajuste
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
