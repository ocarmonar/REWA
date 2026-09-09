import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Tiempo máximo que el middleware espera a Supabase Auth antes de dejar
// pasar la petición sin bloquearla. En redes celulares lentas/inestables,
// esperar indefinidamente aquí agotaba el límite de ejecución del Edge
// Middleware de Vercel y el usuario veía un 504 MIDDLEWARE_INVOCATION_TIMEOUT
// en vez de la app. Si se agota este tiempo, se deja pasar la petición: la
// página (obtenerUsuarioActual, corriendo como función normal con mucho más
// margen) y las políticas RLS de la base siguen protegiendo el acceso real.
const TIMEOUT_MS = 5000;
const SE_AGOTO_EL_TIEMPO = Symbol("timeout");

function conTimeout<T>(promesa: Promise<T>): Promise<T | typeof SE_AGOTO_EL_TIEMPO> {
  return Promise.race([
    promesa,
    new Promise<typeof SE_AGOTO_EL_TIEMPO>((resolve) =>
      setTimeout(() => resolve(SE_AGOTO_EL_TIEMPO), TIMEOUT_MS)
    ),
  ]);
}

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

  const resultado = await conTimeout(
    supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  );

  if (resultado === SE_AGOTO_EL_TIEMPO) {
    // No se pudo confirmar la sesión a tiempo (red lenta/inestable, típico
    // en celular): no sabemos si el usuario está o no logueado, así que se
    // deja pasar la petición sin redirigir en vez de asumir que no hay
    // sesión. La página real y las políticas RLS siguen protegiendo el acceso.
    return response;
  }

  const user = resultado.data.user;

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

  // Nota: el bloqueo de /pagos para profesores (RN-01) ya no se valida aquí.
  // Duplicaba una consulta a la tabla usuarios en cada petición a /pagos/*,
  // lo que sumaba otro viaje de red al Edge Middleware (agravando el mismo
  // timeout en conexiones lentas) para reforzar algo que ya está garantizado
  // en dos capas propias: las páginas de /pagos llaman a requiereRol() del
  // lado del servidor, y las políticas RLS de Supabase igual le niegan esos
  // datos a un profesor aunque llegara a ver la pantalla.

  return response;
}

export const config = {
  // Excluye también /api (rutas propias, como el ping de Vercel Cron que no
  // manda sesión y no debe rebotar a /login) y cualquier archivo estático
  // por extensión (imágenes, etc.): sin esto, una petición a un archivo
  // público sin sesión activa (p. ej. /logo-rewa.png en la propia pantalla
  // de login) quedaba redirigida a /login en vez de servirse, mostrando un
  // ícono roto.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
