"use client";

import { type ComponentProps, useEffect, useLayoutEffect, useRef } from "react";

interface CommunityEditorFieldProperties
  extends Omit<ComponentProps<"textarea">, "onChange" | "rows" | "value"> {
  /** Enter não quebra linha: o foco segue para o próximo campo ou para o texto. */
  readonly onEnter: () => void;
  readonly onValueChange: (value: string) => void;
  readonly value: string;
}

const resizeToContent = (element: HTMLTextAreaElement | null) => {
  if (!element) {
    return;
  }
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};

/**
 * Título e subtítulo da publicação: uma linha que cresce com o texto, sem barra
 * de rolagem e sem quebra manual de linha.
 */
export function CommunityEditorField({
  onEnter,
  onKeyDown,
  onValueChange,
  value,
  ...properties
}: CommunityEditorFieldProperties) {
  const reference = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refit whenever the text changes.
  useLayoutEffect(() => {
    resizeToContent(reference.current);
  }, [value]);

  useEffect(() => {
    const element = reference.current;
    const refit = () => resizeToContent(reference.current);
    // A largura muda com a janela e a fonte do título chega depois do primeiro
    // desenho; nos dois casos o número de linhas muda.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refit);
    if (element) {
      observer?.observe(element);
    }
    document.fonts?.ready.then(refit).catch(() => undefined);
    document.fonts?.addEventListener("loadingdone", refit);
    return () => {
      observer?.disconnect();
      document.fonts?.removeEventListener("loadingdone", refit);
    };
  }, []);

  return (
    <textarea
      {...properties}
      onChange={(event) =>
        onValueChange(event.target.value.replace(/\s*\n\s*/g, " "))
      }
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          onEnter();
        }
      }}
      ref={reference}
      rows={1}
      value={value}
    />
  );
}
