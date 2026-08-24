"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { importarEstudiantes, type FilaImportacion } from "@/app/actions/estudiantes";
import type { Campus } from "@/lib/types";

interface FilaValidada extends FilaImportacion {
  campusNombreOriginal: string;
  errores: string[];
  duplicado: boolean;
}

interface EstudianteExistente {
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
}

const ENCABEZADOS = ["nombres", "apellidos", "fecha_nacimiento", "campus", "representante_nombre", "representante_telefono", "curso"];

function normalizarFecha(valor: unknown): string {
  if (valor instanceof Date) {
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, "0");
    const d = String(valor.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof valor === "number") {
    const parsed = XLSX.SSF.parse_date_code(valor);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  return String(valor ?? "").trim();
}

function validarFila(fila: Record<string, unknown>, campus: Campus[], existentes: EstudianteExistente[]): FilaValidada {
  const nombres = String(fila.nombres ?? "").trim();
  const apellidos = String(fila.apellidos ?? "").trim();
  const fecha_nacimiento = normalizarFecha(fila.fecha_nacimiento);
  const campusNombreOriginal = String(fila.campus ?? "").trim();
  const representante_nombre = String(fila.representante_nombre ?? "").trim();
  const representante_telefono = String(fila.representante_telefono ?? "").trim();
  const curso = fila.curso ? String(fila.curso).trim() : null;

  const errores: string[] = [];
  if (!nombres) errores.push("nombres es obligatorio");
  if (!apellidos) errores.push("apellidos es obligatorio");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento)) errores.push("fecha_nacimiento debe ser AAAA-MM-DD");
  const campusEncontrado = campus.find((c) => c.nombre.toLowerCase() === campusNombreOriginal.toLowerCase());
  if (!campusEncontrado) errores.push(`campus "${campusNombreOriginal}" no existe`);
  if (!representante_nombre) errores.push("representante_nombre es obligatorio");
  if (!representante_telefono) errores.push("representante_telefono es obligatorio");

  const duplicado =
    errores.length === 0 &&
    existentes.some(
      (e) =>
        e.nombres.toLowerCase() === nombres.toLowerCase() &&
        e.apellidos.toLowerCase() === apellidos.toLowerCase() &&
        e.fecha_nacimiento === fecha_nacimiento
    );

  return {
    nombres,
    apellidos,
    fecha_nacimiento,
    campusId: campusEncontrado?.id ?? "",
    campusNombreOriginal,
    representante_nombre,
    representante_telefono,
    curso,
    errores,
    duplicado,
  };
}

export default function ImportarEstudiantes({
  campus,
  existentes,
}: {
  campus: Campus[];
  existentes: EstudianteExistente[];
}) {
  const router = useRouter();
  const [filas, setFilas] = useState<FilaValidada[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  function descargarPlantilla() {
    const encabezado = ENCABEZADOS.join(",");
    const ejemplo = "Juan,Pérez Ríos,2012-05-14,ISM North,María Ríos,0991234567,7mo EGB";
    const csv = "﻿" + encabezado + "\n" + ejemplo + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_estudiantes_rewa.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function procesarArchivo(file: File) {
    setResultado(null);
    setNombreArchivo(file.name);
    const buffer = await file.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array", cellDates: true });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "" });
    setFilas(filasCrudas.map((f) => validarFila(f, campus, existentes)));
  }

  async function confirmar() {
    if (!filas) return;
    const validas = filas.filter((f) => f.errores.length === 0);
    setProcesando(true);
    try {
      const { creados } = await importarEstudiantes(nombreArchivo, validas);
      const duplicados = validas.filter((f) => f.duplicado).length;
      const errores = filas.length - validas.length;
      setResultado(`Importación completada: ${creados} estudiantes creados (${duplicados} posibles duplicados a revisar), ${errores} filas con errores.`);
      setFilas(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcesando(false);
    }
  }

  const validas = filas?.filter((f) => f.errores.length === 0).length ?? 0;
  const duplicadas = filas?.filter((f) => f.errores.length === 0 && f.duplicado).length ?? 0;
  const conError = filas?.filter((f) => f.errores.length > 0).length ?? 0;

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
        <p className="text-sm text-gray-600 mb-3">
          1. Descarga la plantilla, complétala (Excel o CSV) y súbela. 2. Revisa la vista previa (errores y posibles
          duplicados). 3. Confirma la importación.
        </p>
        <div className="flex gap-3 flex-wrap items-center">
          <button onClick={descargarPlantilla} className="bg-white border border-gray-300 px-4 py-2 rounded-md text-sm font-medium">
            Descargar plantilla CSV
          </button>
          <label className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer">
            Elegir archivo (.xlsx o .csv)
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) procesarArchivo(file);
              }}
            />
          </label>
        </div>
      </div>

      {resultado && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 mb-4 text-sm">{resultado}</div>
      )}

      {filas && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold mb-3">
            Vista previa: {filas.length} filas — {validas} válidas, {duplicadas} posibles duplicados, {conError} con errores
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-2">Nombres</th>
                  <th className="px-3 py-2">Apellidos</th>
                  <th className="px-3 py-2">Nacimiento</th>
                  <th className="px-3 py-2">Campus</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr
                    key={i}
                    className={`border-t border-gray-100 ${f.errores.length > 0 ? "bg-red-50" : f.duplicado ? "bg-amber-50" : ""}`}
                  >
                    <td className="px-3 py-2">{f.nombres}</td>
                    <td className="px-3 py-2">{f.apellidos}</td>
                    <td className="px-3 py-2">{f.fecha_nacimiento}</td>
                    <td className="px-3 py-2">{f.campusNombreOriginal}</td>
                    <td className="px-3 py-2">
                      {f.errores.length > 0 ? f.errores.join("; ") : f.duplicado ? "Posible duplicado" : "OK"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={confirmar}
              disabled={procesando || validas === 0}
              className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {procesando ? "Importando..." : `Confirmar importación (${validas} filas)`}
            </button>
            <button onClick={() => setFilas(null)} disabled={procesando} className="bg-white border border-gray-300 px-4 py-2 rounded-md text-sm font-medium">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
