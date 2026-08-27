import Image from "next/image";
import { getMemberInitial } from "@/features/auth/current-member";
import {
  defaultPlayerPortraitFrameType,
  playerPortraitFrameCanvas,
  resolvePlayerPortraitFrameType,
  type PlayerPortraitFrameType,
} from "./player-portrait-frame-config";

export {
  defaultPlayerPortraitFrameType,
  getPlayerPortraitFrameAssetPath,
  playerPortraitFrameCanvas,
  playerPortraitFrameTypes,
  resolvePlayerPortraitFrameType,
} from "./player-portrait-frame-config";
export type { PlayerPortraitFrameType } from "./player-portrait-frame-config";

export type PlayerPortraitFrameSize = "compact" | "medium" | "large";

type FrameAdjustment = {
  scale: number;
  offsetXPercent: number;
  offsetYPercent: number;
};

type PlayerPortraitFrameConfig = {
  assetSrc: string;
  frame: FrameAdjustment;
  portrait: FrameAdjustment & {
    safeAreaClipPath: string;
    objectPosition: string;
  };
};

const frameConfigByType: Record<
  PlayerPortraitFrameType,
  PlayerPortraitFrameConfig
> = {
  "common-frame-1": {
    assetSrc: "/Frames/common-frame-1-dopasowanie.png",
    frame: { scale: 1, offsetXPercent: 0, offsetYPercent: 0 },
    portrait: {
      scale: 1,
      offsetXPercent: 0,
      offsetYPercent: 0,
      // Frame and portrait always share the exact same 850 x 1450 canvas.
      safeAreaClipPath: "inset(0 round 5%)",
      objectPosition: "center 28%",
    },
  },
  "common-frame-2": {
    assetSrc: "/Frames/common-frame-2-dopasowanie.png",
    frame: { scale: 1, offsetXPercent: 0, offsetYPercent: 0 },
    portrait: {
      scale: 1,
      offsetXPercent: 0,
      offsetYPercent: 0,
      safeAreaClipPath: "inset(0 round 5%)",
      objectPosition: "center 28%",
    },
  },
  "common-frame-3": rawFrameConfig("/Frames/common-frame-3-dopasowanie.png"),
  "common-frame-4": rawFrameConfig("/Frames/common-frame-4-dopasowanie.png"),
  "common-frame-5": rawFrameConfig("/Frames/common-frame-dopasowanie5.png"),
  "magic-frame-1": rawFrameConfig("/Frames/magic-frame-1-dopasowanie.png"),
  "magic-frame-2": rawFrameConfig("/Frames/magic-frame-2-dopasowanie.png"),
  "magic-frame-3": rawFrameConfig("/Frames/magic-frame-3-dopasowanie.png"),
  "magic-frame-4": rawFrameConfig("/Frames/magic-frame-4-dopasowanie.png"),
  "epic-frame-1": rawFrameConfig("/Frames/epic-frame-1-dopasowanie.png"),
  "epic-frame-2": rawFrameConfig("/Frames/epic-frame-2-dopasowanie.png"),
  "epic-frame-3": rawFrameConfig("/Frames/epic-frame-3-dopasowanie.png"),
  "epic-frame-4": rawFrameConfig("/Frames/epic-frame-4-dopasowanie.png"),
};

function rawFrameConfig(assetSrc: string): PlayerPortraitFrameConfig {
  return {
    assetSrc,
    frame: { scale: 1, offsetXPercent: 0, offsetYPercent: 0 },
    portrait: {
      scale: 1,
      offsetXPercent: 0,
      offsetYPercent: 0,
      safeAreaClipPath: "inset(0 round 5%)",
      objectPosition: "center 28%",
    },
  };
}

const sizeClassByVariant: Record<PlayerPortraitFrameSize, string> = {
  compact: "w-9 sm:w-10",
  medium: "w-11 sm:w-12",
  large: "w-20 sm:w-24",
};

const fallbackTextClassByVariant: Record<PlayerPortraitFrameSize, string> = {
  compact: "text-xs sm:text-sm",
  medium: "text-sm sm:text-base",
  large: "text-2xl sm:text-3xl",
};

const frameSizesByVariant: Record<PlayerPortraitFrameSize, string> = {
  compact: "40px",
  medium: "48px",
  large: "96px",
};

function getAdjustmentTransform(adjustment: FrameAdjustment) {
  if (
    adjustment.scale === 1 &&
    adjustment.offsetXPercent === 0 &&
    adjustment.offsetYPercent === 0
  ) {
    return undefined;
  }

  return `translate(${adjustment.offsetXPercent}%, ${adjustment.offsetYPercent}%) scale(${adjustment.scale})`;
}

export function PlayerPortraitFrame({
  avatarUrl,
  name,
  frameType = defaultPlayerPortraitFrameType,
  size = "medium",
  className = "",
}: {
  avatarUrl?: string | null;
  name: string;
  frameType?: PlayerPortraitFrameType | string | null;
  size?: PlayerPortraitFrameSize;
  className?: string;
}) {
  const resolvedFrameType = resolvePlayerPortraitFrameType(frameType);
  const frameConfig = frameConfigByType[resolvedFrameType];

  return (
    <span
      className={`relative isolate block shrink-0 overflow-visible ${sizeClassByVariant[size]} ${className}`}
      style={{
        aspectRatio: `${playerPortraitFrameCanvas.width} / ${playerPortraitFrameCanvas.height}`,
      }}
      aria-label={`Portret gracza ${name}`}
      title={name}
      role="img"
    >
      <span
        className="absolute inset-0 z-0 overflow-hidden bg-[#140b08] shadow-[inset_0_0_18px_rgba(0,0,0,0.62)]"
        style={{
          clipPath: frameConfig.portrait.safeAreaClipPath,
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- profile avatars can use external URLs
          <img
            src={avatarUrl}
            alt=""
            className="size-full object-cover"
            style={{
              objectPosition: frameConfig.portrait.objectPosition,
              transform: getAdjustmentTransform(frameConfig.portrait),
            }}
          />
        ) : (
          <span
            className={`wood-grain text-cream grid size-full place-items-center font-bold ${fallbackTextClassByVariant[size]}`}
          >
            {getMemberInitial(name)}
          </span>
        )}
      </span>

      <Image
        src={frameConfig.assetSrc}
        alt=""
        fill
        sizes={frameSizesByVariant[size]}
        className="pointer-events-none z-10 object-fill drop-shadow-[0_5px_9px_rgba(15,7,4,0.52)]"
        style={{ transform: getAdjustmentTransform(frameConfig.frame) }}
        aria-hidden="true"
      />
    </span>
  );
}
