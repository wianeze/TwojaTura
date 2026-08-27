import { ActionLink } from "@/components/ui/action-button";

export function AdminPageHeader({
  eyebrow = "Zarządzanie grupą",
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header>
      <p className="text-xs font-bold tracking-[0.2em] text-[#e3ae67] uppercase">
        {eyebrow}
      </p>
      <h1 className="font-display text-cream mt-1.5 text-4xl font-semibold tracking-tight drop-shadow-[0_2px_12px_rgba(20,10,7,0.32)] sm:text-[2.8rem]">
        {title}
      </h1>
      {description ? (
        <p className="text-cream/80 mt-2 max-w-2xl text-sm">{description}</p>
      ) : null}
      <ActionLink
        action="neutral"
        size="compact"
        emphasis="secondary"
        href="/admin"
        className="mt-3"
      >
        Panel administratora
      </ActionLink>
    </header>
  );
}
