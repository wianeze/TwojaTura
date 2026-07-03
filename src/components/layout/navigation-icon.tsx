export type NavigationIconName =
  "dashboard" | "shelf" | "games" | "meetings" | "plays" | "profile";

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
    return (
      <svg {...commonProps}>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4.3 7.7 7.7 4.2 7.7-4.2M12 12v9" />
        <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
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
    return (
      <svg {...commonProps}>
        <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5a2 2 0 0 0 2 4h1M16 6h3a2 2 0 0 1-2 4h-1M12 12v5M8 21h8M9 17h6" />
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
