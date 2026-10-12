export type CorrectionResultCode =
  | "comment-required"
  | "comment-too-long"
  | "conflito"
  | "dados-invalidos"
  | "feedback-enviado"
  | "nao-encontrada"
  | "rascunho-salvo"
  | "score-invalid"
  | "scores-required";

export interface CorrectionActionState {
  readonly code?: CorrectionResultCode;
  readonly fieldErrors?: {
    readonly content?: string;
    readonly scores?: string;
  };
  readonly href?: string;
  readonly status: "idle" | "error" | "success";
}

export const correctionResultMessages: Readonly<
  Record<CorrectionResultCode, string>
> = {
  "feedback-enviado": "Feedback enviado. A entrega foi marcada como corrigida.",
  "rascunho-salvo": "Rascunho salvo. O aluno ainda não recebeu este feedback.",
  conflito:
    "Outra pessoa atualizou esta correção. Recarregue a versão atual antes de continuar.",
  "comment-required": "Escreva um comentário antes de enviar o feedback.",
  "scores-required": "Atribua uma nota para cada critério antes de enviar.",
  "score-invalid": "Use notas inteiras de 0 a 10 nos critérios da rubrica.",
  "comment-too-long": "O comentário pode ter até 20 mil caracteres.",
  "dados-invalidos": "Revise os dados da correção e tente novamente.",
  "nao-encontrada": "Esta entrega não está disponível para seu perfil.",
};
