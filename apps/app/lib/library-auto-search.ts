/** Pausa depois da última tecla antes de buscar sozinho na Biblioteca. */
export const LIBRARY_AUTO_SEARCH_DELAY_MS = 400;

/**
 * Decide o que buscar quando a pessoa para de digitar. Devolve o termo a
 * aplicar (vazio limpa a busca) ou `null` quando não há o que fazer: o termo é
 * o mesmo que já está aplicado, ou é uma letra só (ainda cedo para buscar).
 */
export const libraryAutoSearchTarget = (
  typed: string,
  applied: string
): string | null => {
  const next = typed.trim();
  if (next === applied.trim()) {
    return null;
  }
  if (next.length === 1) {
    return null;
  }
  return next;
};
