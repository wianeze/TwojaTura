import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Twoja Tura!",
    short_name: "Twoja Tura!",
    description: "Prywatny klub planszówkowy dla znajomych.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#2f1e19",
    theme_color: "#2f1e19",
    icons: [
      {
        src: "/icons/pwa-startup-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/pwa-startup-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
