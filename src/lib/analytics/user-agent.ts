export type DeviceClass = "mobile" | "tablet" | "desktop" | "unknown";
export type BrowserFamily = "Chrome" | "Safari" | "Firefox" | "Edge" | "Other";

export function classifyUserAgent(userAgent: string | null | undefined): {
  deviceClass: DeviceClass;
  browserFamily: BrowserFamily;
} {
  if (!userAgent) return { deviceClass: "unknown", browserFamily: "Other" };

  const normalized = userAgent.toLowerCase();
  const deviceClass: DeviceClass =
    /ipad|tablet|kindle|silk/.test(normalized)
      ? "tablet"
      : /mobile|iphone|ipod|android/.test(normalized)
        ? "mobile"
        : /mozilla|chrome|safari|firefox|edg/.test(normalized)
          ? "desktop"
          : "unknown";

  const browserFamily: BrowserFamily = /edg\//.test(normalized)
    ? "Edge"
    : /firefox\//.test(normalized)
      ? "Firefox"
      : /chrome\//.test(normalized) || /crios\//.test(normalized)
        ? "Chrome"
        : /safari\//.test(normalized)
          ? "Safari"
          : "Other";

  return { deviceClass, browserFamily };
}
