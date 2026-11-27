export type ExerciseCoverTheme =
  | "pbe"
  | "bioestatistica"
  | "epidemiologia"
  | "generico";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/gu, "").toLowerCase();

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

/** Cor de fundo e texto da etiqueta de cada coleção. */
export const exerciseCoverThemes: Record<
  ExerciseCoverTheme,
  { readonly background: string; readonly label: string }
> = {
  pbe: { background: "#693857", label: "Prática baseada em evidências" },
  bioestatistica: { background: "#480B37", label: "Bioestatística" },
  epidemiologia: { background: "#901D3C", label: "Epidemiologia" },
  generico: { background: "#731731", label: "Caderno de prática" },
};

const ROMAN: ReadonlyArray<readonly [number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export const toRoman = (value: number) => {
  let rest = Math.max(1, Math.floor(value));
  let out = "";
  for (const [size, symbol] of ROMAN) {
    while (rest >= size) {
      out += symbol;
      rest -= size;
    }
  }
  return out;
};

export const exerciseVolumeLabel = (volume: number) =>
  `Vol. ${toRoman(volume)}`;

/**
 * Volume de cada lista = posição dela entre as listas do mesmo tema, na ordem
 * recebida (a primeira lista de PBE é Vol. I, a primeira de Epidemiologia
 * também). Mapa por endereço da lista.
 */
export const rankExerciseListVolumes = (
  lists: ReadonlyArray<{
    readonly bankTitle: string;
    readonly slug: string;
    readonly title: string;
  }>
) => {
  const counters = new Map<ExerciseCoverTheme, number>();
  const volumes = new Map<string, number>();
  for (const list of lists) {
    const theme = exerciseCoverTheme(list.title, list.bankTitle, list.slug);
    const next = (counters.get(theme) ?? 0) + 1;
    counters.set(theme, next);
    volumes.set(list.slug, next);
  }
  return volumes;
};
