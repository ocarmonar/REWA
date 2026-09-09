import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import { fechaLocalDeHoy } from "@/lib/utils";
import GestionHorarios from "@/components/GestionHorarios";
import GenerarSesionesForm from "@/components/GenerarSesionesForm";

export default async function HorariosPage() {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador", "gerente"]);

  const supabase = crearClienteServidor();
  const hoy = fechaLocalDeHoy();

  const [{ data: horarios }, { data: campus }, { data: ramas }, { data: profesores }, { count: sesionesFuturas }] =
    await Promise.all([
      supabase
        .from("horarios")
        .select("id, dia, hora_inicio, hora_fin, estado, ramas(nombre), campus(nombre), profesores(nombres, apellidos)")
        .order("dia")
        .order("hora_inicio"),
      supabase.from("campus").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("ramas").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("profesores").select("id, nombres, apellidos").eq("activo", true).order("apellidos"),
      supabase.from("sesiones").select("id", { count: "exact", head: true }).gte("fecha", hoy),
    ]);

  return (
    <div>
      <h1 className="text-xl font-bold text-rewa-azul mb-1">Horarios y sesiones</h1>
      <p className="text-sm text-gray-500 mb-6">
        Los horarios son la parrilla semanal fija de cada rama. A partir de ellos se crean las sesiones
        de cada día, que son las que aparecen en Asistencia para pasar lista.
      </p>

      <GenerarSesionesForm
        hoy={hoy}
        sesionesFuturas={sesionesFuturas ?? 0}
        puedeGenerar={usuario.rol === "administrador"}
      />

      <GestionHorarios
        horarios={(horarios ?? []) as any}
        campus={campus ?? []}
        ramas={ramas ?? []}
        profesores={profesores ?? []}
        puedeEditar={usuario.rol === "administrador"}
      />
    </div>
  );
}
