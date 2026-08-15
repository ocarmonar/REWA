// Formatea una fecha "sintética" (construida con new Date(anio, mes, dia)) usando
// sus propios componentes locales — nunca toISOString, que usa UTC y desfasaría
// el día si el proceso que la construyó no corre en UTC.
export function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "Hoy" para el negocio = hoy en America/Guayaquil (supuesto S1), sin importar
// en qué zona horaria corra el servidor (los Server Components de Next.js se
// ejecutan en el servidor, no en el navegador del usuario; Vercel por defecto
// usa UTC, que va varias horas adelantado de Ecuador).
export function fechaLocalDeHoy(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valores: Record<string, string> = {};
  for (const p of partes) valores[p.type] = p.value;
  return `${valores.year}-${valores.month}-${valores.day}`;
}

export function formatoMoneda(valor: number): string {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(valor);
}

export function formatoFecha(fecha: string | Date): string {
  const d = typeof fecha === "string" ? new Date(fecha + "T00:00:00") : fecha;
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export const ETIQUETAS_ESTADO_ASISTENCIA: Record<string, { texto: string; color: string }> = {
  presente: { texto: "Presente", color: "bg-green-100 text-green-800" },
  falta: { texto: "Falta", color: "bg-red-100 text-red-800" },
  tarde: { texto: "Tarde", color: "bg-amber-100 text-amber-800" },
  justificado: { texto: "Justificado", color: "bg-blue-100 text-blue-800" },
  permiso: { texto: "Permiso", color: "bg-blue-100 text-blue-800" },
  lesionado: { texto: "Lesionado", color: "bg-gray-200 text-gray-800" },
};

export const ETIQUETAS_ESTADO_MENSUALIDAD: Record<string, { texto: string; color: string }> = {
  pendiente: { texto: "Pendiente", color: "bg-gray-200 text-gray-800" },
  parcial: { texto: "Parcial", color: "bg-amber-100 text-amber-800" },
  pagado: { texto: "Pagado", color: "bg-green-100 text-green-800" },
  vencido: { texto: "Vencido", color: "bg-red-100 text-red-800" },
  exonerado: { texto: "Exonerado", color: "bg-blue-100 text-blue-800" },
  anulado: { texto: "Anulado", color: "bg-gray-300 text-gray-600" },
};

export const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Réplica en JS de la lógica de v_mensualidades: "vencido" es un estado
// derivado en lectura, nunca persistido (ver supabase/schema.sql).
export function estadoEfectivoMensualidad(m: {
  estado: string;
  saldo: number;
  fecha_limite: string;
}): string {
  if (["pagado", "exonerado", "anulado"].includes(m.estado)) return m.estado;
  if (m.saldo > 0 && m.fecha_limite < fechaLocalDeHoy()) return "vencido";
  return m.estado;
}
