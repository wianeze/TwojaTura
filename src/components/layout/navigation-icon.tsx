export type NavigationIconName =
  "dashboard" | "shelf" | "games" | "meetings" | "plays" | "profile" | "admin";

type NavigationIconProps = {
  name: NavigationIconName;
  className?: string;
};

export function NavigationIcon({
  name,
  className = "size-5",
}: NavigationIconProps) {
  const commonProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "dashboard") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </svg>
    );
  }

  if (name === "shelf") {
    return (
      <svg {...commonProps}>
        <path d="M4 4v15M9 6v13M14 3v16M20 8v11M2 19h20" />
      </svg>
    );
  }

  if (name === "games") {
    // Puchar — Legendarium to ranking i osiągnięcia, nie plansza gry.
    return (
      <svg {...commonProps}>
        <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5a2 2 0 0 0 2 4h1M16 6h3a2 2 0 0 1-2 4h-1M12 12v5M8 21h8M9 17h6" />
      </svg>
    );
  }

  if (name === "meetings") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
        <path d="m8 15 2 2 5-5" />
      </svg>
    );
  }

  if (name === "plays") {
    // Otwarta księga — Kronika to historia rozgrywek.
    return (
      <svg {...commonProps}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z" />
      </svg>
    );
  }

  if (name === "admin") {
    return (
      <svg {...commonProps}>
        <path d="M12 3 4 6.5v5c0 4.6 3.2 8.4 8 9.5 4.8-1.1 8-4.9 8-9.5v-5L12 3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}
