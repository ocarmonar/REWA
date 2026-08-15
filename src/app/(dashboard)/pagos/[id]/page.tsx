import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, requiereRol } from "@/lib/auth";
import { estadoEfectivoMensualidad } from "@/lib/utils";
import PagoDetalle from "@/components/PagoDetalle";

export default async function MensualidadPage({ params }: { params: { id: string } }) {
  const usuario = await obtenerUsuarioActual();
  requiereRol(usuario, ["administrador", "gerente"]);

  const supabase = crearClienteServidor();

  const { data: mensualidadRaw } = await supabase
    .from("mensualidades")
    .select("*, estudiantes(nombres, apellidos), ramas(nombre)")
    .eq("id", params.id)
    .single();

  if (!mensualidadRaw) return <p className="text-sm text-gray-500">Mensualidad no encontrada.</p>;

  const mensualidad = { ...mensualidadRaw, estado_efectivo: estadoEfectivoMensualidad(mensualidadRaw) };

  const { data: ajustes } = await supabase
    .from("ajustes_mensualidad")
    .select("*")
    .eq("mensualidad_id", params.id)
    .order("fecha", { ascending: false });

  const { data: pagos } = await supabase
    .from("pagos")
    .select("*")
    .eq("mensualidad_id", params.id)
    .order("fecha_registro", { ascending: false });

  return (
    <PagoDetalle
      mensualidad={mensualidad as any}
      ajustes={ajustes ?? []}
      pagos={pagos ?? []}
      rolUsuario={usuario.rol}
    />
  );
}
