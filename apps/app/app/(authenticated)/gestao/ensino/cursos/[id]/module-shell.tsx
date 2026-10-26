"use client";

import { type ReactNode, useId, useState } from "react";
import { GestaoIcon } from "../../../gestao-icon";
import { DragHandle } from "./sortable";

export const ModuleShell = ({
  actions,
  children,
  count,
  sortId,
  title,
}: {
  readonly actions: ReactNode;
  readonly children: ReactNode;
  readonly count: string;
  readonly sortId: string;
  readonly title: string;
}) => {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  return (
    <section
      className="gk-course-module"
      data-open={String(open)}
      data-sort-id={sortId}
      data-sort-kind="module"
    >
      <header className="gk-course-module-head">
        <DragHandle label="Arrastar para reordenar o módulo" />
        <button
          aria-controls={bodyId}
          aria-expanded={open}
          aria-label={`${open ? "Recolher" : "Expandir"} ${title}`}
          className="gk-course-fold"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <GestaoIcon
            name={open ? "chevron-down" : "chevron-right"}
            size={16}
          />
        </button>
        <h2>{title}</h2>
        <span className="gk-course-count">{count}</span>
        {actions}
      </header>
      <div hidden={!open} id={bodyId}>
        {children}
      </div>
    </section>
  );
};
