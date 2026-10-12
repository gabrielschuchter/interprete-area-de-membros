"use client";

import type { JSONContent } from "@tiptap/core";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const RichTopicEditor = dynamic(
  async () => {
    const { TopicEditor } = await import("@/components/community/topic-editor");
    return TopicEditor;
  },
  {
    loading: () => (
      <div
        aria-busy="true"
        className="grid min-h-64 place-items-center rounded-sm border border-[#E2D6D1] bg-[#FBF8F5] text-[#7A5A69] text-sm"
      >
        Carregando editor de conteúdo…
      </div>
    ),
    ssr: false,
  }
);

export const LazyTopicEditor = ({
  ariaLabel,
  defaultValue,
}: {
  readonly ariaLabel: string;
  readonly defaultValue?: JSONContent;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [content, setContent] = useState(defaultValue ?? emptyDocument);

  useEffect(() => {
    const node = containerRef.current;
    if (shouldLoad || !node) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting && entry.intersectionRatio > 0
          )
        ) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={containerRef}>
      <input name="contentJson" type="hidden" value={JSON.stringify(content)} />
      {shouldLoad ? (
        <RichTopicEditor
          ariaLabel={ariaLabel}
          defaultValue={content}
          name="lazyContentJson"
          onDocumentChange={setContent}
        />
      ) : (
        <div
          aria-busy="true"
          aria-live="polite"
          className="grid min-h-16 place-items-center rounded-sm border border-[#E2D6D1] bg-[#FBF8F5] px-4 py-3 text-center text-[#7A5A69] text-sm"
        >
          O editor de conteúdo carrega quando esta área ficar visível.
        </div>
      )}
    </div>
  );
};
