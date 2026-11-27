export type ExerciseCoverTheme =
  | "pbe"
  | "bioestatistica"
  | "epidemiologia"
  | "generico";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/gu, "").toLowerCase();

const VOLUME_PATTERN = /\bvol(?:ume|\.)?\s*(iii|ii|i|3|2|1)\b/u;

const VOLUMES: Record<string, string> = {
  "1": "vol-i",
  "2": "vol-ii",
  "3": "vol-iii",
  i: "vol-i",
  ii: "vol-ii",
  iii: "vol-iii",
};

export const exerciseCoverTheme = (
  title: string,
  bankTitle: string,
  slug: string
): ExerciseCoverTheme => {
  const value = normalize(`${title} ${bankTitle} ${slug}`);
  if (
    value.includes("pratica baseada em evidencia") ||
    value.includes("pico")
  ) {
    return "pbe";
  }
  if (value.includes("bioestatistica")) {
    return "bioestatistica";
  }
  if (value.includes("epidemiologia")) {
    return "epidemiologia";
  }
  return "generico";
};

/** "Vol. II", "volume 2"… no título ou no endereço da lista; senão, sem volume. */
export const exerciseCoverVolume = (title: string, slug: string) => {
  const match = VOLUME_PATTERN.exec(
    normalize(`${title} ${slug.replace(/-/gu, " ")}`)
  );
  return (match?.[1] && VOLUMES[match[1]]) || "sem-volume";
};

export const exerciseCoverSrc = (
  title: string,
  bankTitle: string,
  slug: string
) =>
  `/exercises/capas/${exerciseCoverTheme(title, bankTitle, slug)}-${exerciseCoverVolume(title, slug)}.webp`;
