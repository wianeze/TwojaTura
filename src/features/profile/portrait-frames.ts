import { createClient } from "@/lib/supabase/server";
import {
  buildPortraitFrameStoreData,
  type PortraitFrameStoreData,
} from "./portrait-frame-view-model";

export type {
  PortraitFrameDefinition,
  PortraitFrameRarity,
  PortraitFrameStoreData,
} from "./portrait-frame-view-model";

export async function getPortraitFrameStoreData(
  userId: string,
  activeFrameKey: string | null | undefined,
): Promise<PortraitFrameStoreData> {
  const supabase = await createClient();
  const [catalogResult, inventoryResult] = await Promise.all([
    supabase
      .from("portrait_frames")
      .select(
        "id, frame_key, name, rarity, asset_path, is_shop_available, sort_order",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("user_portrait_frames")
      .select("frame_id")
      .eq("user_id", userId),
  ]);

  if (catalogResult.error || inventoryResult.error) {
    throw new Error("Nie udało się pobrać Ekwipunku ramek.");
  }

  return buildPortraitFrameStoreData(
    catalogResult.data ?? [],
    (inventoryResult.data ?? []).map((item) => item.frame_id),
    activeFrameKey,
  );
}
