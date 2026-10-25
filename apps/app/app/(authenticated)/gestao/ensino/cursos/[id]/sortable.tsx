"use client";

import { useRouter } from "next/navigation";
import {
  type DragEvent,
  type ReactNode,
  useRef,
  useState,
  useTransition,
} from "react";
import { GestaoIcon } from "../../../gestao-icon";
import { reorderGestaoItems } from "./structure-actions";

const rowOf = (target: EventTarget | null, kind: string) =>
  target instanceof Element
    ? target.closest<HTMLElement>(`[data-sort-kind="${kind}"]`)
    : null;

const placement = (row: HTMLElement, clientY: number) => {
  const anchor = row.querySelector("header") ?? row;
  const box = anchor.getBoundingClientRect();
  return clientY < box.top + box.height / 2 ? "before" : "after";
};

export const DragHandle = ({ label }: { readonly label: string }) => (
  <span
    aria-hidden="true"
    className="gk-grip"
    draggable
    onDragEnd={(event) => {
      const row = (event.currentTarget as HTMLElement).closest<HTMLElement>(
        "[data-sort-id]"
      );
      if (row) {
        delete row.dataset.dragging;
      }
    }}
    onDragStart={(event) => {
      const row = (event.currentTarget as HTMLElement).closest<HTMLElement>(
        "[data-sort-id]"
      );
      if (!row) {
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.dataset.sortId ?? "");
      event.dataTransfer.setDragImage(row, 24, 24);
      row.dataset.dragging = "true";
    }}
    title={label}
  >
    <GestaoIcon name="grip" size={16} />
  </span>
);

export const SortableGroup = ({
  as: Tag = "div",
  children,
  className,
  kind,
  parentId,
}: {
  readonly as?: "div" | "ul";
  readonly children: ReactNode;
  readonly className?: string;
  readonly kind: "module" | "lesson";
  readonly parentId: string;
}) => {
  const router = useRouter();
  const root = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const clearMarks = () => {
    for (const row of root.current?.querySelectorAll<HTMLElement>(
      "[data-drop]"
    ) ?? []) {
      delete row.dataset.drop;
    }
  };
  const over = (event: DragEvent) => {
    const row = rowOf(event.target, kind);
    if (!row || row.dataset.dragging === "true") {
      return;
    }
    if (!root.current?.contains(row)) {
      return;
    }
    event.preventDefault();
    clearMarks();
    const box = row.getBoundingClientRect();
    row.dataset.drop =
      event.clientY < box.top + box.height / 2 ? "before" : "after";
  };
  const drop = (event: DragEvent) => {
    const target = rowOf(event.target, kind);
    const draggedId = event.dataTransfer.getData("text/plain");
    clearMarks();
    if (!(target && draggedId && root.current)) {
      return;
    }
    event.preventDefault();
    const before = placement(target, event.clientY) === "before";
    const ids = [
      ...root.current.querySelectorAll<HTMLElement>(
        `:scope > [data-sort-kind="${kind}"]`
      ),
    ]
      .map((row) => row.dataset.sortId ?? "")
      .filter((id) => id && id !== draggedId);
    const targetIndex = ids.indexOf(target.dataset.sortId ?? "");
    if (targetIndex < 0 || draggedId === target.dataset.sortId) {
      return;
    }
    ids.splice(before ? targetIndex : targetIndex + 1, 0, draggedId);
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("parentId", parentId);
    formData.set("ids", ids.join(","));
    setError(null);
    startTransition(async () => {
      const result = await reorderGestaoItems(formData);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <>
      <Tag
        className={className}
        onDragLeave={clearMarks}
        onDragOver={over}
        onDrop={drop}
        ref={(node: HTMLElement | null) => {
          root.current = node;
        }}
      >
        {children}
      </Tag>
      {error ? (
        <p className="gk-error-box" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
};
