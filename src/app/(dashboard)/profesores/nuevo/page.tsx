import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import { crearProfesor } from "@/app/actions/profesores";

export default async function NuevoProfesorPage() {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador", "gerente"]);

  return (
    <div className="max-w-md">
      <a href="/profesores" className="text-sm font-medium text-rewa-azul hover:underline mb-3 inline-block">
        ← Volver a profesores
      </a>
      <h1 className="text-xl font-bold text-rewa-azul mb-6">Nuevo profesor</h1>

      <form action={crearProfesor} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
          <input name="nombres" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
          <input name="apellidos" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (opcional)</label>
          <input name="telefono" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correo (opcional)</label>
          <input name="email" type="email" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <p className="text-xs text-gray-400">
          Esto crea el registro del profesor. El acceso al sistema (usuario y contraseña) se vincula por
          separado desde Supabase — ver SETUP.md.
        </p>
        <button type="submit" className="bg-rewa-azul text-white px-4 py-2 rounded-md text-sm font-medium">
          Registrar profesor
        </button>
      </form>
    </div>
  );
}
