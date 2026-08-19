import type { Metadata } from "next";
import { ServiceWorkerRegistration } from "@/components/layout/service-worker-registration";
import { getAppOrigin } from "@/lib/app-url";
import { cinzel, ebGaramond } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getAppOrigin()),
  title: {
    default: "Twoja Tura!",
    template: "%s | Twoja Tura!",
  },
  description:
    "Zbierz ekipę. Wybierz grę. Twoja tura — prywatny klub planszówkowy dla znajomych.",
  icons: {
    icon: [
      { url: "/icons/favicon.png", type: "image/png" },
      {
        url: "/icons/pwa-startup-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/pwa-startup-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/pwa-startup-apple.png",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    title: "Twoja Tura!",
    description:
      "Zbierz ekipę. Wybierz grę. Twoja tura — prywatny klub planszówkowy dla znajomych.",
    type: "website",
    locale: "pl_PL",
    images: [
      {
        url: "/brand/og-twoja-tura.png",
        width: 1734,
        height: 907,
        alt: "Twoja Tura! — klub planszówkowy przy kominku",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`h-full antialiased ${cinzel.variable} ${ebGaramond.variable}`}
    >
      <body className="min-h-full">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
