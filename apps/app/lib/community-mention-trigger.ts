/**
 * Detecção do gatilho de menção, compartilhada pelo campo de comentário
 * (textarea) e pelo editor de texto (TipTap).
 *
 * Regras:
 * - o gatilho é um `@` no começo da linha ou depois de espaço;
 * - o texto entre o `@` e o cursor (até 30 caracteres de nome) é a busca;
 * - cada `@` é um gatilho próprio: um `@` abandonado vira texto comum e nunca
 *   impede que o próximo abra a lista;
 * - `Esc` descarta só aquele `@` (ver `isDismissedMention`): digitar mais
 *   letras nele não reabre a lista, mas o próximo `@` abre.
 */
export const mentionQueryMaxLength = 30;

const mentionTriggerPattern = /(?:^|\s)@([\p{L}\p{N}_.-]{0,30})$/u;

/** Marca de uma menção já confirmada (átomo) no texto antes do cursor. */
export const mentionAtomPlaceholder = "￼";

export interface MentionTrigger {
  /** Texto digitado depois do `@`. */
  readonly query: string;
  /** Posição do `@` em `textBeforeCursor`. */
  readonly start: number;
}

/**
 * @param textBeforeCursor texto da linha até o cursor. Quebras de linha contam
 * como espaço; menções já confirmadas devem aparecer como
 * `mentionAtomPlaceholder` para não colar um `@` novo nelas.
 */
export const detectMentionTrigger = (
  textBeforeCursor: string
): MentionTrigger | null => {
  const match = mentionTriggerPattern.exec(textBeforeCursor);
  if (!match) {
    return null;
  }
  const query = match[1] ?? "";
  return {
    query,
    start: textBeforeCursor.length - query.length - 1,
  };
};

/**
 * `dismissedAt` guarda onde ficou o último `@` fechado com Esc. Enquanto o
 * gatilho atual estiver na mesma posição, continua fechado; qualquer outro
 * gatilho (ou a ausência de gatilho) volta a abrir normalmente.
 */
export const isDismissedMention = (
  position: number | null,
  dismissedAt: number | null
) => position !== null && dismissedAt === position;
