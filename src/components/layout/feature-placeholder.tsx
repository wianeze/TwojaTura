import { NavigationIcon, type NavigationIconName } from "./navigation-icon";
import { Panel } from "@/components/ui/panel";

type FeaturePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: NavigationIconName;
};

export function FeaturePlaceholder({
  eyebrow,
  title,
  description,
  icon,
}: FeaturePlaceholderProps) {
  return (
    <div className="space-y-7">
      <header className="max-w-3xl">
        <p className="text-xs font-bold tracking-[0.18em] text-[#e3ae67] uppercase">
          {eyebrow}
        </p>
        <h1 className="font-display text-cream mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#d8c7b5] sm:text-lg">
          {description}
        </p>
      </header>

      <Panel className="paper-wash grid min-h-72 place-items-center p-8 text-center">
        <div className="max-w-md">
          <span className="bg-brand-soft text-brand ring-brand/10 mx-auto grid size-15 place-items-center rounded-2xl ring-1">
            <NavigationIcon name={icon} className="size-7" />
          </span>
          <h2 className="font-display mt-5 text-2xl font-semibold">
            Miejsce jest gotowe
          </h2>
          <p className="text-muted mt-2 text-sm leading-6">
            To statyczna scena przygotowana pod przyszłe dane. Funkcje tej
            sekcji zostaną podłączone w kolejnych etapach.
          </p>
        </div>
      </Panel>
    </div>
  );
}
