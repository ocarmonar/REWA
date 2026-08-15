"use client";

import Papa from "papaparse";

export default function ExportarCsvBoton({
  filas,
  nombreArchivo,
}: {
  filas: Record<string, unknown>[];
  nombreArchivo: string;
}) {
  function exportar() {
    const csv = Papa.unparse(filas);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={exportar} className="bg-white border border-gray-300 text-sm px-4 py-2 rounded-md font-medium">
      Exportar CSV
    </button>
  );
}
