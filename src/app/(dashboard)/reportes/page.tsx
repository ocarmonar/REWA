import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import { formatoMoneda, formatoFecha, ETIQUETAS_ESTADO_MENSUALIDAD, NOMBRES_MES } from "@/lib/utils";
import ExportarCsvBoton from "@/components/ExportarCsvBoton";

export default async function ReportesPage() {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador", "gerente"]);

  const supabase = crearClienteServidor();
  const { data: cartera } = await supabase
    .from("v_cartera_pendiente")
    .select("*")
    .order("saldo", { ascending: false });

  const filas = (cartera ?? []).map((c: any) => ({
    Estudiante: `${c.apellidos} ${c.nombres}`,
    Rama: c.rama,
    Periodo: `${NOMBRES_MES[c.periodo_mes - 1]} ${c.periodo_anio}`,
    Saldo: c.saldo,
    "Fecha límite": formatoFecha(c.fecha_limite),
    Estado: c.estado_efectivo,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-rewa-azul">Reporte de cartera pendiente</h1>
        <ExportarCsvBoton filas={filas} nombreArchivo="cartera_pendiente_rewa.csv" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Estudiante</th>
              <th className="px-4 py-2">Rama</th>
              <th className="px-4 py-2">Periodo</th>
              <th className="px-4 py-2">Saldo</th>
              <th className="px-4 py-2">Fecha límite</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(cartera ?? []).map((c: any, i: number) => {
              const etiqueta = ETIQUETAS_ESTADO_MENSUALIDAD[c.estado_efectivo] ?? { texto: c.estado_efectivo, color: "bg-gray-200" };
              return (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2">{c.apellidos} {c.nombres}</td>
                  <td className="px-4 py-2">{c.rama}</td>
                  <td className="px-4 py-2">{NOMBRES_MES[c.periodo_mes - 1]} {c.periodo_anio}</td>
                  <td className="px-4 py-2 font-medium">{formatoMoneda(c.saldo)}</td>
                  <td className="px-4 py-2">{formatoFecha(c.fecha_limite)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${etiqueta.color}`}>{etiqueta.texto}</span>
                  </td>
                </tr>
              );
            })}
            {(!cartera || cartera.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No hay cartera pendiente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
