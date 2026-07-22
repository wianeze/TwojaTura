"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeActiveClassKey,
  persistActiveClassSelection,
} from "./active-class-selection";

export async function setActiveClassAction(formData: FormData) {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") {
    throw new Error("Wybór klasy wymaga aktywnego członkostwa.");
  }

  const classKey = normalizeActiveClassKey(formData.get("classKey"));
  const supabase = await createClient();
  await persistActiveClassSelection(
    (pClassKey) =>
      supabase.rpc("set_active_class", { p_class_key: pClassKey as string }),
    classKey,
  );

  revalidatePath("/legendarium");
  revalidatePath("/profil");
  revalidatePath("/", "layout");
}
