import { randomUUID } from "node:crypto";
import { ContentStatus } from "@repo/database";
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
  text,
}: {
  readonly status: ContentStatus;
  readonly text: string;
}) =>
  status === ContentStatus.PUBLISHED ? (
    <label className="ge-path-membership-confirm">
      <input name="confirmPublishedChange" required type="checkbox" />
      <span>{text}</span>
    </label>
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
    <PublishedChangeConfirmation
      status={path.status}
      text="Confirmo a inclusão visível para os alunos agora."
    />
    <PathSubmitButton
      ariaLabel={`Adicionar ${course.title} ao percurso`}
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
    {path.status === ContentStatus.PUBLISHED ? (
      <details className="ge-path-remove-confirm">
        <summary
          aria-label={`Abrir confirmação para tirar ${course.title} do percurso`}
          className="ge-path-remove-course"
          title="Tirar do percurso"
        >
          <span aria-hidden="true">×</span>
        </summary>
        <div className="ge-path-remove-confirm-popover">
          <PublishedChangeConfirmation
            status={path.status}
            text="Confirmo a remoção visível para os alunos agora."
          />
          <PathSubmitButton
            label="Confirmar remoção"
            pendingLabel="Removendo…"
          />
        </div>
      </details>
    ) : (
      <PathSubmitButton
        ariaLabel={`Tirar ${course.title} do percurso`}
        className="ge-path-remove-course"
        label="×"
        pendingLabel="…"
        size="icon"
        title="Tirar do percurso"
        variant="outline"
      />
    )}
  </form>
);
