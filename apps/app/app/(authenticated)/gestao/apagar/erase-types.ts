import type { ReactNode } from "react";
import type { eraseGestaoRecord } from "./actions";

export type GestaoEraseKind = Parameters<typeof eraseGestaoRecord>[0]["kind"];

export interface GestaoEraseProperties {
  /** Recebe a função que abre a confirmação; desenha o gatilho. */
  readonly children: (open: () => void) => ReactNode;
  /** O que se perde junto, em uma frase. */
  readonly consequence: string;
  readonly id: string;
  readonly kind: GestaoEraseKind;
  /** Rótulo do tipo, no singular: "curso", "turma", "aula". */
  readonly noun: string;
  /** Para onde ir depois de apagar; sem ele, a página atual é atualizada. */
  readonly redirectTo?: string;
  readonly title: string;
}
