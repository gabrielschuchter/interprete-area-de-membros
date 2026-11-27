"use client";

import { BookmarkIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { setExerciseListBookmark } from "@/app/(authenticated)/exercicios/actions";

/** Marcador do card: marca e desmarca a lista, com resposta imediata. */
export const ExerciseListBookmarkButton = ({
  initialSaved,
  listId,
  title,
  variant = "cover",
}: {
  readonly variant?: "cover" | "inline";
  readonly initialSaved: boolean;
  readonly listId: string;
  readonly title: string;
}) => {
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  const toggle = () => {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      try {
        const result = await setExerciseListBookmark({ listId, saved: next });
        if (!result.ok) {
          setSaved(!next);
        }
      } catch {
        setSaved(!next);
      }
    });
  };

  const label = saved
    ? `Remover ${title} das salvas`
    : `Salvar ${title} para depois`;

  if (variant === "inline") {
    return (
      <button
        aria-label={label}
        aria-pressed={saved}
        className="inline-flex h-11 items-center gap-2 rounded-[4px] border border-[#8C1535] px-4 font-medium text-[#8C1535] text-sm transition-colors hover:bg-[#F1E4E1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535]"
        onClick={toggle}
        type="button"
      >
        <BookmarkIcon
          aria-hidden="true"
          className="size-[18px]"
          fill={saved ? "currentColor" : "none"}
        />
        {saved ? "Salva" : "Salvar lista"}
      </button>
    );
  }

  return (
    <button
      aria-label={label}
      aria-pressed={saved}
      className="absolute top-1.5 left-9 z-10 grid size-11 place-items-center rounded-full text-[#F1EBE8] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C873] motion-reduce:transition-none"
      onClick={toggle}
      title={saved ? "Remover das salvas" : "Salvar para depois"}
      type="button"
    >
      <span className="grid size-8 place-items-center rounded-full bg-[#1a0612]/60">
        <BookmarkIcon
          aria-hidden="true"
          className={`size-4 ${saved ? "fill-[#F7C873] text-[#F7C873]" : ""}`}
        />
      </span>
    </button>
  );
};
