const INTRO = /^.*?\bsobre\s+/i;
const SEPARATOR = /\s*,\s*|\s+e\s+/;
const TRAILING = /[\s.…]+$/;

/**
 * Transforma "Dez questões autorais sobre perguntas clínicas, busca e desenhos"
 * em ["perguntas clínicas", "busca", "desenhos"]. Sem o "sobre", não dá para
 * separar tema de frase: devolve null e o chamador mostra o texto como está.
 */
export const exerciseListTags = (
  description: string | null
): string[] | null => {
  if (!(description && INTRO.test(description))) {
    return null;
  }
  const tags = description
    .replace(INTRO, "")
    .replace(TRAILING, "")
    .split(SEPARATOR)
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : null;
};
