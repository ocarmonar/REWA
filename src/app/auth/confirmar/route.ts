import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Solo estos enlaces terminan en "elige tu contraseña": recuperación, e
// invitación (si algún día se invita a un profesor desde Supabase en vez de
// crearle una contraseña temporal).
const TIPOS_PERMITIDOS: EmailOtpType[] = ["recovery", "invite"];

// Destino del enlace del correo "restablecer contraseña". Acepta los dos
// formatos que puede traer ese enlace:
//  - token_hash + type (plantilla de correo personalizada, ver SETUP.md):
//    funciona desde cualquier navegador o dispositivo.
//  - code (plantilla por defecto de Supabase, flujo PKCE): solo funciona si se
//    abre en el mismo navegador donde se pidió el correo, porque la
//    verificación usa un dato que quedó guardado en ese navegador.
// Si el enlace es válido deja la sesión iniciada y lleva a elegir la nueva
// contraseña; si venció, ya se usó o se abrió en otro navegador, vuelve a
// /recuperar con un aviso.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const tipo = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  const supabase = crearClienteServidor();
  let valido = false;

  if (tokenHash && tipo && TIPOS_PERMITIDOS.includes(tipo)) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    valido = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    valido = !error;
  }

  redirect(valido ? "/actualizar-contrasena" : "/recuperar?error=enlace");
}
