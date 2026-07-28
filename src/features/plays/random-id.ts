// crypto.randomUUID() is gated behind secure contexts (HTTPS, or
// http://localhost/127.0.0.1) — it's simply undefined over plain HTTP to a
// LAN IP (e.g. testing the create-play photo flow from a phone at
// http://192.168.x.x:3000), which throws a TypeError the instant a photo is
// selected. crypto.getRandomValues() has no such restriction, so it's used
// as a fallback to build an equivalent RFC 4122 v4 UUID.
export function randomId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
