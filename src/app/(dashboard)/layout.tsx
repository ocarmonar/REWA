import Sidebar from "@/components/Sidebar";
import { obtenerUsuarioActual } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const usuario = await obtenerUsuarioActual();

  return (
    <div className="flex">
      <Sidebar rol={usuario.rol} nombre={`${usuario.nombres} ${usuario.apellidos}`} />
      <main className="flex-1 min-h-screen p-6">{children}</main>
    </div>
  );
}
