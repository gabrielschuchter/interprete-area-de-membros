"use client";

import { FileTextIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createDraft } from "@/app/(authenticated)/comunidade/actions";
import { TopicDraftComposer } from "./topic-draft-composer";

interface NewTopicSpace {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

interface NewTopicComposerProperties {
  readonly initialSpaceId: string;
  readonly initialSpaceSlug: string;
  readonly spaces: readonly NewTopicSpace[];
}

const emptyDocument = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
};

export const NewTopicComposer = ({
  initialSpaceId,
  initialSpaceSlug,
  spaces,
}: NewTopicComposerProperties) => {
  const [draft, setDraft] = useState<{
    postId: string;
    spaceSlug: string;
  } | null>(null);
  const [hasError, setHasError] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    const formData = new FormData();
    formData.set("spaceId", initialSpaceId);
    createDraft(formData)
      .then((result) => {
        if (result.ok) {
          setDraft({ postId: result.postId, spaceSlug: result.spaceSlug });
        } else {
          setHasError(true);
        }
      })
      .catch(() => setHasError(true));
  }, [initialSpaceId]);

  if (hasError) {
    return (
      <div className="paper-surface mt-10 border p-8 text-muted-foreground">
        Não foi possível abrir um rascunho agora. Atualize a página e tente
        novamente.
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="paper-surface mt-10 flex min-h-64 flex-col items-center justify-center gap-4 border p-8 text-center">
        <FileTextIcon aria-hidden="true" className="size-7 text-brand-action" />
        <p className="text-muted-foreground">Preparando seu caderno…</p>
      </div>
    );
  }

  return (
    <TopicDraftComposer
      initialContent={emptyDocument}
      initialTags={[]}
      initialTitle=""
      postId={draft.postId}
      spaceId={initialSpaceId}
      spaceSlug={draft.spaceSlug || initialSpaceSlug}
      spaces={spaces}
    />
  );
};
