"use client";

import "./lab-buttons.css";
import {
  labButtonClassName,
  type LabAction,
  type LabDirection,
  type LabForcedState,
  type LabSize,
} from "./lab-button-styles";

// Symbol musi jednoznacznie mówić, o którą akcję chodzi — kalendarz z plusem
// dla spotkania, głos w urnie, otwarta księga Kroniki, gwiazdka oceny, plus
// Półki, strzałka powrotu, kosz dla akcji destrukcyjnej.
const iconPaths: Record<LabAction, string> = {
  meeting:
    "M8 3v3M16 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM12 12.5v5M9.5 15h5",
  vote: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 12l3 3 5-6",
  chronicle:
    "M12 6.5C10.5 5 8.5 4.5 5 4.5v13c3.5 0 5.5.5 7 2 1.5-1.5 3.5-2 7-2v-13c-3.5 0-5.5.5-7 2ZM12 6.5v13",
  rating:
    "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8-5.3-2.9-5.3 2.9 1.1-5.8L3.5 9.7l5.9-.8L12 3.5Z",
  shelf: "M12 5v14M5 12h14",
  neutral: "M19 12H5M11 18l-6-6 6-6",
  danger:
    "M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3",
};

function LabIcon({ action }: { action: LabAction }) {
  return (
    <svg
      className="lab-btn-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[action]} />
    </svg>
  );
}

export function LabButton({
  direction,
  action,
  size = "default",
  forcedState = "none",
  withIcon = true,
  loading = false,
  disabled = false,
  ariaLabel,
  className,
  children,
}: {
  direction: LabDirection;
  action: LabAction;
  size?: LabSize;
  forcedState?: LabForcedState;
  withIcon?: boolean;
  loading?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const isDisabled = disabled || forcedState === "disabled";

  return (
    <button
      type="button"
      disabled={isDisabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      data-force={forcedState === "none" ? undefined : forcedState}
      className={labButtonClassName({ direction, action, size, className })}
    >
      {/*
        Etykieta zostaje w przepływie także podczas ładowania (tylko
        visibility: hidden), więc szerokość przycisku się nie zmienia.
      */}
      <span
        className={`lab-btn-label ${loading ? "lab-btn-label-hidden" : ""}`}
      >
        {withIcon ? <LabIcon action={action} /> : null}
        <span>{children}</span>
      </span>
      {loading ? <span className="lab-btn-spinner" aria-hidden="true" /> : null}
    </button>
  );
}
