import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        rewa: {
          azul: "#0d3b66",
          verde: "#2e7d32",
          ambar: "#f9a825",
          rojo: "#c62828",
          gris: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};
export default config;
