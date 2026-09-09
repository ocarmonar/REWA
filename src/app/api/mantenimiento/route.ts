import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Sin esto, Next.js podría cachear la respuesta de este GET desde el build
// y nunca volver a ejecutar el trabajo real en cada llamada del cron.
export const dynamic = "force-dynamic";

// Tarea diaria que dispara Vercel Cron (ver vercel.json). Hace dos cosas:
//
//  1. Genera las sesiones de los próximos 30 días a partir de los horarios
//     activos y marca como "sin_registro" las sesiones pasadas a las que
//     nadie les pasó lista. Sin esto, Asistencia se queda sin sesiones y el
//     módulo deja de funcionar.
//  2. De paso mantiene despierto el proyecto de Supabase: en el plan gratuito
//     se pausa tras ~7 días sin peticiones, y la primera consulta después de
//     eso tarda varios segundos en responder.
export async function GET(request: NextRequest) {
  // Protección simple: si se configuró CRON_SECRET en Vercel, solo Vercel
  // Cron (que lo envía automáticamente) puede llamar esta ruta.
  const secreto = process.env.CRON_SECRET;
  if (secreto) {
    const autorizacion = request.headers.get("authorization");
    if (autorizacion !== `Bearer ${secreto}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const llaveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Generar sesiones requiere permisos de escritura: con la llave anónima la
  // base rechaza la operación. Si la llave de servicio no está configurada,
  // al menos se hace el ping que evita la pausa por inactividad.
  if (!llaveServicio) {
    const anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await anonimo.from("usuarios").select("id").limit(1);
    return NextResponse.json(
      {
        ok: !error,
        sesiones_creadas: null,
        aviso: "Falta SUPABASE_SERVICE_ROLE_KEY: no se generaron sesiones.",
        error: error?.message ?? null,
      },
      { status: error ? 500 : 200 }
    );
  }

  const supabase = createClient(url, llaveServicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("fn_mantenimiento_sesiones", {
    p_dias_adelante: 30,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sesiones_creadas: data ?? 0,
    hora: new Date().toISOString(),
  });
}
