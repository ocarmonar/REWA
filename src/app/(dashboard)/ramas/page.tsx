import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import CostoRama from "@/components/CostoRama";

export default async function RamasPage() {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador", "gerente"]);

  const supabase = crearClienteServidor();
  const { data: ramas } = await supabase.from("ramas").select("*").order("nombre");

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-rewa-azul mb-1">Ramas y costos</h1>
      <p className="text-sm text-gray-500 mb-6">
        El costo se aplica a las mensualidades que se generen de ahora en adelante; no modifica las ya generadas.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Rama</th>
              <th className="px-4 py-2">Costo mensual</th>
            </tr>
          </thead>
          <tbody>
            {(ramas ?? []).map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{r.nombre}</td>
                <td className="px-4 py-2">
                  <CostoRama ramaId={r.id} montoActual={r.monto_mensual_base} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
