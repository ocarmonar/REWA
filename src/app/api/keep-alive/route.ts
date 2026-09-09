import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Sin esto, Next.js podría cachear la respuesta de este GET desde el build
// y nunca volver a ejecutar la consulta real en cada llamada del cron.
export const dynamic = "force-dynamic";

// Vercel Cron llama a esta ruta una vez al día (ver vercel.json) solo para
// hacer una consulta mínima a la base. Los proyectos gratuitos de Supabase
// se "pausan" tras ~7 días sin ninguna petición a la API, y la primera
// consulta después de eso tarda varios segundos en "despertar" la base
// (el usuario lo notó como ~15s para abrir la app tras días sin usarla).
// Con un ping diario, el proyecto nunca llega a esos 7 días de inactividad.
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await supabase.from("usuarios").select("id").limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, hora: new Date().toISOString() });
}
