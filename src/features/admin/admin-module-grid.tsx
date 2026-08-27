import { WarmLink } from "@/components/layout/warm-link";

type AdminModuleKey =
  "statistics" | "push" | "accounts" | "adjustments" | "feedback";

const modules: Array<{
  key: AdminModuleKey;
  href: string;
  title: string;
  description: string;
}> = [
  {
    key: "statistics",
    href: "/admin/statystyki",
    title: "Statystyki",
    description: "Aktywność grupy, użycie funkcji i historia aplikacji.",
  },
  {
    key: "push",
    href: "/admin/push",
    title: "Push",
    description: "Wyślij wiadomość do drużyny i sprawdź historię wysyłek.",
  },
  {
    key: "accounts",
    href: "/admin/konta",
    title: "Zarządzanie kontami",
    description: "Role, statusy i dostęp członków Twojej grupy.",
  },
  {
    key: "adjustments",
    href: "/admin/korekty",
    title: "Korekty punktów",
    description: "Kontroluj korekty Renomy i Tukatów w jednym miejscu.",
  },
  {
    key: "feedback",
    href: "/admin/zgloszenia",
    title: "Zgłoszenia użytkowników",
    description: "Przejrzyj pomysły, błędy i odpowiedzi dla graczy.",
  },
];

function ModuleIcon({ module }: { module: AdminModuleKey }) {
  const paths: Record<AdminModuleKey, string> = {
    statistics: "M4 19V10m5 9V5m5 14v-7m5 7V3M3 21h18",
    push: "M4 12 20 4l-5 16-3.5-6.5L4 12Zm7.5 1.5L20 4",
    accounts:
      "M16 20v-1.5A4.5 4.5 0 0 0 11.5 14h-3A4.5 4.5 0 0 0 4 18.5V20m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm5.5-5a3.5 3.5 0 0 1 0 6M20 20v-1.5a4.5 4.5 0 0 0-2.5-4",
    adjustments:
      "M12 3v18M7 7h7.2a2.8 2.8 0 1 1 0 5.6H9.8A2.8 2.8 0 1 0 9.8 18H17",
    feedback:
      "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 5h8m-8 4h5",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-10 drop-shadow-[0_2px_9px_rgba(232,174,97,0.35)] sm:size-12"
    >
      <path d={paths[module]} />
    </svg>
  );
}

export function AdminModuleGrid() {
  return (
    <nav
      aria-label="Moduły panelu administratora"
      className="grid grid-cols-2 gap-3 max-[359px]:grid-cols-1 sm:gap-4 lg:grid-cols-3"
    >
      {modules.map((module, index) => (
        <WarmLink
          key={module.key}
          href={module.href}
          className="group relative isolate aspect-square overflow-hidden rounded-[1.6rem] border border-[#e4b267]/35 bg-[radial-gradient(circle_at_80%_12%,rgba(221,147,59,0.24),transparent_35%),linear-gradient(145deg,rgba(81,43,26,0.96),rgba(37,20,14,0.98))] p-4 shadow-[0_14px_30px_rgba(14,7,4,0.32)] transition duration-200 hover:-translate-y-1 hover:border-[#f2c97e]/75 hover:shadow-[0_20px_40px_rgba(18,8,4,0.5),0_0_22px_rgba(226,151,63,0.22)] focus-visible:-translate-y-1 focus-visible:border-[#f2c97e] focus-visible:ring-4 focus-visible:ring-[#e9ab59]/35 focus-visible:outline-none sm:p-5"
        >
          <span className="pointer-events-none absolute -top-9 -right-9 size-28 rounded-full border border-[#f3ce92]/10 bg-[#c47932]/10 transition duration-200 group-hover:scale-125" />
          <span className="relative flex h-full flex-col justify-between text-[#f6e2bd]">
            <span className="flex items-center justify-between text-[#e9b76d]">
              <ModuleIcon module={module.key} />
              <span className="font-display text-xl opacity-45">
                0{index + 1}
              </span>
            </span>
            <span>
              <strong className="font-display block text-base leading-tight font-semibold sm:text-2xl">
                {module.title}
              </strong>
              <span className="mt-1.5 block text-[0.68rem] leading-snug text-[#e5caa8] sm:mt-2 sm:text-sm">
                {module.description}
              </span>
            </span>
          </span>
        </WarmLink>
      ))}
    </nav>
  );
}
