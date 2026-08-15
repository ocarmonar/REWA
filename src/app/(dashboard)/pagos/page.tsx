import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { requiereRol } from "@/lib/auth";
import { ETIQUETAS_ESTADO_MENSUALIDAD, NOMBRES_MES, estadoEfectivoMensualidad, fechaLocalDeHoy } from "@/lib/utils";
import GenerarMensualidadesForm from "@/components/GenerarMensualidadesForm";
import PagosPorCampus from "@/components/PagosPorCampus";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: { q?: string; mes?: string; anio?: string; estado?: string };
}) {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador", "gerente"]);

  const supabase = crearClienteServidor();
  const [anioHoy, mesHoy] = fechaLocalDeHoy().split("-").map(Number);
  const mes = Number(searchParams.mes) || mesHoy;
  const anio = Number(searchParams.anio) || anioHoy;

  const query = supabase
    .from("mensualidades")
    .select("id, saldo, total_a_pagar, estado, fecha_limite, estudiantes(nombres, apellidos, campus(nombre)), ramas(nombre)")
    .eq("periodo_mes", mes)
    .eq("periodo_anio", anio)
    .order("fecha_creacion", { ascending: false });

  const { data: mensualidadesRaw } = await query;

  let filtradas = (mensualidadesRaw ?? []).map((m: any) => ({
    ...m,
    estado_efectivo: estadoEfectivoMensualidad(m),
  }));

  if (searchParams.estado) {
    filtradas = filtradas.filter((m) => m.estado_efectivo === searchParams.estado);
  }
  if (searchParams.q) {
    filtradas = filtradas.filter((m: any) =>
      `${m.estudiantes?.nombres} ${m.estudiantes?.apellidos}`
        .toLowerCase()
        .includes(searchParams.q!.toLowerCase())
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-rewa-azul">Pagos mensuales</h1>
        {usuario.rol === "administrador" && <GenerarMensualidadesForm mes={mes} anio={anio} />}
      </div>

      <form className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q}
          placeholder="Buscar estudiante..."
          className="border border-gray-300 rounded-md px-3 py-2 text-sm col-span-2"
        />
        <select name="mes" defaultValue={mes} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          {NOMBRES_MES.map((n, i) => (
            <option key={i} value={i + 1}>{n}</option>
          ))}
        </select>
        <input
          type="number"
          name="anio"
          defaultValue={anio}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <select name="estado" defaultValue={searchParams.estado} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(ETIQUETAS_ESTADO_MENSUALIDAD).map(([k, v]) => (
            <option key={k} value={k}>{v.texto}</option>
          ))}
        </select>
        <button className="bg-rewa-azul text-white text-sm px-4 py-2 rounded-md col-span-2 md:col-span-1">
          Filtrar
        </button>
      </form>

      <PagosPorCampus
        filas={filtradas}
        mensajeVacio={`No hay mensualidades para este periodo.${usuario.rol === "administrador" ? " Genera el periodo con el botón de arriba." : ""}`}
      />
    </div>
  );
}
