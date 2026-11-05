"use client";

import { useEffect, useRef, useState } from "react";

interface TipState {
  readonly left: number;
  readonly placement: "above" | "below";
  readonly text: string;
  readonly top: number;
}

const hoverDelay = 250;
const longPressDelay = 450;
const touchVisibleFor = 1600;
const gap = 8;

const candidateSelector = "[data-tooltip], button, a[href], [role='button']";

const hasVisibleText = (element: HTMLElement) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.trim() && !node.parentElement?.closest(".sr-only")) {
      return true;
    }
  }
  return false;
};

/** Texto alternativo de um avatar (imagem pequena), nunca de uma capa. */
const smallImageAlt = (element: HTMLElement) => {
  const image = element.querySelector<HTMLImageElement>("img[alt]");
  if (!image || element.getBoundingClientRect().width > 72) {
    return "";
  }
  return image.alt.trim();
};

/** Texto da dica: `data-tooltip`, ou o rótulo de um botão só com ícone. */
const tooltipText = (element: HTMLElement) => {
  if (element.dataset.tooltip !== undefined) {
    return element.dataset.tooltip.trim();
  }
  // A Comunidade já mostra o próprio rótulo de pessoa nesses elementos.
  if (
    element.dataset.tooltipOff !== undefined ||
    element.closest("[data-person-name]")
  ) {
    return "";
  }
  // Botão com texto visível já se explica; a dica é só para ícones.
  if (hasVisibleText(element)) {
    return "";
  }
  // Avatares e ícones: o nome acessível vira a dica, como já acontece com as
  // pessoas da Comunidade.
  return (
    element.getAttribute("aria-label")?.trim() ||
    element.querySelector(".sr-only")?.textContent?.trim() ||
    smallImageAlt(element) ||
    ""
  );
};

const titleExcluded = new Set(["IFRAME", "OBJECT", "EMBED", "SVG", "TITLE"]);

/**
 * O atributo `title` abre a dica nativa do navegador, que aparece em outro
 * lugar e com outro visual. Antes que ela abra, o texto passa para
 * `data-tooltip` (e para `aria-label`, se o elemento não tiver nome) e o
 * atributo sai, então só existe a dica da plataforma.
 */
const adoptNativeTitle = (node: EventTarget | null) => {
  if (!(node instanceof Element)) {
    return;
  }
  const element = node.closest<HTMLElement>("[title]");
  if (!element || titleExcluded.has(element.tagName.toUpperCase())) {
    return;
  }
  const text = element.getAttribute("title")?.trim() ?? "";
  element.removeAttribute("title");
  if (!text) {
    return;
  }
  if (element.dataset.tooltip === undefined) {
    element.dataset.tooltip = text;
  }
  if (!(element.getAttribute("aria-label") || hasVisibleText(element))) {
    element.setAttribute("aria-label", text);
  }
};

const tooltipTarget = (node: EventTarget | null) => {
  if (!(node instanceof Element)) {
    return null;
  }
  const element = node.closest<HTMLElement>(candidateSelector);
  return element && tooltipText(element) ? element : null;
};

const place = (element: HTMLElement): TipState | null => {
  const text = tooltipText(element);
  if (!text) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  const placement = rect.top > 48 ? "above" : "below";
  const center = rect.left + rect.width / 2;
  const edge = Math.min(120, window.innerWidth / 2);
  return {
    left: Math.min(Math.max(center, edge), window.innerWidth - edge),
    placement,
    text,
    top: placement === "above" ? rect.top - gap : rect.bottom + gap,
  };
};

/**
 * Uma só camada de dicas para a área de membros: qualquer elemento com
 * `data-tooltip` ganha a dica ao passar o mouse (250 ms), ao receber foco pelo
 * teclado e, no toque, ao segurar o dedo sobre ele. A dica fica em posição
 * fixa, fora de barras com rolagem, então nunca é cortada.
 */
export const TooltipLayer = () => {
  const [tip, setTip] = useState<TipState | null>(null);
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const hide = () => {
      clearTimer();
      activeRef.current = null;
      setTip(null);
    };
    const showLater = (element: HTMLElement, delay: number) => {
      clearTimer();
      activeRef.current = element;
      timerRef.current = window.setTimeout(() => {
        if (activeRef.current === element && element.isConnected) {
          setTip(place(element));
        }
      }, delay);
    };

    const onPointerOver = (event: PointerEvent) => {
      adoptNativeTitle(event.target);
      if (event.pointerType === "touch") {
        return;
      }
      const element = tooltipTarget(event.target);
      if (!element) {
        if (activeRef.current) {
          hide();
        }
        return;
      }
      if (element !== activeRef.current) {
        setTip(null);
        showLater(element, hoverDelay);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      adoptNativeTitle(event.target);
      const element = tooltipTarget(event.target);
      hide();
      if (event.pointerType !== "touch" || !element) {
        return;
      }
      showLater(element, longPressDelay);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        return;
      }
      if (activeRef.current && timerRef.current === null) {
        // A dica já apareceu: fica um instante e some.
        const element = activeRef.current;
        window.setTimeout(() => {
          if (activeRef.current === element) {
            hide();
          }
        }, touchVisibleFor);
        return;
      }
      hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      adoptNativeTitle(event.target);
      const element = tooltipTarget(event.target);
      if (element?.matches(":focus-visible")) {
        showLater(element, hoverDelay);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hide();
      }
    };

    document.addEventListener("pointerover", onPointerOver, {
      capture: true,
      passive: true,
    });
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("pointercancel", hide, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    window.addEventListener("blur", hide);
    return () => {
      clearTimer();
      document.removeEventListener("pointerover", onPointerOver, {
        capture: true,
      });
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", hide);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", hide, { capture: true });
      window.removeEventListener("blur", hide);
    };
  }, []);

  if (!tip) {
    return null;
  }
  return (
    <div
      aria-hidden="true"
      className="member-tooltip"
      data-placement={tip.placement}
      style={{ left: tip.left, top: tip.top }}
    >
      {tip.text}
    </div>
  );
};
