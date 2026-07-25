"use server";

import { revalidatePath } from "next/cache";
import { requireWriteAccess } from "@/features/auth/require-write-access";
import {
  normalizeActiveClassKey,
  persistActiveClassSelection,
} from "./active-class-selection";

export async function setActiveClassAction(formData: FormData) {
  const access = await requireWriteAccess();
  if (!access.ok) {
    throw new Error(access.message);
  }

  const classKey = normalizeActiveClassKey(formData.get("classKey"));
  const supabase = access.supabase;
  await persistActiveClassSelection(
    (pClassKey) =>
      supabase.rpc("set_active_class", { p_class_key: pClassKey as string }),
    classKey,
  );

  revalidatePath("/legendarium");
  revalidatePath("/profil");
  revalidatePath("/", "layout");
}
