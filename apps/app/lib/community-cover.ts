import type { CSSProperties } from "react";

/**
 * Enquadramento não destrutivo da capa. A imagem original é guardada sem
 * recorte; o recorte 16:9 é feito na exibição, com a mesma conta no feed, na
 * publicação e nos previews do editor.
 *
 * `focusX` e `focusY` (0 a 1) dizem onde a janela está dentro da imagem. A
 * imagem é primeiro ajustada em `object-fit: cover`; depois recebe `scale(zoom)`
 * com origem no mesmo ponto do `object-position`. Como a origem é o ponto de
 * foco, a imagem ampliada sempre cobre a janela: não existe borda vazia.
 */
export interface CommunityCoverFraming {
  readonly focusX: number;
  readonly focusY: number;
  readonly height: number | null;
  readonly width: number | null;
  readonly zoom: number;
}

export const communityCoverMinZoom = 1;
export const communityCoverMaxZoom = 3;
/** Largura recomendada da original. Só avisa; nunca bloqueia o envio. */
export const communityCoverRecommendedWidth = 1600;
export const communityCoverAspect = 16 / 9;

export const defaultCommunityCoverFraming: CommunityCoverFraming = {
  focusX: 0.5,
  focusY: 0.5,
  height: null,
  width: null,
  zoom: 1,
};

/** Campos do Prisma que compõem o enquadramento. */
export const communityCoverFramingSelect = {
  coverFocusX: true,
  coverFocusY: true,
  coverHeight: true,
  coverWidth: true,
  coverZoom: true,
} as const;

export interface CommunityCoverFramingRecord {
  readonly coverFocusX?: number | null;
  readonly coverFocusY?: number | null;
  readonly coverHeight?: number | null;
  readonly coverWidth?: number | null;
  readonly coverZoom?: number | null;
}

export const clampUnit = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;

export const clampCoverZoom = (value: number) =>
  Number.isFinite(value)
    ? Math.min(communityCoverMaxZoom, Math.max(communityCoverMinZoom, value))
    : communityCoverMinZoom;

const dimension = (value: unknown) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 100_000
    ? Math.round(value)
    : null;

/** Normaliza qualquer origem (linha do banco, formulário) para valores válidos. */
export const normalizeCommunityCoverFraming = (
  value?: Partial<CommunityCoverFraming> | null
): CommunityCoverFraming => ({
  focusX: clampUnit(value?.focusX ?? 0.5),
  focusY: clampUnit(value?.focusY ?? 0.5),
  height: dimension(value?.height),
  width: dimension(value?.width),
  zoom: clampCoverZoom(value?.zoom ?? 1),
});

export const communityCoverFramingFromRecord = (
  record: CommunityCoverFramingRecord | null | undefined
): CommunityCoverFraming =>
  normalizeCommunityCoverFraming({
    focusX: record?.coverFocusX ?? undefined,
    focusY: record?.coverFocusY ?? undefined,
    height: record?.coverHeight,
    width: record?.coverWidth,
    zoom: record?.coverZoom ?? undefined,
  });

/** Campos de gravação (Prisma) a partir de um enquadramento. */
export const communityCoverFramingData = (framing: CommunityCoverFraming) => ({
  coverFocusX: framing.focusX,
  coverFocusY: framing.focusY,
  coverHeight: framing.height,
  coverWidth: framing.width,
  coverZoom: framing.zoom,
});

const readNumber = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const communityCoverFramingFromForm = (
  formData: FormData
): CommunityCoverFraming =>
  normalizeCommunityCoverFraming({
    focusX: readNumber(formData.get("coverFocusX")),
    focusY: readNumber(formData.get("coverFocusY")),
    height: readNumber(formData.get("coverHeight")),
    width: readNumber(formData.get("coverWidth")),
    zoom: readNumber(formData.get("coverZoom")),
  });

export const isDefaultCommunityCoverFraming = (
  framing: CommunityCoverFraming
) => framing.zoom === 1 && framing.focusX === 0.5 && framing.focusY === 0.5;

export const communityCoverFramingEqual = (
  left: CommunityCoverFraming,
  right: CommunityCoverFraming
) =>
  left.focusX === right.focusX &&
  left.focusY === right.focusY &&
  left.height === right.height &&
  left.width === right.width &&
  left.zoom === right.zoom;

const percent = (value: number) => `${Math.round(value * 10_000) / 100}%`;

/** Estilo CSS da `<img>` dentro de uma janela 16:9 com `overflow: hidden`. */
export const communityCoverImageStyle = (
  framing: CommunityCoverFraming
): CSSProperties => {
  const x = percent(framing.focusX);
  const y = percent(framing.focusY);
  return {
    objectPosition: `${x} ${y}`,
    ...(framing.zoom === 1
      ? {}
      : {
          transform: `scale(${framing.zoom})`,
          transformOrigin: `${x} ${y}`,
        }),
  };
};

interface FrameGeometry {
  /** Altura da janela. */
  readonly frameHeight: number;
  /** Largura da janela. */
  readonly frameWidth: number;
  /** Proporção natural da imagem (largura ÷ altura). */
  readonly imageAspect: number;
}

/** Tamanho da imagem depois do `object-fit: cover`, em px da janela. */
const coveredSize = ({
  frameHeight,
  frameWidth,
  imageAspect,
}: FrameGeometry) => ({
  height: Math.max(frameHeight, frameWidth / imageAspect),
  width: Math.max(frameWidth, frameHeight * imageAspect),
});

/**
 * Converte um arraste (px dentro da janela) em novo foco. Com a origem do
 * zoom no foco, o início da janela visível na imagem é linear no foco:
 * `inicio = foco * (tamanhoCover - janela / zoom)`. Arrastar `d` px move o
 * início em `-d / zoom`, logo `Δfoco = -d / (zoom * tamanhoCover - janela)`.
 */
export const dragCommunityCoverFraming = (
  framing: CommunityCoverFraming,
  delta: { readonly x: number; readonly y: number },
  geometry: FrameGeometry
): CommunityCoverFraming => {
  const covered = coveredSize(geometry);
  const rangeX = framing.zoom * covered.width - geometry.frameWidth;
  const rangeY = framing.zoom * covered.height - geometry.frameHeight;
  return {
    ...framing,
    focusX:
      rangeX > 0.5
        ? clampUnit(framing.focusX - delta.x / rangeX)
        : framing.focusX,
    focusY:
      rangeY > 0.5
        ? clampUnit(framing.focusY - delta.y / rangeY)
        : framing.focusY,
  };
};

/** Retângulo visível, em fração da imagem original (para testes e avisos). */
export const visibleCommunityCoverRect = (
  framing: CommunityCoverFraming,
  geometry: FrameGeometry
) => {
  const covered = coveredSize(geometry);
  const windowWidth = geometry.frameWidth / framing.zoom;
  const windowHeight = geometry.frameHeight / framing.zoom;
  const left = framing.focusX * (covered.width - windowWidth);
  const top = framing.focusY * (covered.height - windowHeight);
  return {
    bottom: (top + windowHeight) / covered.height,
    left: left / covered.width,
    right: (left + windowWidth) / covered.width,
    top: top / covered.height,
  };
};

export const isBelowRecommendedCoverWidth = (width: number | null) =>
  width !== null && width < communityCoverRecommendedWidth;
