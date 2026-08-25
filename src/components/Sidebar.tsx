"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "@/app/actions/auth";
import type { RolUsuario } from "@/lib/types";

interface ItemNav {
  href: string;
  etiqueta: string;
  roles: RolUsuario[];
}

const ITEMS: ItemNav[] = [
  { href: "/inicio", etiqueta: "Inicio", roles: ["administrador", "gerente", "profesor"] },
  { href: "/asistencia", etiqueta: "Asistencia", roles: ["administrador", "gerente", "profesor"] },
  { href: "/estudiantes", etiqueta: "Estudiantes", roles: ["administrador", "gerente"] },
  { href: "/profesores", etiqueta: "Profesores", roles: ["administrador", "gerente"] },
  { href: "/ramas", etiqueta: "Ramas y costos", roles: ["administrador", "gerente"] },
  { href: "/mis-asignaciones", etiqueta: "Mis asignaciones", roles: ["profesor"] },
  { href: "/pagos", etiqueta: "Pagos", roles: ["administrador", "gerente"] },
  { href: "/reportes", etiqueta: "Reportes", roles: ["administrador", "gerente"] },
];

export default function Sidebar({
  rol,
  nombre,
}: {
  rol: RolUsuario;
  nombre: string;
}) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.roles.includes(rol));
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      {/* Barra superior solo en móvil, con botón hamburguesa */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-rewa-azul text-white px-4 py-3">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setAbierto(true)}
          className="p-1 -ml-1"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-rewa.png" alt="" width={28} height={28} />
        <span className="font-heading font-bold">REWA</span>
      </header>

      {/* Overlay oscuro al abrir el menú en móvil */}
      {abierto && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setAbierto(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 bg-rewa-azul text-white min-h-screen flex flex-col transform transition-transform duration-200 ease-in-out md:static md:z-auto md:w-60 md:translate-x-0 ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-rewa.png" alt="" width={40} height={40} />
          <div className="font-heading">
            <p className="font-bold leading-tight">Club Deportivo</p>
            <p className="font-bold leading-tight text-lg">REWA</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const activo = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAbierto(false)}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition border-l-4 ${
                  activo ? "bg-white/10 border-rewa-dorado" : "border-transparent hover:bg-white/10"
                }`}
              >
                {item.etiqueta}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 text-sm">
          <p className="truncate mb-2" title={nombre}>{nombre}</p>
          <form action={cerrarSesion}>
            <button className="w-full text-left text-white/70 hover:text-white">Cerrar sesión</button>
          </form>
        </div>
      </aside>
    </>
  );
}
