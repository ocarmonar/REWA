import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la sesión de Supabase en cada request y protege rutas por rol.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rutaPublica = request.nextUrl.pathname === "/login";

  if (!user && !rutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && rutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    return NextResponse.redirect(url);
  }

  // Bloqueo de rutas de pagos para profesores (RN-01), reforzado también en la UI.
  if (user && request.nextUrl.pathname.startsWith("/pagos")) {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("auth_user_id", user.id)
      .single();

    if (usuario?.rol === "profesor") {
      const url = request.nextUrl.clone();
      url.pathname = "/inicio";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // Excluye también cualquier archivo estático por extensión (imágenes, etc.):
  // sin esto, una petición a un archivo público sin sesión activa (p. ej.
  // /logo-rewa.png en la propia pantalla de login) quedaba redirigida a
  // /login en vez de servirse, mostrando un ícono roto.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
