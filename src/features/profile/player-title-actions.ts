"use server";

import { revalidatePath } from "next/cache";
import { requireWriteAccess } from "@/features/auth/require-write-access";

export type PlayerTitleActionResult = { ok: boolean; message: string };

function refreshTitlePlacements() {
  revalidatePath("/", "layout");
  revalidatePath("/profil");
  revalidatePath("/legendarium");
  revalidatePath("/kronika");
  revalidatePath("/kalendarium");
}

export async function purchaseTitleAction(
  _previous: PlayerTitleActionResult,
  formData: FormData,
): Promise<PlayerTitleActionResult> {
  const access = await requireWriteAccess();
  if (!access.ok) return { ok: false, message: access.message };
  const titleId = formData.get("titleId");
  if (typeof titleId !== "string" || !titleId) {
    return { ok: false, message: "Wybierz tytuł." };
  }
  const { error } = await access.supabase.rpc("purchase_title", {
    p_title_id: titleId,
    p_request_id: crypto.randomUUID(),
  });
  if (error) {
    const message = error.message.includes("Insufficient")
        ? "Brakuje Ci Tukatów na ten tytuł."
        : error.message.includes("already owned")
          ? "Ten tytuł jest już w Twoim Ekwipunku."
          : "Nie udało się kupić tytułu.";
    return { ok: false, message };
  }
  refreshTitlePlacements();
  return { ok: true, message: "Tytuł trafił do Twojego Ekwipunku." };
}

export async function setEquippedTitleAction(
  _previous: PlayerTitleActionResult,
  formData: FormData,
): Promise<PlayerTitleActionResult> {
  const access = await requireWriteAccess();
  if (!access.ok) return { ok: false, message: access.message };
  const rawTitleId = formData.get("titleId");
  const titleId = typeof rawTitleId === "string" && rawTitleId ? rawTitleId : null;
  const { error } = await access.supabase.rpc(
    "set_equipped_title",
    titleId ? { p_title_id: titleId } : {},
  );
  if (error) {
    return {
      ok: false,
      message: "Nie udało się zmienić aktywnego tytułu.",
    };
  }
  refreshTitlePlacements();
  return { ok: true, message: titleId ? "Tytuł został wyposażony." : "Tytuł został zdjęty." };
}
