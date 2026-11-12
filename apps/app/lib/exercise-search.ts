const COMBINING_MARKS = /[̀-ͯ]/gu;
const WHITESPACE = /\s+/u;

/** Minúsculas e sem acentos: "Bioestatística" e "bioestatistica" ficam iguais. */
export const foldSearchText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLocaleLowerCase("pt-BR");

/** Palavras da busca (sem acento, em minúsculas). Todas precisam aparecer. */
export const exerciseSearchTerms = (query?: string | null): string[] =>
  foldSearchText((query ?? "").slice(0, 100))
    .split(WHITESPACE)
    .filter(Boolean);

interface ExerciseListSearchFields {
  readonly bankTitle: string;
  readonly description: string | null;
  /** Categorias e tags das questões publicadas da lista. */
  readonly extras: readonly string[];
  readonly title: string;
}

const includesAll = (text: string, terms: readonly string[]) =>
  terms.every((term) => text.includes(term));

/**
 * Pontua uma lista para a busca: `null` se alguma palavra não aparece em lugar
 * nenhum; 2 se todas aparecem no título; 1 se aparecem no título ou no banco;
 * 0 se só aparecem na descrição, categorias ou tags.
 */
export const exerciseListSearchScore = (
  list: ExerciseListSearchFields,
  terms: readonly string[]
): number | null => {
  if (terms.length === 0) {
    return 0;
  }
  const title = foldSearchText(list.title);
  const bank = foldSearchText(list.bankTitle);
  const everything = [
    title,
    bank,
    foldSearchText(list.description ?? ""),
    ...list.extras.map(foldSearchText),
  ].join(" \n ");
  if (!includesAll(everything, terms)) {
    return null;
  }
  if (includesAll(title, terms)) {
    return 2;
  }
  return includesAll(`${title} ${bank}`, terms) ? 1 : 0;
};

/**
 * Remove categorias repetidas (mesmo nome, ignorando caixa e acento), mantendo
 * a primeira. Bancos diferentes podem ter a mesma categoria e a pessoa só quer
 * ver "Bioestatística" uma vez.
 */
export const dedupeExerciseCategories = <T extends { readonly title: string }>(
  categories: readonly T[]
): T[] => {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const category of categories) {
    const key = foldSearchText(category.title.trim());
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(category);
    }
  }
  return unique;
};
