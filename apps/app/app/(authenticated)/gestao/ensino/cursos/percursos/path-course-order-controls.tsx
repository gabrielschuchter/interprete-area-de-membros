import { randomUUID } from "node:crypto";
import { ContentStatus } from "@repo/database";
import { moveGestaoLearningPathCourse } from "./actions";
import { PathSubmitButton } from "./path-submit-button";

export const PathCourseOrderControl = ({
  course,
  direction,
  neighbor,
  page,
  path,
}: {
  readonly course: {
    readonly id: string;
    readonly updatedAt: Date;
  };
  readonly direction: "up" | "down";
  readonly neighbor: {
    readonly id: string;
    readonly updatedAt: Date;
  };
  readonly page: number;
  readonly path: {
    readonly id: string;
    readonly status: ContentStatus;
    readonly updatedAt: Date;
  };
}) => (
  <form action={moveGestaoLearningPathCourse} className="ge-path-order-form">
    <input name="pathId" type="hidden" value={path.id} />
    <input name="courseId" type="hidden" value={course.id} />
    <input name="neighborId" type="hidden" value={neighbor.id} />
    <input name="page" type="hidden" value={page} />
    <input name="direction" type="hidden" value={direction} />
    <input
      name="expectedPathUpdatedAt"
      type="hidden"
      value={path.updatedAt.toISOString()}
    />
    <input
      name="expectedCourseUpdatedAt"
      type="hidden"
      value={course.updatedAt.toISOString()}
    />
    <input
      name="expectedNeighborUpdatedAt"
      type="hidden"
      value={neighbor.updatedAt.toISOString()}
    />
    <input name="idempotencyKey" type="hidden" value={randomUUID()} />
    {path.status === ContentStatus.PUBLISHED ? (
      <label className="ge-path-order-confirm">
        <input name="confirmPublishedChange" required type="checkbox" />
        <span>Confirmo que a ordem pode mudar para os alunos agora.</span>
      </label>
    ) : null}
    <PathSubmitButton
      ariaLabel={
        direction === "up" ? "Mover curso para cima" : "Mover curso para baixo"
      }
      label={direction === "up" ? "Subir" : "Descer"}
      pendingLabel="Salvando…"
    />
  </form>
);
