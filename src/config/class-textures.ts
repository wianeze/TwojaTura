import barbarianTexture from "../../public/textures/barbarzynca-texture.webp";
import bardTexture from "../../public/textures/bard-texture.webp";
import wizardTexture from "../../public/textures/czarodziej-texture.webp";
import sorcererTexture from "../../public/textures/czarownik-texture.webp";
import druidTexture from "../../public/textures/druid-texture.webp";
import clericTexture from "../../public/textures/kleryk-texture.webp";
import rogueTexture from "../../public/textures/lotrzyk-texture.webp";
import hunterTexture from "../../public/textures/lowca-texture.webp";
import monkTexture from "../../public/textures/mnich-texture.webp";
import multiclassTexture from "../../public/textures/multiclass-texture.webp";
import necromancerTexture from "../../public/textures/nekromanta-texture.webp";
import paladinTexture from "../../public/textures/paladyn-texture.webp";
import warlockTexture from "../../public/textures/warlock-texture.webp";
import warriorTexture from "../../public/textures/wojownik-texture.webp";

const classTextures: Record<string, string> = {
  bard_stolu: bardTexture.src,
  barbarzynca_kosci: barbarianTexture.src,
  czarodziej_analizy: wizardTexture.src,
  czarownik_chaosu: sorcererTexture.src,
  druid_polki: druidTexture.src,
  kleryk_druzyny: clericTexture.src,
  lotrzyk_kart: rogueTexture.src,
  lowca_lupow: hunterTexture.src,
  mnich_cierpliwosci: monkTexture.src,
  multiclass_planszy: multiclassTexture.src,
  nekromanta_figurek: necromancerTexture.src,
  paladyn_zasad: paladinTexture.src,
  warlock_meeplow: warlockTexture.src,
  wojownik_stolu: warriorTexture.src,
};

export function getActiveClassTexture(classKey: string | null) {
  if (!classKey) return null;
  return classTextures[classKey] ?? null;
}
