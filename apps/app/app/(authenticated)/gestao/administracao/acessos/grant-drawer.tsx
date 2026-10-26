"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useActionState, useEffect, useMemo, useState } from "react";
import { GestaoIcon } from "../../gestao-icon";
import { grantGestaoAccess } from "./actions";

interface TreeCourse {
  readonly id: string;
  readonly modules: readonly {
    readonly id: string;
    readonly lessons: readonly {
      readonly id: string;
      readonly title: string;
    }[];
    readonly title: string;
  }[];
  readonly title: string;
}

interface Person {
  readonly id: string;
  readonly name: string;
}

const useSearch = (query: string) => {
  const [items, setItems] = useState<readonly Person[]>([]);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/assignment-recipients?q=${encodeURIComponent(term)}`,
          { signal: controller.signal }
        );
        if (response.ok) {
          const body = (await response.json()) as {
            items?: { id: string; displayName: string }[];
          };
          setItems(
            (body.items ?? []).map((item) => ({
              id: item.id,
              name: item.displayName,
            }))
          );
        }
      } catch {
        // busca cancelada ao digitar de novo
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return items;
};

const key = (type: string, id: string) => `${type}:${id}`;

const CourseNode = ({
  course,
  onToggle,
  selected,
}: {
  readonly course: TreeCourse;
  readonly onToggle: (type: string, id: string, checked: boolean) => void;
  readonly selected: ReadonlySet<string>;
}) => {
  const [open, setOpen] = useState(false);
  const courseOn = selected.has(key("COURSE", course.id));
  return (
    <li className="gk-tree-course">
      <div className="gk-tree-row">
        <button
          aria-expanded={open}
          aria-label={open ? "Recolher" : "Expandir"}
          className="gk-tree-caret"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <GestaoIcon
            name={open ? "chevron-down" : "chevron-right"}
            size={14}
          />
        </button>
        <label>
          <input
            checked={courseOn}
            onChange={(event) =>
              onToggle("COURSE", course.id, event.target.checked)
            }
            type="checkbox"
          />
          <strong>{course.title}</strong>
        </label>
      </div>
      {open ? (
        <ul>
          {course.modules.map((module) => {
            const moduleOn = courseOn || selected.has(key("MODULE", module.id));
            return (
              <li key={module.id}>
                <label className="gk-tree-row gk-tree-row--module">
                  <input
                    checked={moduleOn}
                    disabled={courseOn}
                    onChange={(event) =>
                      onToggle("MODULE", module.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  Módulo · {module.title}
                </label>
                <ul>
                  {module.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <label className="gk-tree-row gk-tree-row--lesson">
                        <input
                          checked={
                            moduleOn || selected.has(key("LESSON", lesson.id))
                          }
                          disabled={moduleOn}
                          onChange={(event) =>
                            onToggle("LESSON", lesson.id, event.target.checked)
                          }
                          type="checkbox"
                        />
                        Aula · {lesson.title}
                      </label>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
};

const effectiveCount = (
  tree: readonly TreeCourse[],
  selected: ReadonlySet<string>
) => {
  let total = 0;
  for (const course of tree) {
    const courseOn = selected.has(key("COURSE", course.id));
    total += courseOn ? 1 : 0;
    for (const module of course.modules) {
      const moduleOn = courseOn || selected.has(key("MODULE", module.id));
      total += moduleOn ? 1 : 0;
      for (const lesson of module.lessons) {
        total += moduleOn || selected.has(key("LESSON", lesson.id)) ? 1 : 0;
      }
    }
  }
  return total;
};

export const GrantAccessDrawer = ({
  initialMember,
  onClose,
  tree,
}: {
  readonly initialMember: Person | null;
  readonly onClose: () => void;
  readonly tree: readonly TreeCourse[];
}) => {
  const [state, formAction, pending] = useActionState(grantGestaoAccess, {
    error: null,
  });
  const [member, setMember] = useState<Person | null>(initialMember);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const results = useSearch(query);
  const count = useMemo(() => effectiveCount(tree, selected), [tree, selected]);
  const toggle = (type: string, id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key(type, id));
      } else {
        next.delete(key(type, id));
      }
      return next;
    });
  return (
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent
        className="gk-drawer"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <form action={formAction} className="gk-drawer-form">
          <div className="gk-modal-head">
            <div>
              <DialogTitle className="gk-modal-title">
                Conceder acesso
              </DialogTitle>
              <DialogDescription className="gk-modal-sub">
                Acesso individual a cursos, módulos ou aulas.
              </DialogDescription>
            </div>
            <button
              aria-label="Fechar"
              className="gk-modal-close"
              onClick={onClose}
              type="button"
            >
              <GestaoIcon name="x" size={18} />
            </button>
          </div>
          <div className="gk-drawer-body">
            <div className="gk-label">
              <label htmlFor="grant-member">Membro *</label>
              <div className="gk-pickbox">
                {member ? (
                  <span className="gk-pickchip">
                    {member.name}
                    <button
                      aria-label="Trocar membro"
                      onClick={() => setMember(null)}
                      type="button"
                    >
                      <GestaoIcon name="x" size={12} />
                    </button>
                  </span>
                ) : (
                  <input
                    autoComplete="off"
                    id="grant-member"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar aluno pelo nome"
                    value={query}
                  />
                )}
              </div>
              {member ? null : (
                <div className="gk-pickmenu gk-pickmenu--inline">
                  {results.map((person) => (
                    <button
                      className="gk-pickmenu-row"
                      key={person.id}
                      onClick={() => {
                        setMember(person);
                        setQuery("");
                      }}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="gk-avatar gk-avatar--lg"
                      >
                        {person.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span>{person.name}</span>
                    </button>
                  ))}
                  {query.trim().length >= 2 && results.length === 0 ? (
                    <p className="gk-pickmenu-empty">
                      Nenhum aluno encontrado.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            <div className="gk-label">
              <span>Conteúdo</span>
              <ul className="gk-tree">
                {tree.map((course) => (
                  <CourseNode
                    course={course}
                    key={course.id}
                    onToggle={toggle}
                    selected={selected}
                  />
                ))}
              </ul>
              <small className="gk-hint">
                Marcar um curso inclui seus módulos e aulas.
              </small>
            </div>
            <label className="gk-label">
              <span>
                Expira em <em>opcional</em>
              </span>
              <input className="gk-input" name="expiresAt" type="date" />
            </label>
            <div className="gk-info-box">
              <GestaoIcon name="check-circle" size={20} />
              <div>
                <strong>Acesso efetivo resultante: {count} itens.</strong>
                <span>
                  A concessão é validada no servidor. Repetir não cria
                  duplicatas.
                </span>
              </div>
            </div>
            <input name="memberId" type="hidden" value={member?.id ?? ""} />
            {[...selected].map((value) => (
              <input key={value} name="resources" type="hidden" value={value} />
            ))}
            {state.error ? (
              <p className="gk-error-box" role="alert">
                {state.error}
              </p>
            ) : null}
          </div>
          <div className="gk-drawer-foot">
            <button
              className="gk-btn gk-btn--primary gk-btn--wide"
              disabled={pending}
              type="submit"
            >
              {pending ? "Concedendo…" : "Conceder acesso"}
            </button>
            <button className="gk-btn" onClick={onClose} type="button">
              Cancelar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
