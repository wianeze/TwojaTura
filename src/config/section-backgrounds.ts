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
    desktopSrc: "/brand/hero-desktop.png",
    mobileSrc: "/brand/hero-mobile.png",
    desktopPosition: "center",
    mobilePosition: "center 54%",
  },
  shelf: {
    key: "shelf",
    desktopSrc: "/empty/empty-shelf-main.png",
    mobileSrc: "/empty/empty-shelf-main.png",
    desktopPosition: "center 45%",
    mobilePosition: "48% center",
  },
  legendarium: {
    key: "legendarium",
    desktopSrc: "/empty/empty-corktable-main.png",
    mobileSrc: "/empty/empty-corktable-main.png",
    desktopPosition: "center 42%",
    mobilePosition: "50% center",
  },
  calendar: {
    key: "calendar",
    desktopSrc: "/empty/empty-meetings.png",
    mobileSrc: "/empty/empty-meetings.png",
    desktopPosition: "center",
    mobilePosition: "58% center",
  },
  chronicle: {
    key: "chronicle",
    desktopSrc: "/empty/empty-chronicle-main.png",
    mobileSrc: "/empty/empty-chronicle-main.png",
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
