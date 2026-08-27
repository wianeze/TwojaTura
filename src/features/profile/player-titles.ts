import { createClient } from "@/lib/supabase/server";
import type { PlayerTitle, PlayerTitleRarity } from "@/components/ui/player-display-name";

export type TitleDefinition = PlayerTitle & {
  slug: string;
  priceTukats: number | null;
  purchasable: boolean;
  owned: boolean;
};

export type PlayerTitleStoreData = {
  ownedTitles: TitleDefinition[];
  shopTitles: TitleDefinition[];
  equippedTitleId: string | null;
};

function isTitleRarity(value: string): value is PlayerTitleRarity {
  return ["common", "rare", "epic", "legendary"].includes(value);
}

export async function getPlayerTitleStoreData(
  userId: string,
  equippedTitleId: string | null | undefined,
): Promise<PlayerTitleStoreData> {
  const supabase = await createClient();
  const [catalogResult, inventoryResult] = await Promise.all([
    supabase
      .from("title_definitions")
      .select("id, slug, name, rarity, price_tukats, is_purchasable, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("user_titles").select("title_id").eq("user_id", userId),
  ]);

  if (catalogResult.error || inventoryResult.error) {
    throw new Error("Nie udało się pobrać Ekwipunku tytułów.");
  }

  const ownedIds = new Set((inventoryResult.data ?? []).map((row) => row.title_id));
  const titles = (catalogResult.data ?? []).map((title) => ({
    id: title.id,
    slug: title.slug,
    name: title.name,
    rarity: isTitleRarity(title.rarity) ? title.rarity : "common",
    priceTukats: title.price_tukats,
    purchasable: title.is_purchasable,
    owned: ownedIds.has(title.id),
  }));

  return {
    ownedTitles: titles.filter((title) => title.owned),
    shopTitles: titles.filter((title) => title.purchasable && !title.owned),
    equippedTitleId: equippedTitleId ?? null,
  };
}
