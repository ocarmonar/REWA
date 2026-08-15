"use client";

import { crearClienteNavegador } from "./client";

const BUCKET = "documentos-rewa";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function subirComprobante(
  file: File,
  carpeta: "pagos" | "justificaciones"
): Promise<{ url: string; nombre: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error("El archivo no puede superar 5 MB.");
  }

  const supabase = crearClienteNavegador();
  const extension = file.name.split(".").pop() || "bin";
  const ruta = `${carpeta}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);

  return { url: ruta, nombre: file.name };
}

// El bucket es privado: se necesita una URL firmada de corta duración para
// que Admin/Gerente puedan ver/descargar el comprobante.
export async function obtenerUrlFirmada(ruta: string, segundosValidez = 300): Promise<string> {
  const supabase = crearClienteNavegador();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, segundosValidez);
  if (error) throw new Error(`No se pudo generar el enlace: ${error.message}`);
  return data.signedUrl;
}
