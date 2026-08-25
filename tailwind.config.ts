import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        rewa: {
          // Azul marino y dorado tomados de rewa.com.ec (colores de marca
          // reales del sitio oficial). Verde/ámbar/rojo se mantienen como
          // colores de ESTADO (pagado/parcial/vencido), no de marca — son
          // una convención de UX aparte, cambiarlos reduciría claridad.
          azul: "#20274c",
          dorado: "#e1a404",
          verde: "#2e7d32",
          ambar: "#f9a825",
          rojo: "#c62828",
          gris: "#6b7280",
        },
      },
      fontFamily: {
        // Poppins: la fuente de encabezados del sitio oficial de REWA.
        // El cuerpo de texto se deja en la pila de sistema (sans-serif por
        // defecto de Tailwind), igual que en el sitio real.
        heading: ["var(--font-poppins)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
