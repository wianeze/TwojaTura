import type { Metadata } from "next";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { AdminModuleGrid } from "@/features/admin/admin-module-grid";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  return (
    <div className="space-y-7">
      <header
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <p className="text-xs font-bold tracking-[0.2em] text-[#e3ae67] uppercase">
          Zarządzanie grupą
        </p>
        <h1 className="font-display text-cream mt-1.5 text-4xl font-semibold tracking-tight drop-shadow-[0_2px_12px_rgba(20,10,7,0.32)] sm:text-[2.8rem]">
          Panel administratora
        </h1>
      </header>

      <div
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast"
      >
        <AdminModuleGrid />
      </div>
    </div>
  );
}
