const optimizedRemoteHosts = new Set([
  "cf.geekdo-images.com",
  "cf.geekdo-static.com",
]);

export function canUseNextImageOptimization(src: string) {
  if (src.startsWith("/") && !src.startsWith("//")) return true;

  try {
    const url = new URL(src);
    return url.protocol === "https:" && optimizedRemoteHosts.has(url.hostname);
  } catch {
    return false;
  }
}
