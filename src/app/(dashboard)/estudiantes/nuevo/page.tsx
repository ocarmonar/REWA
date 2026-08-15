import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import { crearEstudiante } from "@/app/actions/estudiantes";

export default async function NuevoEstudiantePage() {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador"]);

  const supabase = crearClienteServidor();
  const { data: campus } = await supabase.from("campus").select("id, nombre").eq("activo", true);
  const { data: ramas } = await supabase.from("ramas").select("id, nombre").eq("activo", true);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-rewa-azul mb-6">Nuevo estudiante</h1>

      <form action={crearEstudiante} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Nombres" name="nombres" required />
          <Campo label="Apellidos" name="apellidos" required />
          <Campo label="Fecha de nacimiento" name="fecha_nacimiento" type="date" required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campus principal</label>
            <select name="campus_principal_id" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {(campus ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rama (inscripción inicial)</label>
            <select name="rama_id" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">— Ninguna por ahora —</option>
              {(ramas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <Campo label="Curso (opcional)" name="curso" />
        </div>

        <hr />
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Representante" name="representante_nombre" required />
          <Campo label="Teléfono representante" name="representante_telefono" required />
          <Campo label="Correo representante (opcional)" name="representante_email" type="email" />
          <Campo label="Teléfono del estudiante (opcional)" name="contacto_telefono" />
        </div>

        <hr />
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Contacto de emergencia (opcional)" name="contacto_emergencia_nombre" />
          <Campo label="Teléfono de emergencia (opcional)" name="contacto_emergencia_telefono" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones médicas (opcional)</label>
          <textarea name="observaciones_medicas" rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">Visible solo para Administrador y Gerente.</p>
        </div>

        <button type="submit" className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium">
          Registrar estudiante
        </button>
      </form>
    </div>
  );
}

function Campo({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input name={name} type={type} required={required} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
    </div>
  );
}
