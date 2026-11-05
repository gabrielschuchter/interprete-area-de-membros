"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface TooltipState {
  readonly left: number;
  readonly name: string;
  readonly top: number;
}

const targetFor = (node: EventTarget | null) =>
  node instanceof Element
    ? node.closest<HTMLElement>("[data-person-name]")
    : null;

/**
 * Nome da pessoa ao passar o mouse (ou focar pelo teclado) sobre um avatar.
 * Substitui o tooltip nativo do navegador, que demora quase um segundo e não
 * segue o visual da escola. Um único rótulo flutuante atende a lista inteira,
 * posicionado em `position: fixed` para não ser cortado pelo contêiner que
 * esconde os avatares que não cabem.
 */
export const CommunityPersonTooltip = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const current = useRef<HTMLElement | null>(null);

  const show = useCallback((element: HTMLElement | null) => {
    if (!element) {
      return;
    }
    current.current = element;
    const rect = element.getBoundingClientRect();
    setTooltip({
      left: rect.left + rect.width / 2,
      name: element.dataset.personName ?? "",
      top: rect.top,
    });
  }, []);

  const hide = useCallback(() => {
    current.current = null;
    setTooltip(null);
  }, []);

  const scope = useRef<HTMLDivElement | null>(null);
  // Listeners nativos delegados: o contêiner só observa os links de cada
  // pessoa, que continuam sendo os elementos interativos.
  useEffect(() => {
    const element = scope.current;
    if (!element) {
      return;
    }
    const onOver = (event: Event) => {
      const target = targetFor(event.target);
      if (target && target !== current.current) {
        show(target);
      } else if (!target) {
        hide();
      }
    };
    const onFocus = (event: Event) => show(targetFor(event.target));
    element.addEventListener("pointerover", onOver);
    element.addEventListener("pointerleave", hide);
    element.addEventListener("focusin", onFocus);
    element.addEventListener("focusout", hide);
    return () => {
      element.removeEventListener("pointerover", onOver);
      element.removeEventListener("pointerleave", hide);
      element.removeEventListener("focusin", onFocus);
      element.removeEventListener("focusout", hide);
    };
  }, [hide, show]);

  return (
    <div className="community-person-tooltip-scope" ref={scope}>
      {children}
      {tooltip ? (
        <span
          aria-hidden="true"
          className="community-person-tooltip"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          {tooltip.name}
        </span>
      ) : null}
    </div>
  );
};
