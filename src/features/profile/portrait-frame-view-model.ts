import {
  resolvePlayerPortraitFrameType,
  type PlayerPortraitFrameType,
} from "../../components/ui/player-portrait-frame-config.ts";

export type PortraitFrameRarity = "common" | "rare" | "epic" | "legendary";

export type PortraitFrameDefinition = {
  id: string;
  key: PlayerPortraitFrameType;
  name: string;
  rarity: PortraitFrameRarity;
  assetPath: string;
  shopAvailable: boolean;
  owned: boolean;
};

export type PortraitFrameStoreData = {
  activeFrameKey: PlayerPortraitFrameType;
  ownedFrames: PortraitFrameDefinition[];
  shopFrames: PortraitFrameDefinition[];
};

export type PortraitFrameCatalogSource = {
  id: string;
  frame_key: string;
  name: string;
  rarity: string;
  asset_path: string;
  is_shop_available: boolean;
};

export const portraitFrameRarityLabel: Record<PortraitFrameRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export function buildPortraitFrameStoreData(
  catalog: PortraitFrameCatalogSource[],
  purchasedFrameIds: Iterable<string>,
  activeFrameKey: string | null | undefined,
): PortraitFrameStoreData {
  const purchasedIds = new Set(purchasedFrameIds);
  const frames: PortraitFrameDefinition[] = catalog.map((frame) => ({
    id: frame.id,
    key: resolvePlayerPortraitFrameType(frame.frame_key),
    name: frame.name,
    rarity: frame.rarity as PortraitFrameRarity,
    assetPath: frame.asset_path,
    shopAvailable: frame.is_shop_available,
    owned: frame.rarity === "common" || purchasedIds.has(frame.id),
  }));

  return {
    activeFrameKey: resolvePlayerPortraitFrameType(activeFrameKey),
    ownedFrames: frames.filter((frame) => frame.owned),
    shopFrames: frames.filter((frame) => frame.shopAvailable && !frame.owned),
  };
}
