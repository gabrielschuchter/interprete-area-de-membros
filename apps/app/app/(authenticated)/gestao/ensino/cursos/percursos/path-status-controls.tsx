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
      return "Confirmo que este percurso ficará visível para os alunos.";
    case ContentStatus.ARCHIVED:
      return "Confirmo que o percurso será arquivado para os alunos.";
    case ContentStatus.DRAFT:
      return "Confirmo que o percurso ficará como rascunho.";
    default:
      return "Confirmo a alteração.";
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
        <label className="ge-path-confirm">
          <input name="confirmStatusChange" required type="checkbox" />
          <span>{confirmMessageFor(status)}</span>
        </label>
        <PathSubmitButton
          label={label}
          pendingLabel="Atualizando…"
          variant={status === ContentStatus.PUBLISHED ? "default" : "outline"}
        />
      </form>
    ))}
  </div>
);
