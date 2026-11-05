"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  MinusIcon,
  MoveIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface ImageCropDialogProperties {
  /** Largura ÷ altura do recorte (1 para foto de perfil, 16/9 para capa). */
  readonly aspect: number;
  readonly file: File | null;
  readonly onCancel: () => void;
  readonly onConfirm: (file: File) => void;
  /** Largura máxima do arquivo gerado, em pixels. */
  readonly outputWidth: number;
  readonly shape?: "rect" | "round";
  readonly title: string;
}

interface Source {
  readonly height: number;
  readonly image: HTMLImageElement;
  readonly url: string;
  readonly width: number;
}

interface View {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

const maxZoom = 4;
// A imagem sempre cobre a moldura: sem faixas vazias no recorte.
const minZoom = 1;
const extensionPattern = /\.[^.]+$/u;
const zoomStep = 0.1;

const loadImage = (file: File) =>
  new Promise<Source>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    // O navegador já aplica a orientação EXIF ao desenhar uma <img>.
    image.onload = () =>
      resolve({
        height: image.naturalHeight,
        image,
        url,
        width: image.naturalWidth,
      });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid image"));
    };
    image.src = url;
  });

const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Recorte antes do envio: a pessoa aproxima, afasta e arrasta a imagem dentro
 * da moldura e só então confirma. O arquivo gerado já sai no formato final
 * (a proporção da moldura), em alta qualidade; o servidor converte para WebP.
 */
export const ImageCropDialog = ({
  aspect,
  file,
  onCancel,
  onConfirm,
  outputWidth,
  shape = "rect",
  title,
}: ImageCropDialogProperties) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState("");
  const [frame, setFrame] = useState({ height: 0, width: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{
    distance: number;
    view: View;
    x: number;
    y: number;
  } | null>(null);

  // Abre e fecha o pop-up junto com o arquivo escolhido.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (file && !dialog.open) {
      dialog.showModal();
    } else if (!file && dialog.open) {
      dialog.close();
    }
  }, [file]);

  useEffect(() => {
    setSource(null);
    setError("");
    setView({ x: 0, y: 0, zoom: 1 });
    setIsSaving(false);
    if (!file) {
      return;
    }
    let cancelled = false;
    let loaded: Source | null = null;
    loadImage(file)
      .then((result) => {
        loaded = result;
        if (cancelled) {
          URL.revokeObjectURL(result.url);
          return;
        }
        setSource(result);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível abrir esta imagem.");
        }
      });
    return () => {
      cancelled = true;
      if (loaded) {
        URL.revokeObjectURL(loaded.url);
      }
    };
  }, [file]);

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!(element && file)) {
      return;
    }
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setFrame({ height: rect.height, width: rect.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [file]);

  // Escala em que a imagem cobre a moldura (zoom 1).
  const coverScale =
    source && frame.width
      ? Math.max(frame.width / source.width, frame.height / source.height)
      : 1;

  const constrain = useCallback(
    (next: View): View => {
      if (!source) {
        return next;
      }
      const zoom = clamp(next.zoom, minZoom, maxZoom);
      const width = source.width * coverScale * zoom;
      const height = source.height * coverScale * zoom;
      const limitX = Math.abs(width - frame.width) / 2;
      const limitY = Math.abs(height - frame.height) / 2;
      return {
        x: clamp(next.x, -limitX, limitX),
        y: clamp(next.y, -limitY, limitY),
        zoom,
      };
    },
    [coverScale, frame.height, frame.width, source]
  );

  const zoomTo = (zoom: number) =>
    setView((current) => {
      // Mantém o centro da moldura no mesmo ponto da imagem.
      const factor = clamp(zoom, minZoom, maxZoom) / current.zoom;
      return constrain({
        x: current.x * factor,
        y: current.y * factor,
        zoom,
      });
    });

  const close = () => {
    if (!isSaving) {
      onCancel();
    }
  };

  const confirm = async () => {
    if (!(source && file && frame.width)) {
      return;
    }
    setIsSaving(true);
    setError("");
    const scale = coverScale * view.zoom;
    // Não amplia além dos pixels que a imagem de fato tem na moldura.
    const visibleSourceWidth = frame.width / scale;
    const width = Math.round(
      clamp(Math.min(outputWidth, visibleSourceWidth), 320, outputWidth)
    );
    const height = Math.round(width / aspect);
    const ratio = width / frame.width;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setIsSaving(false);
      setError("Este navegador não conseguiu recortar a imagem.");
      return;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const drawWidth = source.width * scale * ratio;
    const drawHeight = source.height * scale * ratio;
    context.drawImage(
      source.image,
      width / 2 + view.x * ratio - drawWidth / 2,
      height / 2 + view.y * ratio - drawHeight / 2,
      drawWidth,
      drawHeight
    );
    let blob = await encode(canvas, "image/webp", 0.92);
    if (!blob || blob.type !== "image/webp") {
      blob = await encode(canvas, "image/jpeg", 0.92);
    }
    if (!blob) {
      setIsSaving(false);
      setError("Não foi possível gerar a imagem recortada.");
      return;
    }
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(extensionPattern, "") || "imagem";
    onConfirm(
      new File([blob], `${baseName}-recorte.${extension}`, { type: blob.type })
    );
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointersRef.current.values()];
    const [first, second] = points;
    gestureRef.current = {
      distance:
        first && second
          ? Math.hypot(first.x - second.x, first.y - second.y)
          : 0,
      view,
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const gesture = gestureRef.current;
    if (!gesture) {
      return;
    }
    const points = [...pointersRef.current.values()];
    const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const [first, second] = points;
    let zoom = gesture.view.zoom;
    if (first && second && gesture.distance > 0) {
      zoom =
        gesture.view.zoom *
        (Math.hypot(first.x - second.x, first.y - second.y) / gesture.distance);
    }
    const factor = clamp(zoom, minZoom, maxZoom) / gesture.view.zoom;
    setView(
      constrain({
        x: gesture.view.x * factor + (x - gesture.x),
        y: gesture.view.y * factor + (y - gesture.y),
        zoom,
      })
    );
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    const points = [...pointersRef.current.values()];
    setIsDragging(points.length > 0);
    gestureRef.current = points.length
      ? {
          distance: 0,
          view,
          x: points[0]?.x ?? 0,
          y: points[0]?.y ?? 0,
        }
      : null;
  };

  // Roda do mouse aproxima e afasta; precisa ser não passivo para não rolar
  // a página por trás do pop-up.
  useEffect(() => {
    const element = frameRef.current;
    if (!element) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -zoomStep : zoomStep;
      setView((current) => {
        const zoom = clamp(current.zoom + delta, minZoom, maxZoom);
        const factor = zoom / current.zoom;
        return constrain({
          x: current.x * factor,
          y: current.y * factor,
          zoom,
        });
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [constrain]);

  // Ao trocar de imagem ou de tamanho, o enquadramento volta a ser válido.
  useEffect(() => {
    setView((current) => constrain(current));
  }, [constrain]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setView((current) =>
        constrain({
          ...current,
          x: current.x + move[0],
          y: current.y + move[1],
        })
      );
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomTo(view.zoom + zoomStep);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomTo(view.zoom - zoomStep);
    }
  };

  const scale = coverScale * view.zoom;
  const percent = Math.round(view.zoom * 100);

  return (
    <dialog
      aria-labelledby={titleId}
      className="image-crop-dialog"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      ref={dialogRef}
    >
      <div className="image-crop-dialog__panel">
        <span aria-hidden="true" className="image-crop-dialog__handle" />
        <header className="image-crop-dialog__header">
          <div>
            {/* O foco inicial fica no título, não na moldura, para não abrir o
                pop-up já com o contorno de foco do teclado. */}
            <h2 autoFocus id={titleId} tabIndex={-1}>
              {title}
            </h2>
            <p>Arraste a imagem para enquadrar e use o zoom para ajustar.</p>
          </div>
          <button
            aria-label="Fechar"
            className="image-crop-dialog__close"
            disabled={isSaving}
            onClick={close}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-4" />
          </button>
        </header>
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: a moldura é um controle de arrastar e pinçar; o teclado move e aproxima pela mesma área. */}
        <div
          aria-label="Área de recorte. Use as setas para mover e + ou − para o zoom."
          className="image-crop-dialog__frame"
          data-dragging={isDragging ? "true" : undefined}
          data-shape={shape}
          onKeyDown={onKeyDown}
          onPointerCancel={onPointerEnd}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          ref={frameRef}
          role="application"
          style={{ aspectRatio: String(aspect) }}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a moldura precisa de foco para as setas e o zoom pelo teclado.
          tabIndex={0}
        >
          {source ? (
            // biome-ignore lint/performance/noImgElement: local object URL of the file being cropped.
            <img
              alt=""
              draggable={false}
              height={source.height}
              src={source.url}
              style={{
                transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px)`,
                width: source.width * scale,
                height: source.height * scale,
              }}
              width={source.width}
            />
          ) : (
            <span className="image-crop-dialog__loading">
              {error || "Abrindo imagem…"}
            </span>
          )}
          {source ? (
            <>
              <span aria-hidden="true" className="image-crop-dialog__grid" />
              <span aria-hidden="true" className="image-crop-dialog__hint">
                <MoveIcon className="size-3.5" /> Arraste para mover
              </span>
            </>
          ) : null}
        </div>
        <div className="image-crop-dialog__zoom">
          <button
            aria-label="Afastar"
            disabled={!source || view.zoom <= minZoom}
            onClick={() => zoomTo(view.zoom - zoomStep)}
            type="button"
          >
            <MinusIcon aria-hidden="true" className="size-4" />
          </button>
          <input
            aria-label="Zoom"
            aria-valuetext={`${percent}%`}
            disabled={!source}
            max={maxZoom}
            min={minZoom}
            onChange={(event) => zoomTo(Number(event.currentTarget.value))}
            step={0.01}
            type="range"
            value={view.zoom}
          />
          <button
            aria-label="Aproximar"
            disabled={!source || view.zoom >= maxZoom}
            onClick={() => zoomTo(view.zoom + zoomStep)}
            type="button"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
          </button>
          <output className="image-crop-dialog__percent">{percent}%</output>
          <button
            aria-label="Centralizar e voltar ao zoom inicial"
            disabled={!source || (view.zoom === 1 && !view.x && !view.y)}
            onClick={() => setView({ x: 0, y: 0, zoom: 1 })}
            type="button"
          >
            <RotateCcwIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
        {error && source ? (
          <p className="image-crop-dialog__error" role="alert">
            {error}
          </p>
        ) : null}
        <footer className="image-crop-dialog__actions">
          <Button
            disabled={isSaving}
            onClick={close}
            type="button"
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            disabled={!source || isSaving}
            onClick={() => {
              confirm().catch(() => {
                setIsSaving(false);
                setError("Não foi possível gerar a imagem recortada.");
              });
            }}
            type="button"
          >
            {isSaving ? "Preparando…" : "Usar imagem"}
          </Button>
        </footer>
      </div>
    </dialog>
  );
};
