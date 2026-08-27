export const playerPortraitFrameTypes = [
  "common-frame-1",
  "common-frame-2",
  "common-frame-3",
  "common-frame-4",
  "common-frame-5",
  "magic-frame-1",
  "magic-frame-2",
  "magic-frame-3",
  "magic-frame-4",
  "epic-frame-1",
  "epic-frame-2",
  "epic-frame-3",
  "epic-frame-4",
] as const;

export type PlayerPortraitFrameType = (typeof playerPortraitFrameTypes)[number];

export const defaultPlayerPortraitFrameType: PlayerPortraitFrameType =
  "common-frame-1";

export const playerPortraitFrameCanvas = {
  width: 850,
  height: 1450,
} as const;

export const playerPortraitFrameAssetPaths: Record<
  PlayerPortraitFrameType,
  string
> = {
  "common-frame-1": "/Frames/common-frame-1-dopasowanie.png",
  "common-frame-2": "/Frames/common-frame-2-dopasowanie.png",
  "common-frame-3": "/Frames/common-frame-3-dopasowanie.png",
  "common-frame-4": "/Frames/common-frame-4-dopasowanie.png",
  "common-frame-5": "/Frames/common-frame-dopasowanie5.png",
  "magic-frame-1": "/Frames/magic-frame-1-dopasowanie.png",
  "magic-frame-2": "/Frames/magic-frame-2-dopasowanie.png",
  "magic-frame-3": "/Frames/magic-frame-3-dopasowanie.png",
  "magic-frame-4": "/Frames/magic-frame-4-dopasowanie.png",
  "epic-frame-1": "/Frames/epic-frame-1-dopasowanie.png",
  "epic-frame-2": "/Frames/epic-frame-2-dopasowanie.png",
  "epic-frame-3": "/Frames/epic-frame-3-dopasowanie.png",
  "epic-frame-4": "/Frames/epic-frame-4-dopasowanie.png",
};

export function resolvePlayerPortraitFrameType(
  value: string | null | undefined,
): PlayerPortraitFrameType {
  return playerPortraitFrameTypes.includes(value as PlayerPortraitFrameType)
    ? (value as PlayerPortraitFrameType)
    : defaultPlayerPortraitFrameType;
}

export function getPlayerPortraitFrameAssetPath(
  frameType: string | null | undefined,
) {
  return playerPortraitFrameAssetPaths[
    resolvePlayerPortraitFrameType(frameType)
  ];
}
