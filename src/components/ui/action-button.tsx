import Link from "next/link";
import {
  actionButtonClasses,
  type ActionEmphasis,
  type ActionSize,
  type ActionVariant,
} from "./action-button-styles";

// Symbol jednoznacznie wskazuje akcję: kalendarz z plusem dla spotkania,
// głos w urnie, otwarta księga Kroniki, gwiazdka oceny, plus Półki,
// strzałka powrotu, kosz dla akcji destrukcyjnej.
const iconPaths: Record<ActionVariant, string> = {
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

export function ActionIcon({ action }: { action: ActionVariant }) {
  return (
    <svg
      className="action-btn-icon"
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

/*
 * Etykieta zostaje w przepływie także podczas ładowania (chowana samym
 * visibility), więc szerokość przycisku się nie zmienia.
 */
export function ActionBody({
  action,
  withIcon,
  loading,
  loadingLabel,
  children,
}: {
  action: ActionVariant;
  withIcon: boolean;
  loading: boolean;
  loadingLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span
        className={
          loading
            ? "action-btn-label action-btn-label-hidden"
            : "action-btn-label"
        }
      >
        {withIcon ? <ActionIcon action={action} /> : null}
        <span>{children}</span>
      </span>
      {loading ? (
        <>
          <span className="action-btn-spinner" aria-hidden="true" />
          {loadingLabel ? (
            <span className="sr-only">{loadingLabel}</span>
          ) : null}
        </>
      ) : null}
    </>
  );
}

type SharedProps = {
  action: ActionVariant;
  size?: ActionSize;
  emphasis?: ActionEmphasis;
  pill?: boolean;
  withIcon?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function ActionButton({
  action,
  size,
  emphasis,
  pill,
  withIcon = true,
  fullWidth,
  loading = false,
  loadingLabel,
  className,
  children,
  ...props
}: SharedProps &
  Omit<React.ComponentPropsWithoutRef<"button">, "className" | "children"> & {
    loading?: boolean;
    loadingLabel?: string;
  }) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={actionButtonClasses({
        action,
        size,
        emphasis,
        pill,
        fullWidth,
        className,
      })}
    >
      <ActionBody
        action={action}
        withIcon={withIcon}
        loading={loading}
        loadingLabel={loadingLabel}
      >
        {children}
      </ActionBody>
    </button>
  );
}

export function ActionLink({
  action,
  size,
  emphasis,
  pill,
  withIcon = true,
  fullWidth,
  className,
  children,
  ...props
}: SharedProps & React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={actionButtonClasses({
        action,
        size,
        emphasis,
        pill,
        fullWidth,
        className,
      })}
    >
      <ActionBody action={action} withIcon={withIcon} loading={false}>
        {children}
      </ActionBody>
    </Link>
  );
}
