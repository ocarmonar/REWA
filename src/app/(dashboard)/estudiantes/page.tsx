import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import { formatoFecha } from "@/lib/utils";

const ETIQUETA_ESTADO: Record<string, string> = {
  activo: "bg-green-100 text-green-800",
  inactivo: "bg-gray-200 text-gray-800",
  lesionado: "bg-amber-100 text-amber-800",
  retirado: "bg-red-100 text-red-800",
};

export default async function EstudiantesPage({ searchParams }: { searchParams: { q?: string } }) {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador", "gerente"]);

  const supabase = crearClienteServidor();
  let query = supabase
    .from("estudiantes")
    .select("id, nombres, apellidos, estado, fecha_nacimiento, campus(nombre)")
    .order("apellidos");

  // Los caracteres ',', '(', ')' y '"' tienen significado especial en la sintaxis
  // de filtros de PostgREST (.or()); se eliminan para que un nombre con esos
  // caracteres no rompa la consulta ni permita manipular el filtro.
  const q = (searchParams.q ?? "").replace(/[,()%"]/g, "").trim();
  if (q) {
    query = query.or(`nombres.ilike.%${q}%,apellidos.ilike.%${q}%`);
  }

  const { data: estudiantes } = await query;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-rewa-azul">Estudiantes</h1>
        {usuario.rol === "administrador" && (
          <div className="flex gap-2">
            <Link href="/estudiantes/importar" className="bg-white border border-gray-300 text-sm px-4 py-2 rounded-md font-medium">
              Importar Excel/CSV
            </Link>
            <Link href="/estudiantes/nuevo" className="bg-rewa-azul text-white text-sm px-4 py-2 rounded-md font-medium">
              + Nuevo estudiante
            </Link>
          </div>
        )}
      </div>

      <form className="mb-4">
        <input
          type="text" name="q" defaultValue={searchParams.q}
          placeholder="Buscar por nombre o apellido..."
          className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Campus</th>
              <th className="px-4 py-2">Fecha nacimiento</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(estudiantes ?? []).map((e: any) => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{e.apellidos} {e.nombres}</td>
                <td className="px-4 py-2">{e.campus?.nombre}</td>
                <td className="px-4 py-2">{formatoFecha(e.fecha_nacimiento)}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${ETIQUETA_ESTADO[e.estado]}`}>{e.estado}</span>
                </td>
              </tr>
            ))}
            {(!estudiantes || estudiantes.length === 0) && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
