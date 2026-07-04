export function getSafeInternalPath(value: string | null, fallback = "/") {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001F\u007F]/u.test(value)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "http://internal.local");
    if (parsed.origin !== "http://internal.local") {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return value;
}
