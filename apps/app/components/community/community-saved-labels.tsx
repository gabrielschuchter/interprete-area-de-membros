"use client";

import { toast } from "@repo/design-system/lib/toast";
import { TagIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { setSavedLabelsAction } from "@/app/(authenticated)/comunidade/salvos/actions";

const LABEL_LIMIT = 8;

/** Etiquetas pessoais de um salvo; só quem salvou as vê. */
export function CommunitySavedLabels({
  knownLabels,
  labels,
  postId,
  postTitle,
}: {
  readonly knownLabels: readonly string[];
  readonly labels: readonly string[];
  readonly postId: string;
  readonly postTitle: string;
}) {
  const router = useRouter();
  const listId = useId();
  const [current, setCurrent] = useState<readonly string[]>(labels);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const persist = (next: readonly string[]) => {
    const previous = current;
    setCurrent(next);
    startTransition(async () => {
      try {
        setCurrent(await setSavedLabelsAction(postId, [...next]));
        router.refresh();
      } catch {
        setCurrent(previous);
        toast.error("Não foi possível salvar as etiquetas.");
      }
    });
  };

  const add = () => {
    const label = draft.replaceAll(/\s+/g, " ").trim().slice(0, 32);
    setDraft("");
    if (
      !label ||
      current.some(
        (item) =>
          item.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR")
      )
    ) {
      return;
    }
    persist([...current, label]);
  };

  return (
    <fieldset aria-busy={pending} className="community-saved-labels">
      <legend className="sr-only">Etiquetas de {postTitle}</legend>
      <TagIcon aria-hidden="true" className="size-4 shrink-0" />
      {current.map((label) => (
        <span className="community-saved-label" key={label}>
          {label}
          <button
            aria-label={`Remover etiqueta ${label}`}
            disabled={pending}
            onClick={() => persist(current.filter((item) => item !== label))}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}
      {current.length < LABEL_LIMIT ? (
        <form
          className="community-saved-label-form"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <input
            aria-label="Nova etiqueta"
            list={listId}
            maxLength={32}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={current.length ? "Etiqueta" : "Adicionar etiqueta"}
            value={draft}
          />
          <datalist id={listId}>
            {knownLabels
              .filter((label) => !current.includes(label))
              .map((label) => (
                <option key={label} value={label} />
              ))}
          </datalist>
        </form>
      ) : null}
    </fieldset>
  );
}
