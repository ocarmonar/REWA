import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";

export default async function ProfesoresPage() {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador", "gerente"]);

  const supabase = crearClienteServidor();
  const { data: profesores } = await supabase
    .from("profesores")
    .select("id, nombres, apellidos, telefono, activo, profesor_rama(id, activo)")
    .order("apellidos");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-rewa-azul">Profesores</h1>
          <p className="text-sm text-gray-500">{profesores?.length ?? 0} registrados</p>
        </div>
        <Link href="/profesores/nuevo" className="bg-rewa-azul text-white text-sm px-4 py-2 rounded-md font-medium">
          + Nuevo profesor
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Teléfono</th>
              <th className="px-4 py-2">Asignaciones activas</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(profesores ?? []).map((p: any) => {
              const activas = (p.profesor_rama ?? []).filter((pr: any) => pr.activo).length;
              return (
                <tr key={p.id} className={`border-t border-gray-100 ${!p.activo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2">{p.apellidos} {p.nombres}</td>
                  <td className="px-4 py-2">{p.telefono}</td>
                  <td className="px-4 py-2">{activas}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.activo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-800"}`}>
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/profesores/${p.id}`} className="text-rewa-azul font-medium hover:underline">
                      Gestionar →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
