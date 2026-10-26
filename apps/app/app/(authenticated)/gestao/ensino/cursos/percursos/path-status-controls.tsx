import { randomUUID } from "node:crypto";
import { ContentStatus } from "@repo/database";
import { changeGestaoLearningPathStatus } from "./actions";
import { PathSubmitButton } from "./path-submit-button";

const transitions = {
  [ContentStatus.DRAFT]: [
    [ContentStatus.PUBLISHED, "Publicar percurso"],
    [ContentStatus.ARCHIVED, "Arquivar rascunho"],
  ],
  [ContentStatus.PUBLISHED]: [
    [ContentStatus.DRAFT, "Retirar do ar"],
    [ContentStatus.ARCHIVED, "Arquivar percurso"],
  ],
  [ContentStatus.ARCHIVED]: [[ContentStatus.DRAFT, "Restaurar como rascunho"]],
} as const;

const confirmMessageFor = (status: ContentStatus) => {
  switch (status) {
    case ContentStatus.PUBLISHED:
      return "Este percurso passa a ficar visível para os alunos.";
    case ContentStatus.ARCHIVED:
      return "O percurso deixa de aparecer para os alunos. Os cursos continuam existindo.";
    case ContentStatus.DRAFT:
      return "O percurso deixa de aparecer para os alunos e volta a ser rascunho.";
    default:
      return "Confirma a alteração?";
  }
};

export const LearningPathStatusControls = ({
  path,
  page,
}: {
  readonly path: {
    readonly id: string;
    readonly status: ContentStatus;
    readonly updatedAt: Date;
  };
  readonly page: number;
}) => (
  <div className="ge-path-status-controls">
    {transitions[path.status].map(([status, label]) => (
      <form action={changeGestaoLearningPathStatus} key={status}>
        <input name="pathId" type="hidden" value={path.id} />
        <input name="page" type="hidden" value={page} />
        <input name="nextStatus" type="hidden" value={status} />
        <input
          name="expectedUpdatedAt"
          type="hidden"
          value={path.updatedAt.toISOString()}
        />
        <input name="idempotencyKey" type="hidden" value={randomUUID()} />
        <input name="confirmStatusChange" type="hidden" value="on" />
        <PathSubmitButton
          confirmText={confirmMessageFor(status)}
          confirmTitle={`${label}?`}
          label={label}
          pendingLabel="Atualizando…"
          variant={status === ContentStatus.PUBLISHED ? "default" : "outline"}
        />
      </form>
    ))}
  </div>
);
