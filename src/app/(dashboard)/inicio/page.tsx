import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { formatoMoneda } from "@/lib/utils";
import type { Kpis } from "@/lib/types";

function TarjetaKpi({ titulo, valor, color }: { titulo: string; valor: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? "text-gray-900"}`}>{valor}</p>
    </div>
  );
}

export default async function InicioPage() {
  const usuario = await obtenerUsuarioActual();
  const supabase = crearClienteServidor();

  const esGestion = usuario.rol === "administrador" || usuario.rol === "gerente";

  const { data: kpis } = await supabase.from("v_kpis").select("*").single<Kpis>();

  return (
    <div>
      <h1 className="text-xl font-bold text-rewa-azul mb-1">
        Hola, {usuario.nombres}
      </h1>
      <p className="text-gray-500 mb-6">
        {new Intl.DateTimeFormat("es-EC", { dateStyle: "full", timeZone: "America/Guayaquil" }).format(new Date())}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <TarjetaKpi titulo="Estudiantes activos" valor={String(kpis?.estudiantes_activos ?? 0)} />
        <TarjetaKpi titulo="Profesores activos" valor={String(kpis?.profesores_activos ?? 0)} />
        <TarjetaKpi titulo="Sesiones hoy" valor={String(kpis?.sesiones_hoy ?? 0)} />
        <TarjetaKpi
          titulo="Sesiones sin registro"
          valor={String(kpis?.sesiones_sin_registro_hoy ?? 0)}
          color="text-rewa-ambar"
        />
        {esGestion && (
          <>
            <TarjetaKpi
              titulo="Pagos pendientes"
              valor={formatoMoneda(kpis?.pagos_pendientes_monto ?? 0)}
              color="text-rewa-ambar"
            />
            <TarjetaKpi
              titulo="Pagos vencidos"
              valor={formatoMoneda(kpis?.pagos_vencidos_monto ?? 0)}
              color="text-rewa-rojo"
            />
            <TarjetaKpi
              titulo="Recaudación del mes"
              valor={formatoMoneda(kpis?.recaudacion_mes_actual ?? 0)}
              color="text-rewa-verde"
            />
          </>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <a href="/asistencia" className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium">
          Ir a asistencia de hoy
        </a>
        {esGestion && (
          <a href="/pagos" className="bg-white border border-gray-300 px-4 py-2 rounded-md text-sm font-medium">
            Ir a pagos
          </a>
        )}
      </div>
    </div>
  );
}
