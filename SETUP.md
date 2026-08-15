# Puesta en marcha — Club Deportivo REWA

## 1. Requisitos previos

- Node.js 18 o superior y npm
- Una cuenta gratuita en [supabase.com](https://supabase.com)
- (Opcional) [Supabase CLI](https://supabase.com/docs/guides/cli) si prefieres ejecutar el SQL desde la terminal en vez del panel web

## 2. Crear el proyecto en Supabase

1. En [supabase.com](https://supabase.com), crea un proyecto nuevo (región sugerida: la más cercana a Ecuador, p. ej. `us-east-1`).
2. Anota la **Project URL**, la **anon key** y la **service_role key** (Settings → API).

## 3. Cargar el esquema y los datos semilla

En el panel de Supabase: **SQL Editor → New query**.

1. Copia y ejecuta todo el contenido de [`supabase/schema.sql`](supabase/schema.sql).
2. Copia y ejecuta todo el contenido de [`supabase/seed.sql`](supabase/seed.sql).

Esto crea las tablas, triggers, vistas, políticas RLS, y carga 3 campus, 4 ramas, 15 profesores, 60 estudiantes, horarios, sesiones con asistencia, y mensualidades/pagos de ejemplo. `schema.sql` también crea el bucket privado `documentos-rewa` en Supabase Storage (para comprobantes de pago) con sus políticas — no requiere ningún paso manual adicional en el panel de Supabase.

## 4. Crear los usuarios de autenticación (paso obligatorio)

`seed.sql` crea las **filas de negocio** en la tabla `usuarios` (nombres, rol, email), pero **no crea usuarios reales de Supabase Auth** — son sistemas separados a propósito. Sin este paso nadie puede iniciar sesión.

1. Ve a **Authentication → Users → Add user** y crea, con la opción "Auto confirm user" activada, estos 4 usuarios (o los que necesites) con una contraseña temporal:
   - `admin1@rewa.ec`
   - `gerente@rewa.ec`
   - `profe1@rewa.ec` (y los que quieras probar, hasta `profe15@rewa.ec`)
2. Copia el **UUID** que Supabase asigna a cada usuario recién creado.
3. En el **SQL Editor**, vincula cada uno con su fila de negocio:

```sql
update usuarios set auth_user_id = 'UUID-COPIADO-DE-ADMIN1' where email = 'admin1@rewa.ec';
update usuarios set auth_user_id = 'UUID-COPIADO-DE-GERENTE' where email = 'gerente@rewa.ec';
update usuarios set auth_user_id = 'UUID-COPIADO-DE-PROFE1' where email = 'profe1@rewa.ec';
```

En producción, este vínculo lo haría automáticamente la pantalla "Nuevo usuario" del módulo AUTH-03 (Admin gestiona usuarios) usando la Admin API de Supabase con la `service_role key` — no está incluida en el MVP de UI, pero el patrón es: `supabase.auth.admin.createUser()` seguido de un `insert`/`update` en `usuarios` con el `id` devuelto.

## 5. Variables de entorno

```bash
cp .env.example .env.local
```

Completa `.env.local` con los tres valores del paso 2 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

## 6. Instalar y ejecutar en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` — la app redirige a `/login`. Ingresa con uno de los correos vinculados en el paso 4.

## 7. Probar la instalación como PWA

- **Android/Chrome**: menú ⋮ → "Instalar aplicación" o "Agregar a pantalla de inicio".
- **iOS/Safari**: botón compartir → "Agregar a pantalla de inicio".
- **Desktop/Chrome**: ícono de instalación en la barra de direcciones.

Los íconos en `public/icons/` son marcadores de posición (cuadrados sólidos con el azul institucional `#0d3b66`) — reemplázalos por el logo real de REWA en 192×192 y 512×512 antes de mostrarlo a las autoridades.

## 8. Empaquetar y desplegar (hosting gratuito)

**Backend → Supabase** ya queda desplegado desde el paso 2 (base de datos, autenticación y almacenamiento de archivos en un solo lugar, sin infraestructura adicional).

**Frontend (Next.js) → Vercel.** Dos caminos; usa el A si vas a seguir haciendo cambios, el B si solo quieres subir esta versión ya para que la prueben.

### Camino A — con GitHub (recomendado: cada `git push` vuelve a desplegar solo)

```bash
cd mvp
git init
git add .
git commit -m "MVP Club Deportivo REWA"
```

1. Crea un repositorio vacío en [github.com/new](https://github.com/new) y sigue las instrucciones que te da para conectar este repo local (`git remote add origin ...` y `git push`).
2. En [vercel.com](https://vercel.com) → "Add New" → "Project" → importa ese repositorio.
3. En "Environment Variables" agrega las 3 del paso 5 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. Deploy. Vercel entrega HTTPS automático (requisito para que la PWA sea instalable) y una URL pública `https://tu-proyecto.vercel.app`.

### Camino B — sin GitHub, directo desde tu computadora

```bash
cd mvp
npm install -g vercel
vercel login
vercel
```

`vercel` sube la carpeta tal cual está y te pregunta las variables de entorno la primera vez (o pégalas después en el dashboard, igual que en el Camino A). Para volver a publicar un cambio, repite `vercel --prod`.

**Costo estimado para este volumen** (~60 estudiantes, 15 profesores, 3 campus, algunos comprobantes/adjuntos en PDF o foto): el plan gratuito de Supabase (incluye 1 GB de almacenamiento de archivos) y el plan Hobby de Vercel alcanzan sin problema; solo se necesitaría upgrade si el club crece a varios cientos de usuarios concurrentes o acumula miles de comprobantes.
