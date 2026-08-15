# Club Deportivo REWA — Sistema de Asistencia y Pagos Mensuales

Sistema para el Club Deportivo REWA (3 campus del ISM en Quito — ISM North, ISM West e ISM Quito — 4 ramas deportivas: Fútbol, Básquetbol, Vóleybol y Natación) que digitaliza el pase de lista y el cobro de mensualidades, hoy llevados manualmente.

## Contenido de este repositorio

| Ruta | Qué es |
|---|---|
| [`supabase/schema.sql`](supabase/schema.sql) | Esquema completo: tablas, enums, triggers de recálculo automático, vistas y políticas RLS por rol |
| [`supabase/seed.sql`](supabase/seed.sql) | Datos de ejemplo: 3 campus, 4 ramas, 15 profesores, 60 estudiantes, horarios, sesiones, asistencias y pagos |
| [`src/`](src) | MVP funcional en Next.js + TypeScript + Tailwind, conectado a Supabase |
| [`SETUP.md`](SETUP.md) | Instrucciones paso a paso para correrlo localmente y propuesta de despliegue |
| [`demo/rewa-demo.html`](demo/rewa-demo.html) | Demo autocontenida (un solo archivo, sin instalación) para mostrar a las autoridades |

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS, con Server Actions para las mutaciones (sin API routes separadas).
- **Backend**: Supabase (PostgreSQL + Auth). La lógica de negocio crítica —recálculo de saldos, validación de que un abono no exceda el saldo, auditoría— vive en triggers de PostgreSQL, no solo en el frontend, para que sea imposible saltársela desde otra vía de acceso a la base.
- **PWA**: `manifest.json` + `sw.js` (service worker con estrategia network-first, pensada para conectividad intermitente en cancha).
- **Importación**: PapaParse (CSV) — ver limitaciones abajo sobre `.xlsx`.

## Decisiones de arquitectura que vale la pena conocer

- **"Vencido" es un estado derivado, no almacenado.** Se calcula en cada lectura (`saldo > 0 AND fecha_limite < hoy`) vía la vista `v_mensualidades` en Supabase y una función equivalente en el frontend. Evita depender de un cron para mantenerlo actualizado.
- **Una mensualidad por estudiante, rama y periodo** (no por estudiante y periodo solamente). Un estudiante en 2 ramas con costos distintos genera 2 mensualidades — ver "Supuestos" más abajo.
- **Auditoría automática vía triggers**, no vía código de aplicación: pagos, ajustes y correcciones de asistencia quedan registrados aunque la escritura no pase por la UI (p. ej. una consulta directa a la base con permisos adecuados).
- **RLS (Row Level Security) como límite real, no solo de UI.** Un profesor no puede leer ni escribir pagos aunque manipule las peticiones directamente — la base de datos lo rechaza.

## Supuestos tomados (documentados también en la revisión inicial de la especificación)

- Zona horaria fija `America/Guayaquil`.
- Fecha límite por defecto: día 5 del mes siguiente al periodo (editable).
- Duplicado en importación = mismo nombres + apellidos + fecha de nacimiento exactos; se marca para revisión, no bloquea la carga.
- El modo demo autocontenido simula autenticación (no verifica contraseña) — el MVP con Supabase sí usa autenticación real.
- Adjuntos de justificaciones/comprobantes de pago: se guarda el nombre de archivo, no el binario, en el MVP de Next.js (Supabase Storage está previsto pero no conectado); en la demo HTML tampoco hay almacenamiento real de archivos.

## Alcance de esta entrega vs. pendiente de UI

El esquema SQL y las políticas RLS **ya cubren el sistema completo** de la especificación. La UI en Next.js implementa a fondo los módulos de mayor complejidad y riesgo (asistencia y pagos), estudiantes, reportes, auth, y tres decisiones explícitas del cliente que amplían el "Gerente: No" original de la matriz de roles para casos puntuales:

- **Asignación profesor↔rama↔campus**: Administrador y Gerente asignan; el profesor ve sus asignaciones en "Mis asignaciones" y automáticamente puede pasar lista en esos campus/ramas.
- **Costo de mensualidad por rama** ("Ramas y costos"): Administrador y Gerente editan `monto_mensual_base`; un trigger en la base de datos impide que el Gerente toque nombre/descripción/estado de la rama por esa misma vía — solo el costo. El cambio aplica a mensualidades generadas de ahí en adelante, nunca modifica las ya generadas.
- **Alta y baja de profesores**: Administrador y Gerente registran nuevos profesores y los desactivan. "Eliminar" = `activo = false` (RN-14, nunca borrado físico — un profesor con horarios/asignaciones históricas rompería esas referencias si se borrara). Desactivar realmente revoca el acceso: `fn_profesor_id_actual()` en `schema.sql` excluye profesores inactivos, así que todas las políticas RLS que dependen de ella (asistencia, justificaciones, estudiantes de sus grupos) se cierran de inmediato, no es solo una bandera visual.

Los siguientes módulos tienen esquema y reglas de negocio listos pero **no tienen pantalla propia en el MVP de Next.js** (sí están completos y funcionando en la demo HTML de un solo archivo, como referencia de comportamiento esperado):

- CRUD completo de campus y horarios, y alta/edición de ramas más allá del costo (nombre, descripción, activar/desactivar).
- Pantalla de justificaciones.
- Importación masiva de estudiantes (Excel/CSV).
- Consulta de auditoría.

Construirlas es mecánicamente el mismo patrón ya usado en `src/app/actions/pagos.ts` y `src/app/(dashboard)/pagos/`: una Server Action por mutación + una página por vista, apoyándose en las políticas RLS que ya existen en `schema.sql`.

## Limitaciones conocidas

- **Excel (.xlsx) real**: el MVP y la demo aceptan `.csv`; la librería `xlsx` está en `package.json` pero la UI de importación aún no la usa para leer `.xlsx` binario.
- **Comprobantes/adjuntos**: no hay subida de archivos real todavía (ver Supuestos).
- **Sin recibos PDF**: por decisión explícita del cliente (ver especificación, punto 5).
- **Sin notificaciones automáticas**: por decisión explícita del cliente (punto 8); solo alertas visuales dentro de la app.

## Roadmap — Fase 2

1. **Notificaciones automáticas** (WhatsApp/email) para pagos próximos a vencer y faltas acumuladas — hoy explícitamente fuera de alcance, pero es la mejora de mayor impacto percibido por los representantes.
2. **Recibos de pago en PDF**, generados on-demand desde el historial de pagos (no se almacenan, se generan al vuelo para no contradecir la decisión "sin recibos PDF por ahora" del alcance actual).
3. **App nativa o empaquetado con Capacitor/Expo** para que el pase de lista funcione mejor offline-first (hoy la PWA cachea, pero no hay cola de sincronización real para conectividad intermitente).
4. **Integración de cobro electrónico** (pasarela de pagos) como método adicional a los 5 actuales, si el club decide dejar de operar 100% en efectivo/transferencia.
5. **Importación real de `.xlsx`** con la librería ya incluida, y edición en línea de la vista previa antes de confirmar.
6. **Reportes con gráficos** (asistencia por rama en el tiempo, tendencia de recaudación) sobre los datos que REP-01 a REP-10 ya exponen.
7. **Multi-idioma** si el club expande a estudiantes/representantes que no hablan español, aunque hoy no está solicitado.

Ninguno de estos puntos requiere cambiar el modelo de datos actual — todos son extensiones sobre `schema.sql` tal como está.
