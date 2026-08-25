import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Club Deportivo REWA",
  description: "Sistema de asistencia y pagos mensuales - Club Deportivo REWA",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#20274c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-EC" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
