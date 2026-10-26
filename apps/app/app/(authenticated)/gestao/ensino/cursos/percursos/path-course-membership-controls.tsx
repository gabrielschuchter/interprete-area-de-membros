import { randomUUID } from "node:crypto";
import { ContentStatus } from "@repo/database";
import { GestaoIcon } from "../../../gestao-icon";
import {
  addGestaoLearningPathCourse,
  removeGestaoLearningPathCourse,
} from "./actions";
import { PathSubmitButton } from "./path-submit-button";

interface PathVersion {
  readonly id: string;
  readonly status: ContentStatus;
  readonly updatedAt: Date;
}

const PublishedChangeConfirmation = ({
  status,
}: {
  readonly status: ContentStatus;
}) =>
  status === ContentStatus.PUBLISHED ? (
    <input name="confirmPublishedChange" type="hidden" value="on" />
  ) : null;

export const AddPathCourseControl = ({
  course,
  page,
  path,
}: {
  readonly course: {
    readonly id: string;
    readonly title: string;
    readonly updatedAt: Date;
  };
  readonly page: number;
  readonly path: PathVersion;
}) => (
  <form
    action={addGestaoLearningPathCourse}
    className="ge-path-add-course-form"
  >
    <input name="pathId" type="hidden" value={path.id} />
    <input name="courseId" type="hidden" value={course.id} />
    <input name="page" type="hidden" value={page} />
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
    <input name="idempotencyKey" type="hidden" value={randomUUID()} />
    <PublishedChangeConfirmation status={path.status} />
    <PathSubmitButton
      ariaLabel={`Adicionar ${course.title} ao percurso`}
      confirmText={
        path.status === ContentStatus.PUBLISHED
          ? "O curso passa a aparecer neste percurso para os alunos agora."
          : undefined
      }
      confirmTitle="Adicionar ao percurso publicado?"
      label="Adicionar"
      pendingLabel="Adicionando…"
    />
  </form>
);

export const RemovePathCourseControl = ({
  course,
  page,
  path,
}: {
  readonly course: {
    readonly id: string;
    readonly title: string;
    readonly updatedAt: Date;
  };
  readonly page: number;
  readonly path: PathVersion;
}) => (
  <form
    action={removeGestaoLearningPathCourse}
    className="ge-path-remove-course-form"
  >
    <input name="pathId" type="hidden" value={path.id} />
    <input name="courseId" type="hidden" value={course.id} />
    <input name="page" type="hidden" value={page} />
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
    <input name="idempotencyKey" type="hidden" value={randomUUID()} />
    <PublishedChangeConfirmation status={path.status} />
    <PathSubmitButton
      ariaLabel={`Tirar ${course.title} do percurso`}
      className="ge-path-remove-course"
      confirmText={
        path.status === ContentStatus.PUBLISHED
          ? "O curso deixa de aparecer neste percurso para os alunos agora. O curso em si não é apagado."
          : undefined
      }
      confirmTitle={`Tirar ${course.title} do percurso?`}
      icon={<GestaoIcon name="x" size={16} />}
      label="×"
      pendingLabel="…"
      size="icon"
      title="Tirar do percurso"
      variant="outline"
    />
  </form>
);
