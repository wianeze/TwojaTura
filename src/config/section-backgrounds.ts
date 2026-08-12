import heroDesktop from "../../public/brand/hero-desktop.webp";
import heroMobile from "../../public/brand/hero-mobile.webp";
import calendarBackground from "../../public/empty/empty-meetings.webp";
import chronicleBackground from "../../public/empty/empty-chronicle-main.webp";
import legendariumBackground from "../../public/empty/empty-corktable-main.webp";
import shelfBackground from "../../public/empty/empty-shelf-main.webp";

export type SectionBackgroundTheme = {
  key: "table" | "shelf" | "legendarium" | "calendar" | "chronicle";
  desktopSrc: string;
  mobileSrc: string;
  desktopPosition: string;
  mobilePosition: string;
};

export const sectionBackgrounds: Record<
  SectionBackgroundTheme["key"],
  SectionBackgroundTheme
> = {
  table: {
    key: "table",
    desktopSrc: heroDesktop.src,
    mobileSrc: heroMobile.src,
    desktopPosition: "center",
    mobilePosition: "center 54%",
  },
  shelf: {
    key: "shelf",
    desktopSrc: shelfBackground.src,
    mobileSrc: shelfBackground.src,
    desktopPosition: "center 45%",
    mobilePosition: "48% center",
  },
  legendarium: {
    key: "legendarium",
    desktopSrc: legendariumBackground.src,
    mobileSrc: legendariumBackground.src,
    desktopPosition: "center 42%",
    mobilePosition: "50% center",
  },
  calendar: {
    key: "calendar",
    desktopSrc: calendarBackground.src,
    mobileSrc: calendarBackground.src,
    desktopPosition: "center",
    mobilePosition: "58% center",
  },
  chronicle: {
    key: "chronicle",
    desktopSrc: chronicleBackground.src,
    mobileSrc: chronicleBackground.src,
    desktopPosition: "center",
    mobilePosition: "52% center",
  },
};

const routeBackgrounds = [
  { prefix: "/gry", theme: "shelf" },
  { prefix: "/legendarium", theme: "legendarium" },
  { prefix: "/kalendarium", theme: "calendar" },
  { prefix: "/kronika", theme: "chronicle" },
] as const satisfies ReadonlyArray<{
  prefix: string;
  theme: SectionBackgroundTheme["key"];
}>;

export function getSectionBackground(pathname: string) {
  const route = routeBackgrounds.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return sectionBackgrounds[route?.theme ?? "table"];
}
