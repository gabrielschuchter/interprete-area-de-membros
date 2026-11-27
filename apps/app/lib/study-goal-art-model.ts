import type { CountGoalKind } from "./study-count-goals-model";

/** Quantas peças cada ilustração mostra no máximo (furos, livros, bolinhas). */
export const GOAL_ART_MAX_CELLS: Record<CountGoalKind, number> = {
  LESSONS: 30,
  READINGS: 12,
  EXERCISES: 50,
};

/** Peças mostradas enquanto a pessoa ainda não definiu a meta. */
const EMPTY_CELLS: Record<CountGoalKind, number> = {
  LESSONS: 6,
  READINGS: 5,
  EXERCISES: 20,
};

export interface GoalArtModel {
  /** Total de peças desenhadas. */
  readonly cells: number;
  /** Peças com progresso (furos marcados, livros lidos, bolinhas cheias). */
  readonly filled: number;
  /** Quanto vale cada peça; 1 quando a meta cabe inteira no desenho. */
  readonly perCell: number;
}

/**
 * Converte o progresso (feito / meta) em peças do desenho. Metas maiores que o
 * limite do desenho são agrupadas: cada peça passa a valer `perCell`. Só enche
 * todas as peças quando a meta foi batida de verdade.
 */
export const goalArtModel = (
  kind: CountGoalKind,
  studied: number,
  target: number
): GoalArtModel => {
  if (!(target > 0)) {
    return { filled: 0, cells: EMPTY_CELLS[kind], perCell: 1 };
  }
  const cells = Math.min(target, GOAL_ART_MAX_CELLS[kind]);
  if (studied >= target) {
    return { filled: cells, cells, perCell: Math.ceil(target / cells) };
  }
  const filled = Math.min(
    cells - 1,
    Math.max(0, Math.floor((studied * cells) / target))
  );
  return { filled, cells, perCell: Math.ceil(target / cells) };
};
