"use server";

import { revalidatePath } from "next/cache";
import { requireWriteAccess } from "@/features/auth/require-write-access";
import { resolvePlayerPortraitFrameType } from "@/components/ui/player-portrait-frame";

export type PortraitFrameActionResult = {
  ok: boolean;
  message: string;
  frameKey?: string;
};

function readFrameKey(formData: FormData) {
  const value = formData.get("frameKey");
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function revalidatePortraitPlacements() {
  revalidatePath("/profil");
  revalidatePath("/gry");
  revalidatePath("/legendarium");
  revalidatePath("/", "layout");
}

export async function setActivePortraitFrameAction(
  formData: FormData,
): Promise<PortraitFrameActionResult> {
  const access = await requireWriteAccess();
  if (!access.ok) return { ok: false, message: access.message };

  const frameKey = readFrameKey(formData);
  if (!frameKey) return { ok: false, message: "Wybierz ramkę portretu." };

  const { data, error } = await access.supabase.rpc(
    "set_active_portrait_frame",
    { p_frame_key: frameKey },
  );

  if (error) {
    return { ok: false, message: "Nie udało się ustawić tej ramki." };
  }

  revalidatePortraitPlacements();
  return {
    ok: true,
    message: "Aktywna ramka została zmieniona.",
    frameKey: resolvePlayerPortraitFrameType(data),
  };
}
