import { redirect } from "next/navigation";

/** Zachowuje stare zakładki administratorów po przejściu na modularny panel. */
export default function LegacyAdminPushPage() {
  redirect("/admin/push");
}
