"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import {
  getSectionBackground,
  type SectionBackgroundTheme,
} from "@/config/section-backgrounds";

const CROSSFADE_DURATION = 420;

type BackgroundStyle = CSSProperties & {
  "--section-bg-desktop": string;
  "--section-bg-mobile": string;
  "--section-bg-position-desktop": string;
  "--section-bg-position-mobile": string;
};

function getBackgroundStyle(theme: SectionBackgroundTheme): BackgroundStyle {
  return {
    "--section-bg-desktop": `url("${theme.desktopSrc}")`,
    "--section-bg-mobile": `url("${theme.mobileSrc}")`,
    "--section-bg-position-desktop": theme.desktopPosition,
    "--section-bg-position-mobile": theme.mobilePosition,
  };
}

export function SectionBackground() {
  const pathname = usePathname();
  const targetTheme = getSectionBackground(pathname);
  const [layers, setLayers] = useState<SectionBackgroundTheme[]>([targetTheme]);

  useEffect(() => {
    let cleanupTimer: number | undefined;
    const animationFrame = window.requestAnimationFrame(() => {
      setLayers((currentLayers) => {
        const currentTheme = currentLayers[currentLayers.length - 1];

        if (currentTheme?.key === targetTheme.key) return currentLayers;

        return currentTheme ? [currentTheme, targetTheme] : [targetTheme];
      });

      cleanupTimer = window.setTimeout(() => {
        setLayers([targetTheme]);
      }, CROSSFADE_DURATION);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (cleanupTimer) window.clearTimeout(cleanupTimer);
    };
  }, [targetTheme]);

  return (
    <div className="section-background-root" aria-hidden="true">
      {layers.map((theme, index) => {
        const entering = layers.length > 1 && index === layers.length - 1;

        return (
          <div
            key={theme.key}
            data-section-background={theme.key}
            className={`section-background-image ${entering ? "section-background-enter" : ""}`}
            style={getBackgroundStyle(theme)}
          />
        );
      })}
      <div className="section-background-overlay" />
    </div>
  );
}
