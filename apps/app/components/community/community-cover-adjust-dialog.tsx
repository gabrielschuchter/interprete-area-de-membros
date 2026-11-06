"use client";

import { MinusIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type CommunityCoverFraming,
  clampCoverZoom,
  communityCoverImageStyle,
  communityCoverMaxZoom,
  communityCoverMinZoom,
  communityCoverRecommendedWidth,
  defaultCommunityCoverFraming,
  dragCommunityCoverFraming,
  isBelowRecommendedCoverWidth,
  normalizeCommunityCoverFraming,
} from "@/lib/community-cover";

export interface CommunityCoverAdjustDialogProperties {
  /** Enquadramento atual; sem ele, a capa abre centralizada e sem zoom. */
  readonly initialFraming?: CommunityCoverFraming;
  readonly onCancel: () => void;
  /** Devolve foco, zoom e as dimensões da imagem original. */
  readonly onConfirm: (framing: CommunityCoverFraming) => void;
  /** Imagem original (URL local do arquivo escolhido ou a capa já enviada). */
  readonly src: string | null;
}

interface Natural {
  readonly height: number;
  readonly width: number;
}

const zoomStep = 0.05;
const keyboardStep = 12;
const previews = [
  { id: "feed", label: "Feed" },
  { id: "desktop", label: "Publicação, computador" },
  { id: "mobile", label: "Publicação, celular" },
] as const;

const PreviewFrame = ({
  framing,
  src,
}: {
  readonly framing: CommunityCoverFraming;
  readonly src: string;
}) => (
  <span className="community-cover-frame cp-adjust__preview-frame">
    {/* biome-ignore lint/performance/noImgElement: local preview of the cover being adjusted. */}
    <img
      alt=""
      draggable={false}
      height={9}
      src={src}
      style={communityCoverImageStyle(framing)}
      width={16}
    />
  </span>
);

/**
 * "Ajustar capa": a pessoa arrasta e aproxima a imagem original dentro da
 * janela 16:9 e confere os três lugares onde a capa aparece. Nada é recortado
 * no arquivo: o resultado são só foco (0 a 1) e zoom (1 a 3). A janela e os
 * previews usam a mesma função de estilo da página publicada.
 */
export const CommunityCoverAdjustDialog = ({
  initialFraming,
  onCancel,
  onConfirm,
  src,
}: CommunityCoverAdjustDialogProperties) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [natural, setNatural] = useState<Natural | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [framing, setFraming] = useState<CommunityCoverFraming>(
    normalizeCommunityCoverFraming(
      initialFraming ?? defaultCommunityCoverFraming
    )
  );
  const [frameSize, setFrameSize] = useState({ height: 0, width: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    framing: CommunityCoverFraming;
    x: number;
    y: number;
  } | null>(null);
  const framingRef = useRef(framing);
  framingRef.current = framing;

  // Abre e fecha o pop-up junto com a imagem; reinicia o estado a cada abertura.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (src && !dialog.open) {
      dialog.showModal();
    } else if (!src && dialog.open) {
      dialog.close();
    }
  }, [src]);

  // O enquadramento inicial vale só na abertura de cada imagem.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reabrir com outra imagem reinicia; mudanças em initialFraming não.
  useEffect(() => {
    setNatural(null);
    setLoadError(false);
    setFraming(
      normalizeCommunityCoverFraming(
        initialFraming ?? defaultCommunityCoverFraming
      )
    );
    if (!src) {
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (!cancelled) {
        setNatural({
          height: image.naturalHeight,
          width: image.naturalWidth,
        });
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setLoadError(true);
      }
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!(element && src)) {
      return;
    }
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setFrameSize({ height: rect.height, width: rect.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [src]);

  const geometry = natural
    ? {
        frameHeight: frameSize.height,
        frameWidth: frameSize.width,
        imageAspect: natural.width / natural.height,
      }
    : null;

  const moveBy = (
    base: CommunityCoverFraming,
    delta: { x: number; y: number }
  ) => {
    if (!(geometry && geometry.frameWidth > 0)) {
      return base;
    }
    return dragCommunityCoverFraming(base, delta, geometry);
  };

  const setZoom = (zoom: number) =>
    setFraming((current) => ({
      ...current,
      zoom: Math.round(clampCoverZoom(zoom) * 100) / 100,
    }));

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!natural) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      framing: framingRef.current,
      x: event.clientX,
      y: event.clientY,
    };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) {
      return;
    }
    setFraming(
      moveBy(start.framing, {
        x: event.clientX - start.x,
        y: event.clientY - start.y,
      })
    );
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? keyboardStep * 4 : keyboardStep;
    const moves: Record<string, { x: number; y: number }> = {
      // Mover a imagem para a direita equivale a arrastar +x.
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setFraming((current) => moveBy(current, move));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoom(framing.zoom + zoomStep * 2);
    } else if (event.key === "-") {
      event.preventDefault();
      setZoom(framing.zoom - zoomStep * 2);
    }
  };

  // A roda do mouse aproxima; precisa ser não passiva para não rolar a página.
  useEffect(() => {
    const element = frameRef.current;
    if (!(element && src)) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setFraming((current) => ({
        ...current,
        zoom:
          Math.round(
            clampCoverZoom(
              current.zoom + (event.deltaY > 0 ? -zoomStep : zoomStep)
            ) * 100
          ) / 100,
      }));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [src]);

  const percent = Math.round(framing.zoom * 100);
  const untouched =
    framing.zoom === 1 && framing.focusX === 0.5 && framing.focusY === 0.5;
  const small = natural ? isBelowRecommendedCoverWidth(natural.width) : false;

  return (
    <dialog
      aria-labelledby={titleId}
      className="cp-adjust"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      {src ? (
        <div className="cp-adjust__panel">
          <header className="cp-adjust__header">
            <div>
              {/* O foco inicial fica no título, não na janela, para não abrir já com o contorno de teclado. */}
              <h2 autoFocus id={titleId} tabIndex={-1}>
                Ajustar capa
              </h2>
              <p>Arraste a imagem para enquadrar e use o zoom para ajustar.</p>
            </div>
            <button
              aria-label="Fechar"
              className="cp-adjust__icon-button"
              onClick={onCancel}
              type="button"
            >
              <XIcon aria-hidden="true" />
            </button>
          </header>

          <div className="cp-adjust__body">
            <div className="cp-adjust__stage">
              {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: a janela é um controle de arrastar; o teclado move e aproxima pela mesma área. */}
              <div
                aria-label="Janela da capa. Use as setas para mover e + ou − para o zoom."
                className="cp-adjust__frame"
                data-dragging={dragging ? "true" : undefined}
                onKeyDown={onKeyDown}
                onPointerCancel={endDrag}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                ref={frameRef}
                role="application"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a janela precisa de foco para as setas e o zoom pelo teclado.
                tabIndex={0}
              >
                {natural ? (
                  <span className="community-cover-frame cp-adjust__frame-inner">
                    {/* biome-ignore lint/performance/noImgElement: local preview of the original being adjusted. */}
                    <img
                      alt=""
                      draggable={false}
                      height={9}
                      src={src}
                      style={communityCoverImageStyle(framing)}
                      width={16}
                    />
                  </span>
                ) : (
                  <span className="cp-adjust__loading">
                    {loadError
                      ? "Não foi possível abrir esta imagem."
                      : "Abrindo imagem…"}
                  </span>
                )}
              </div>

              <div className="cp-adjust__zoom">
                <button
                  aria-label="Afastar"
                  className="cp-adjust__icon-button"
                  disabled={!natural || framing.zoom <= communityCoverMinZoom}
                  onClick={() => setZoom(framing.zoom - zoomStep * 2)}
                  type="button"
                >
                  <MinusIcon aria-hidden="true" />
                </button>
                <input
                  aria-label="Zoom"
                  aria-valuetext={`${percent}%`}
                  className="cp-adjust__range"
                  disabled={!natural}
                  max={communityCoverMaxZoom}
                  min={communityCoverMinZoom}
                  onChange={(event) =>
                    setZoom(Number(event.currentTarget.value))
                  }
                  step={zoomStep}
                  type="range"
                  value={framing.zoom}
                />
                <button
                  aria-label="Aproximar"
                  className="cp-adjust__icon-button"
                  disabled={!natural || framing.zoom >= communityCoverMaxZoom}
                  onClick={() => setZoom(framing.zoom + zoomStep * 2)}
                  type="button"
                >
                  <PlusIcon aria-hidden="true" />
                </button>
                <output className="cp-adjust__percent">{percent}%</output>
                <button
                  className="cp-adjust__restore"
                  disabled={!natural || untouched}
                  onClick={() =>
                    setFraming({
                      ...framing,
                      focusX: 0.5,
                      focusY: 0.5,
                      zoom: 1,
                    })
                  }
                  type="button"
                >
                  <RotateCcwIcon aria-hidden="true" />
                  Restaurar
                </button>
              </div>

              {natural ? (
                <p className="cp-adjust__meta">
                  Original · {natural.width} × {natural.height} px
                </p>
              ) : null}
              {small ? (
                // biome-ignore lint/a11y/useSemanticElements: aviso informativo, não bloqueia o envio; <output> seria lido como resultado de cálculo.
                <p className="cp-adjust__warning" role="status">
                  Imagem com menos de {communityCoverRecommendedWidth} px de
                  largura. Ela pode ficar menos nítida em telas grandes, mas
                  você pode usá-la mesmo assim.
                </p>
              ) : null}
            </div>

            <aside
              aria-label="Pré-visualizações"
              className="cp-adjust__previews"
            >
              {previews.map((preview) => (
                <figure
                  className="cp-adjust__preview"
                  data-kind={preview.id}
                  key={preview.id}
                >
                  {natural ? (
                    <PreviewFrame framing={framing} src={src} />
                  ) : (
                    <span className="community-cover-frame cp-adjust__preview-frame" />
                  )}
                  <figcaption>{preview.label}</figcaption>
                </figure>
              ))}
            </aside>
          </div>

          <footer className="cp-adjust__actions">
            <button
              className="cp-adjust__secondary"
              onClick={onCancel}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="cp-adjust__primary"
              disabled={!natural}
              onClick={() => {
                if (natural) {
                  onConfirm({
                    ...framing,
                    height: natural.height,
                    width: natural.width,
                  });
                }
              }}
              type="button"
            >
              Usar imagem
            </button>
          </footer>
        </div>
      ) : null}
    </dialog>
  );
};
