"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { JSONContent } from "@tiptap/core";
import { EyeIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  setPostStatus,
  updateDraft,
} from "@/app/(authenticated)/comunidade/actions";
import { TopicEditor } from "./topic-editor";

interface TopicSpaceOption {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

interface TopicDraftComposerProperties {
  readonly initialContent: JSONContent;
  readonly initialTags: readonly string[];
  readonly initialTitle: string;
  readonly postId: string;
  readonly spaceId: string;
  readonly spaceSlug: string;
  readonly spaces: readonly TopicSpaceOption[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

const labelForSaveState = (state: SaveState) => {
  if (state === "saving") {
    return "Salvando…";
  }
  if (state === "saved") {
    return "Salvo";
  }
  if (state === "error") {
    return "Não foi possível salvar";
  }
  return "Rascunho persistente";
};

export const TopicDraftComposer = ({
  initialContent,
  initialTags,
  initialTitle,
  postId,
  spaceId: initialSpaceId,
  spaceSlug: initialSpaceSlug,
  spaces,
}: TopicDraftComposerProperties) => {
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState(initialTags.join(", "));
  const [spaceId, setSpaceId] = useState(initialSpaceId);
  const [spaceSlug, setSpaceSlug] = useState(initialSpaceSlug);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestQueue = useRef(Promise.resolve());
  const requestVersion = useRef(0);

  const scheduleSave = ({
    nextContent,
    nextSpaceId = spaceId,
    nextSpaceSlug = spaceSlug,
    nextTags = tags,
    nextTitle = title,
  }: {
    nextContent?: JSONContent;
    nextSpaceId?: string;
    nextSpaceSlug?: string;
    nextTags?: string;
    nextTitle?: string;
  }) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setSaveState("saving");
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    timer.current = setTimeout(() => {
      const formData = new FormData();
      formData.set("postId", postId);
      formData.set("spaceId", nextSpaceId);
      formData.set("spaceSlug", nextSpaceSlug);
      formData.set("title", nextTitle);
      formData.set("tags", nextTags);
      if (nextContent) {
        formData.set("contentJson", JSON.stringify(nextContent));
      }

      requestQueue.current = requestQueue.current
        .then(() => updateDraft(formData))
        .then((result) => {
          if (version !== requestVersion.current) {
            return;
          }
          if (result.ok) {
            setSpaceSlug(result.spaceSlug);
            setSaveState("saved");
            return;
          }
          setSaveState("error");
        })
        .catch(() => {
          if (version === requestVersion.current) {
            setSaveState("error");
          }
        });
    }, 700);
  };

  const saveLabel = labelForSaveState(saveState);

  return (
    <div className="mt-10 space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-border border-b pb-4">
        <output
          aria-live="polite"
          className="inline-flex items-center gap-2 text-muted-foreground text-sm"
        >
          <SaveIcon aria-hidden="true" className="size-4" />
          {saveLabel}
        </output>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/comunidade/${spaceSlug}/${postId}/editar?preview=1`}>
              <EyeIcon aria-hidden="true" /> Pré-visualizar
            </Link>
          </Button>
          <form action={setPostStatus}>
            <input name="postId" type="hidden" value={postId} />
            <input name="spaceSlug" type="hidden" value={spaceSlug} />
            <input name="status" type="hidden" value="PUBLISHED" />
            <Button size="sm" type="submit">
              Publicar tópico
            </Button>
          </form>
        </div>
      </div>

      <div className="paper-surface space-y-7 border p-5 sm:p-9">
        <label className="block" htmlFor="draft-topic-space">
          <span className="brand-eyebrow">Espaço</span>
          <select
            className="mt-2 h-10 w-full rounded-sm border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
            id="draft-topic-space"
            onChange={(event) => {
              const nextSpaceId = event.target.value;
              const nextSpace = spaces.find(({ id }) => id === nextSpaceId);
              setSpaceId(nextSpaceId);
              if (nextSpace) {
                setSpaceSlug(nextSpace.slug);
                scheduleSave({
                  nextSpaceId,
                  nextSpaceSlug: nextSpace.slug,
                });
              }
            }}
            value={spaceId}
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block" htmlFor="draft-topic-title">
          <span className="brand-eyebrow">Título</span>
          <Input
            className="mt-2 h-14 rounded-none border-0 border-b px-0 font-display text-3xl shadow-none focus-visible:ring-0 sm:text-4xl"
            id="draft-topic-title"
            onChange={(event) => {
              const nextTitle = event.target.value;
              setTitle(nextTitle);
              scheduleSave({ nextTitle });
            }}
            placeholder="O que você quer investigar?"
            value={title === "Rascunho sem título" ? "" : title}
          />
        </label>

        <div>
          <span className="brand-eyebrow">Texto</span>
          <p className="mt-2 text-muted-foreground text-sm">
            Escreva com calma. O rascunho é salvo automaticamente enquanto você
            pensa.
          </p>
          <div className="mt-4">
            <TopicEditor
              defaultValue={initialContent}
              onDocumentChange={(nextContent) => scheduleSave({ nextContent })}
            />
          </div>
        </div>

        <label className="block" htmlFor="draft-topic-tags">
          <span className="brand-eyebrow">Tags</span>
          <Input
            className="mt-2"
            id="draft-topic-tags"
            onChange={(event) => {
              const nextTags = event.target.value;
              setTags(nextTags);
              scheduleSave({ nextTags });
            }}
            placeholder="epidemiologia, causalidade, meta-análise"
            value={tags}
          />
          <span className="mt-2 block text-muted-foreground text-xs">
            Separe por vírgulas. Até cinco tags.
          </span>
        </label>
      </div>
    </div>
  );
};
