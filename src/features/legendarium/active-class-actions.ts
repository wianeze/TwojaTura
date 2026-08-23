"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireWriteAccess } from "@/features/auth/require-write-access";
import { recordUsageEventSafely } from "@/lib/analytics/server";
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

  after(() =>
    recordUsageEventSafely(access.supabase, {
      eventName: "class.changed",
      routeKey: "legendarium",
      componentKey: "profile.class",
      action: "changed",
      entityType: "class",
      correlationKey: `class:${classKey ?? "none"}`,
      metadata: classKey ? { class_key: classKey } : {},
    }),
  );

  revalidatePath("/legendarium");
  revalidatePath("/profil");
  revalidatePath("/", "layout");
}
