import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Club Deportivo REWA",
  description: "Sistema de asistencia y pagos mensuales - Club Deportivo REWA",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0d3b66",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-EC">
      <body>{children}</body>
    </html>
  );
}
