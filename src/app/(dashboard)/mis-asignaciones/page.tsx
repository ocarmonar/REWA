import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";

export default async function MisAsignacionesPage() {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["profesor"]);

  const supabase = crearClienteServidor();

  const { data: profesor } = await supabase
    .from("profesores")
    .select("id")
    .eq("usuario_id", usuario.id)
    .eq("activo", true)
    .maybeSingle();

  const { data: asignaciones } = await supabase
    .from("profesor_rama")
    .select("id, tipo, rama:ramas(nombre), campus:campus(id, nombre)")
    .eq("profesor_id", profesor?.id ?? "")
    .eq("activo", true);

  const porCampus = new Map<string, { nombre: string; items: any[] }>();
  for (const a of (asignaciones as any[]) ?? []) {
    const campusId = a.campus?.id ?? "sin-campus";
    const nombre = a.campus?.nombre ?? "Sin campus";
    if (!porCampus.has(campusId)) porCampus.set(campusId, { nombre, items: [] });
    porCampus.get(campusId)!.items.push(a);
  }
  const grupos = [...porCampus.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <div>
      <h1 className="text-xl font-bold text-rewa-azul mb-1">Mis asignaciones</h1>
      <p className="text-sm text-gray-500 mb-6">Los campus y deportes donde puedes pasar asistencia</p>

      {grupos.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500">
          Todavía no tienes asignaciones. Contacta a Administración o Gerencia.
        </div>
      )}

      <div className="space-y-3">
        {grupos.map((g) => (
          <div key={g.nombre} className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="font-semibold mb-2">{g.nombre}</h2>
            <div className="flex flex-wrap gap-2">
              {g.items.map((a) => (
                <span key={a.id} className="text-xs font-medium bg-blue-50 text-rewa-azul px-3 py-1 rounded-full">
                  {a.rama?.nombre} · <span className="capitalize">{a.tipo}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
