import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Twoja Tura!",
    template: "%s | Twoja Tura!",
  },
  description:
    "Zbierz ekipę. Wybierz grę. Twoja tura — prywatny klub planszówkowy dla znajomych.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
