const DEFAULT_APP_ORIGIN = "http://localhost:3000";

export function getAppOrigin() {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_APP_ORIGIN;

  try {
    const parsed = new URL(configuredOrigin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported app origin protocol");
    }

    return parsed.origin;
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
}

export function buildAppUrl(pathname: string) {
  return new URL(pathname, getAppOrigin());
}

export function buildAuthCallbackUrl(nextPath: string) {
  const callbackUrl = buildAppUrl("/auth/callback");
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}
