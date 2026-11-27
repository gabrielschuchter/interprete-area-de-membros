/**
 * Vínculos de estudo entre aula, lista de exercícios e material da Biblioteca.
 * Regras puras (sem banco): cada vínculo liga dois conteúdos de tipos
 * diferentes e vale nos dois sentidos.
 */

export const linkSides = ["lesson", "exerciseList", "libraryItem"] as const;
export type LinkSide = (typeof linkSides)[number];

export interface LinkRef {
  readonly id: string;
  readonly side: LinkSide;
}

export const linkSideLabels: Record<LinkSide, string> = {
  lesson: "Aula",
  exerciseList: "Lista de exercícios",
  libraryItem: "Material",
};

export const linkColumn = {
  lesson: "lessonId",
  exerciseList: "exerciseListId",
  libraryItem: "libraryItemId",
} as const satisfies Record<LinkSide, string>;

export const isLinkSide = (value: unknown): value is LinkSide =>
  typeof value === "string" && (linkSides as readonly string[]).includes(value);

export interface LinkColumns {
  exerciseListId?: string;
  lessonId?: string;
  libraryItemId?: string;
}

/**
 * Colunas da linha de vínculo para o par (a, b), ou `null` quando o par não
 * é válido: mesmo tipo dos dois lados ou algum id vazio.
 */
export const linkColumns = (a: LinkRef, b: LinkRef): LinkColumns | null => {
  if (a.side === b.side || !(a.id && b.id)) {
    return null;
  }
  return { [linkColumn[a.side]]: a.id, [linkColumn[b.side]]: b.id };
};
