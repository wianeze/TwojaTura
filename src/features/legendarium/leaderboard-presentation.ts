const podiumRankAssets: Record<number, string> = {
  1: "/brand/1st-place-nobg.png",
  2: "/brand/2nd-place-nobg.png",
  3: "/brand/3rd-place-nobg.png",
  4: "/brand/4th-place-nobg.png",
  5: "/brand/5th-place-nobg.png",
};

export function getLeaderboardRankAsset(rank: number) {
  if (podiumRankAssets[rank]) return podiumRankAssets[rank];

  if (rank >= 6 && rank <= 20) {
    return `/brand/player${rank}.png`;
  }

  return null;
}

export function getLeaderboardRankLabel(rank: number) {
  return `${rank}. miejsce`;
}

const classBackdropColors: Record<string, [string, string]> = {
  bard_stolu: ["139, 92, 246", "76, 29, 149"],
  barbarzynca_kosci: ["220, 38, 38", "127, 29, 29"],
  czarodziej_analizy: ["59, 130, 246", "30, 64, 175"],
  czarownik_chaosu: ["185, 28, 28", "127, 29, 29"],
  druid_polki: ["34, 197, 94", "21, 128, 61"],
  kleryk_druzyny: ["250, 204, 21", "202, 138, 4"],
  lotrzyk_kart: ["20, 20, 24", "74, 56, 72"],
  lowca_lupow: ["101, 163, 13", "63, 98, 18"],
  mnich_cierpliwosci: ["255, 255, 255", "203, 213, 225"],
  multiclass_planszy: ["249, 115, 22", "194, 65, 12"],
  nekromanta_figurek: ["20, 184, 166", "13, 148, 136"],
  paladyn_zasad: ["255, 255, 255", "226, 232, 240"],
  warlock_meeplow: ["147, 51, 234", "88, 28, 135"],
  wojownik_stolu: ["146, 64, 14", "92, 45, 15"],
};

export function getActiveClassBackdropGradient(classKey: string | null) {
  const [primary, secondary] = (classKey
    ? classBackdropColors[classKey]
    : undefined) ?? ["238, 193, 118", "132, 78, 38"];

  return `radial-gradient(circle at center, rgba(${primary}, 0.68) 0%, rgba(${secondary}, 0.32) 47%, transparent 74%)`;
}

/*
  Tekstura klasy dla tła nawigacji. Kluczem jest `class_key` z bazy, a nie nazwa
  klasy — nazwy mają polskie znaki i spacje, więc jako nazwy plików byłyby
  kruche. Ten sam zestaw kluczy co w classBackdropColors powyżej.
*/
const classTextures: Record<string, string> = {
  bard_stolu: "/textures/bard-texture.png",
  barbarzynca_kosci: "/textures/barbarzynca-texture.png",
  czarodziej_analizy: "/textures/czarodziej-texture.png",
  czarownik_chaosu: "/textures/czarownik-texture.png",
  druid_polki: "/textures/druid-texture.png",
  // Świadomie kleryk-texture.png, nie kleryk-texture2.png — ta druga czeka na
  // własne zastosowanie.
  kleryk_druzyny: "/textures/kleryk-texture.png",
  lotrzyk_kart: "/textures/lotrzyk-texture.png",
  lowca_lupow: "/textures/lowca-texture.png",
  mnich_cierpliwosci: "/textures/mnich-texture.png",
  multiclass_planszy: "/textures/multiclass-texture.png",
  nekromanta_figurek: "/textures/nekromanta-texture.png",
  paladyn_zasad: "/textures/paladyn-texture.png",
  warlock_meeplow: "/textures/warlock-texture.png",
  wojownik_stolu: "/textures/wojownik-texture.png",
};

/** null = brak klasy albo klucz bez tekstury → nawigacja zostaje na gołym tle. */
export function getActiveClassTexture(classKey: string | null) {
  if (!classKey) return null;
  return classTextures[classKey] ?? null;
}
