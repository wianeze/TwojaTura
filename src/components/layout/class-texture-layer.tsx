import { getActiveClassTexture } from "@/config/class-textures";

/*
  Tekstura aktywnej klasy jako tło nawigacji — jedna warstwa dla sidebara i dla
  mobilnego paska, żeby oba miały to samo krycie i to samo przyciemnienie.

  Dlaczego osobne warstwy, a nie `opacity` na kontenerze: krycie na <aside> albo
  <header> osłabiłoby też tekst, ikony i logo. Tutaj półprzezroczysta jest sama
  tekstura, a treść nawigacji zostaje w pełni kryjąca.

  Obie warstwy siedzą na `-z-10`, więc malują się nad własnym tłem kontenera, a
  pod jego treścią. Wymaga to konteksu układania na rodzicu — na sidebarze robi
  go `isolate`, na mobilnym pasku istniejące `relative z-10`. Bez tego ujemny
  z-index schowałby teksturę pod tłem strony.

  Kolejność w DOM jest znacząca: przyciemnienie jest drugie, więc przy równym
  z-index maluje się nad teksturą i przywraca kontrast pod jasnym tekstem menu.
*/
export function ClassTextureLayer({
  classKey,
  className = "",
}: {
  classKey: string | null;
  className?: string;
}) {
  const texture = getActiveClassTexture(classKey);
  if (!texture) return null;

  return (
    <>
      <span
        aria-hidden="true"
        style={{ backgroundImage: `url("${texture}")` }}
        className={`pointer-events-none absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-50 ${className}`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(26,15,10,0.42),rgba(26,15,10,0.58))]"
      />
    </>
  );
}
