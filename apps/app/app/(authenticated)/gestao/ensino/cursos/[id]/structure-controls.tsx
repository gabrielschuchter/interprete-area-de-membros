"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { GestaoIcon } from "../../../gestao-icon";
import {
  addGestaoLesson,
  addGestaoModule,
  duplicateGestaoItem,
  moveGestaoItem,
  renameGestaoModule,
  type StructureResult,
  setGestaoLessonState,
  setGestaoModuleStatus,
} from "./structure-actions";

interface MenuProperties {
  readonly canMoveDown: boolean;
  readonly canMoveUp: boolean;
  readonly editHref?: string;
  readonly id: string;
  readonly kind: "module" | "lesson";
  readonly moduleDescription?: string | null;
  readonly moduleTitle?: string;
  readonly status: string;
  readonly title: string;
}

export const MenuNote = ({
  message,
  onDismiss,
}: {
  readonly message: string;
  readonly onDismiss: () => void;
}) => (
  <output className="gk-menu-note">
    {message}
    <button aria-label="Fechar aviso" onClick={onDismiss} type="button">
      <GestaoIcon name="x" size={12} />
    </button>
  </output>
);

const run = (
  action: (formData: FormData) => Promise<StructureResult>,
  fields: Record<string, string>
) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return action(formData);
};

const ModuleEditDialog = ({
  description,
  id,
  onClose,
  title,
}: {
  readonly description: string;
  readonly id: string;
  readonly onClose: () => void;
  readonly title: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await renameGestaoModule(formData);
      if (result.ok) {
        onClose();
      } else {
        setError(result.message);
      }
    });
  };
  return (
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent
        className="gk-modal"
        overlayClassName="gk-overlay"
        showCloseButton={false}
      >
        <form className="gk-modal-body" onSubmit={submit}>
          <DialogTitle className="gk-modal-title">Editar módulo</DialogTitle>
          <DialogDescription className="gk-modal-copy">
            O título aparece para os alunos na lista de aulas do curso.
          </DialogDescription>
          <input name="moduleId" type="hidden" value={id} />
          <label className="gk-label">
            <span>Título do módulo</span>
            <input
              className="gk-input"
              defaultValue={title}
              maxLength={160}
              name="title"
              required
            />
          </label>
          <label className="gk-label">
            <span>Descrição (opcional)</span>
            <textarea
              className="gk-input gk-textarea"
              defaultValue={description}
              maxLength={600}
              name="description"
              rows={3}
            />
          </label>
          {error ? (
            <p className="gk-error-box" role="alert">
              {error}
            </p>
          ) : null}
          <div className="gk-modal-actions">
            <button className="gk-btn" onClick={onClose} type="button">
              Cancelar
            </button>
            <button
              className="gk-btn gk-btn--primary"
              disabled={pending}
              type="submit"
            >
              {pending ? "Salvando…" : "Salvar módulo"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const StructureMenu = ({
  canMoveDown,
  canMoveUp,
  editHref,
  id,
  kind,
  moduleDescription,
  moduleTitle,
  status,
  title,
}: MenuProperties) => {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const noun = kind === "module" ? "módulo" : "aula";

  const perform = (
    action: (formData: FormData) => Promise<StructureResult>,
    fields: Record<string, string>
  ) => {
    setNote(null);
    startTransition(async () => {
      const result = await run(action, { id, kind, ...fields });
      if (result.ok) {
        router.refresh();
      } else {
        setNote(result.message);
      }
    });
  };
  const changeStatus = (next: "PUBLISHED" | "ARCHIVED") =>
    perform(kind === "module" ? setGestaoModuleStatus : setGestaoLessonState, {
      status: next,
    });

  return (
    <span className="gk-menu-anchor">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Mais ações do ${noun} ${title}`}
            className="gk-icon-btn gk-icon-btn--bare"
            type="button"
          >
            <GestaoIcon name="dots" size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="gk-menu">
          {kind === "module" ? (
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              Editar módulo
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => editHref && router.push(editHref)}
            >
              Abrir editor da aula
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={!canMoveUp}
            onSelect={() => perform(moveGestaoItem, { direction: "up" })}
          >
            Mover para cima
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canMoveDown}
            onSelect={() => perform(moveGestaoItem, { direction: "down" })}
          >
            Mover para baixo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => perform(duplicateGestaoItem, {})}>
            Duplicar {noun}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {status === "PUBLISHED" ? (
            <DropdownMenuItem onSelect={() => changeStatus("ARCHIVED")}>
              Arquivar {noun}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => changeStatus("PUBLISHED")}>
              Publicar {noun}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {note ? (
        <MenuNote message={note} onDismiss={() => setNote(null)} />
      ) : null}
      {editing ? (
        <ModuleEditDialog
          description={moduleDescription ?? ""}
          id={id}
          onClose={() => {
            setEditing(false);
            router.refresh();
          }}
          title={moduleTitle ?? title}
        />
      ) : null}
    </span>
  );
};

export const AddLessonRow = ({
  courseId,
  moduleId,
}: {
  readonly courseId: string;
  readonly moduleId: string;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await addGestaoLesson(formData);
      if (result.ok && result.lessonId) {
        router.push(
          `/gestao/ensino/cursos/${courseId}/aulas/${result.lessonId}`
        );
      } else if (!result.ok) {
        setError(result.message);
      }
    });
  };
  if (!open) {
    return (
      <button
        className="gk-course-add"
        onClick={() => setOpen(true)}
        type="button"
      >
        <GestaoIcon name="plus" size={16} /> Adicionar aula
      </button>
    );
  }
  return (
    <form className="gk-course-add-form" onSubmit={submit}>
      <input name="moduleId" type="hidden" value={moduleId} />
      <input
        aria-label="Título da nova aula"
        autoFocus
        className="gk-input"
        maxLength={180}
        name="title"
        placeholder="Título da aula"
        required
      />
      <select
        aria-label="Tipo da aula"
        className="gk-select gk-select--plain"
        defaultValue="VIDEO"
        name="kind"
      >
        <option value="VIDEO">Vídeo</option>
        <option value="MIXED">Vídeo e leitura</option>
        <option value="READING">Leitura</option>
        <option value="TEXT">Texto</option>
        <option value="MATERIAL">Material</option>
      </select>
      <button
        className="gk-btn gk-btn--primary gk-btn--sm"
        disabled={pending}
        type="submit"
      >
        {pending ? "Criando…" : "Criar e abrir"}
      </button>
      <button
        className="gk-btn gk-btn--sm"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        type="button"
      >
        Cancelar
      </button>
      {error ? (
        <p className="gk-error-box" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
};

export const AddModuleRow = ({ courseId }: { readonly courseId: string }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await addGestaoModule(formData);
      if (result.ok) {
        form.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };
  if (!open) {
    return (
      <button
        className="gk-course-add gk-course-add--module"
        onClick={() => setOpen(true)}
        type="button"
      >
        <GestaoIcon name="plus" size={16} /> Adicionar módulo
      </button>
    );
  }
  return (
    <form
      className="gk-course-add-form gk-course-add-form--module"
      onSubmit={submit}
    >
      <input name="courseId" type="hidden" value={courseId} />
      <input
        aria-label="Título do novo módulo"
        autoFocus
        className="gk-input"
        maxLength={160}
        name="title"
        placeholder="Título do módulo"
        required
      />
      <button
        className="gk-btn gk-btn--primary gk-btn--sm"
        disabled={pending}
        type="submit"
      >
        {pending ? "Criando…" : "Criar módulo"}
      </button>
      <button
        className="gk-btn gk-btn--sm"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        type="button"
      >
        Cancelar
      </button>
      {error ? (
        <p className="gk-error-box" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
};
