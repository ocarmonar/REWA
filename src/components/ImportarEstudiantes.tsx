"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { importarEstudiantes, type FilaImportacion } from "@/app/actions/estudiantes";
import type { Campus, Rama } from "@/lib/types";

interface FilaValidada extends FilaImportacion {
  campusNombreOriginal: string;
  ramaNombreOriginal: string;
  errores: string[];
  duplicado: boolean;
}

interface EstudianteExistente {
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
}

// "rama" es obligatoria: un estudiante sin disciplina no aparece en ninguna
// lista de asistencia ni se le genera mensualidad, así que importarlo sin ella
// lo dejaba invisible para los dos módulos principales.
const ENCABEZADOS = ["nombres", "apellidos", "fecha_nacimiento", "campus", "rama", "representante_nombre", "representante_telefono", "curso"];

function normalizarFecha(valor: unknown): string {
  if (valor instanceof Date) {
    // Un Date de SheetJS representa una medianoche, pero según el caso en UTC o
    // en hora local; leído con getDate() en Ecuador (UTC-5), una medianoche UTC
    // cae en el día ANTERIOR. Sumar 12 horas y leer en UTC da el día correcto
    // en ambos casos.
    const mediodia = new Date(valor.getTime() + 12 * 60 * 60 * 1000);
    const y = mediodia.getUTCFullYear();
    const m = String(mediodia.getUTCMonth() + 1).padStart(2, "0");
    const d = String(mediodia.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof valor === "number") {
    // Número de serie de Excel: conversión aritmética, sin zonas horarias.
    const parsed = XLSX.SSF.parse_date_code(valor);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const texto = String(valor ?? "").trim();
  // DD/MM/AAAA (o con guiones): el formato habitual en Ecuador, y el que usa
  // Excel en español al guardar como CSV.
  const dma = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dma) return `${dma[3]}-${dma[2].padStart(2, "0")}-${dma[1].padStart(2, "0")}`;
  return texto;
}

// Lee el archivo sin dejar que SheetJS "adivine" tipos, que era la causa de dos
// errores de datos: fechas de nacimiento guardadas un día antes, y acentos y
// eñes convertidos en basura ("FÃºtbol") en los CSV sin BOM, como los que
// exporta Google Sheets.
// - CSV: el texto lo decodificamos nosotros (UTF-8; si no es UTF-8 válido, el
//   Windows-1252 que usa Excel en Windows) y se parsea con raw: todo llega como
//   texto, así que las fechas quedan tal cual se escribieron y los teléfonos
//   conservan su 0 inicial.
// - Excel: las fechas llegan como número de serie (sin cellDates), que
//   normalizarFecha convierte sin pasar por zonas horarias.
async function leerLibro(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".csv")) {
    let texto: string;
    try {
      texto = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      texto = new TextDecoder("windows-1252").decode(buffer);
    }
    return XLSX.read(texto.replace(/^﻿/, ""), { type: "string", raw: true });
  }
  return XLSX.read(buffer, { type: "array" });
}

function validarFila(
  fila: Record<string, unknown>,
  campus: Campus[],
  ramas: Rama[],
  existentes: EstudianteExistente[]
): FilaValidada {
  const nombres = String(fila.nombres ?? "").trim();
  const apellidos = String(fila.apellidos ?? "").trim();
  const fecha_nacimiento = normalizarFecha(fila.fecha_nacimiento);
  const campusNombreOriginal = String(fila.campus ?? "").trim();
  const ramaNombreOriginal = String(fila.rama ?? "").trim();
  const representante_nombre = String(fila.representante_nombre ?? "").trim();
  const representante_telefono = String(fila.representante_telefono ?? "").trim();
  const curso = fila.curso ? String(fila.curso).trim() : null;

  const errores: string[] = [];
  if (!nombres) errores.push("nombres es obligatorio");
  if (!apellidos) errores.push("apellidos es obligatorio");
  // Además del formato se comprueba que la fecha exista (un 30 de febrero
  // pasaría el patrón y haría fallar la importación entera en la base).
  const fechaComoDate = new Date(`${fecha_nacimiento}T00:00:00Z`);
  const fechaValida =
    /^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento) &&
    !isNaN(fechaComoDate.getTime()) &&
    fechaComoDate.toISOString().slice(0, 10) === fecha_nacimiento;
  if (!fechaValida) errores.push("fecha_nacimiento no es válida (use DD/MM/AAAA o AAAA-MM-DD)");
  const campusEncontrado = campus.find((c) => c.nombre.toLowerCase() === campusNombreOriginal.toLowerCase());
  if (!campusEncontrado) errores.push(`campus "${campusNombreOriginal}" no existe`);
  const ramaEncontrada = ramas.find((r) => r.nombre.toLowerCase() === ramaNombreOriginal.toLowerCase());
  if (!ramaEncontrada) errores.push(`rama "${ramaNombreOriginal}" no existe`);
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
    ramaId: ramaEncontrada?.id ?? "",
    ramaNombreOriginal,
    representante_nombre,
    representante_telefono,
    curso,
    errores,
    duplicado,
  };
}

export default function ImportarEstudiantes({
  campus,
  ramas,
  existentes,
}: {
  campus: Campus[];
  ramas: Rama[];
  existentes: EstudianteExistente[];
}) {
  const router = useRouter();
  const [filas, setFilas] = useState<FilaValidada[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  function descargarPlantilla() {
    const encabezado = ENCABEZADOS.join(",");
    const campusEjemplo = campus[0]?.nombre ?? "ISM North";
    const ramaEjemplo = ramas[0]?.nombre ?? "Fútbol";
    const ejemplo = `Juan,Pérez Ríos,2012-05-14,${campusEjemplo},${ramaEjemplo},María Ríos,0991234567,7mo EGB`;
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
    const libro = await leerLibro(file);
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "" });
    setFilas(filasCrudas.map((f) => validarFila(f, campus, ramas, existentes)));
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
        <p className="text-sm text-gray-600 mb-3">
          Las columnas <strong>campus</strong> y <strong>rama</strong> deben escribirse igual que en el sistema.
          Campus: {campus.map((c) => c.nombre).join(", ") || "—"}. Ramas: {ramas.map((r) => r.nombre).join(", ") || "—"}.
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
                  <th className="px-3 py-2">Rama</th>
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
                    <td className="px-3 py-2">{f.ramaNombreOriginal}</td>
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
