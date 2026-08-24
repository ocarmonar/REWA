"use client";

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

  return (
    <aside className="w-60 shrink-0 bg-rewa-azul text-white min-h-screen flex flex-col">
      <div className="p-5 border-b border-white/10 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-rewa.png" alt="" width={40} height={40} />
        <div>
          <p className="font-bold leading-tight">Club Deportivo</p>
          <p className="font-bold leading-tight text-lg">REWA</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const activo = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                activo ? "bg-white/15" : "hover:bg-white/10"
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
  );
}
