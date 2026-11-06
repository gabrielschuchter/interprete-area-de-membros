"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import {
  type CommunityCoverFraming,
  communityCoverImageStyle,
} from "@/lib/community-cover";

interface CommunityCoverImageProperties {
  readonly alt: string;
  readonly className: string;
  /** Enquadramento escolhido pelo autor (foco e zoom). Sem ele, centralizado. */
  readonly framing?: CommunityCoverFraming;
  readonly height: number;
  readonly loading?: "eager" | "lazy";
  readonly sizes?: string;
  readonly src: string;
  readonly srcSet?: string;
  readonly width: number;
}

export function CommunityCoverImage({
  alt,
  className,
  framing,
  height,
  loading = "lazy",
  sizes,
  src,
  srcSet,
  width,
}: CommunityCoverImageProperties) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <span
        aria-label={alt}
        className={`${className} community-cover-fallback`}
        role="img"
      >
        <ImageIcon aria-hidden="true" />
      </span>
    );
  }

  // Só o zoom precisa de moldura; o foco com zoom 1 é um object-position.
  const framed = Boolean(framing && framing.zoom !== 1);
  const style = framing ? communityCoverImageStyle(framing) : undefined;
  const image = (
    // Native image requests use user-provided hosts; onError renders the same asset slot's placeholder.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: The error event only swaps a failed image for its accessible visual fallback.
    // biome-ignore lint/performance/noImgElement: Community cover URLs are user-provided and may use hosts not configured for next/image.
    <img
      alt={alt}
      className={className}
      decoding="async"
      height={height}
      loading={loading}
      onError={() => setFailedSrc(src)}
      referrerPolicy="no-referrer"
      sizes={srcSet ? sizes : undefined}
      src={src}
      srcSet={srcSet}
      style={framed ? undefined : style}
      width={width}
    />
  );
  if (!framed) {
    return image;
  }
  // Com zoom, a imagem escala dentro da janela 16:9, que recorta o excesso.
  return (
    <span className={`${className} community-cover-frame`}>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: same error fallback as above. */}
      {/* biome-ignore lint/performance/noImgElement: same user-provided hosts as above. */}
      <img
        alt={alt}
        decoding="async"
        height={height}
        loading={loading}
        onError={() => setFailedSrc(src)}
        referrerPolicy="no-referrer"
        sizes={srcSet ? sizes : undefined}
        src={src}
        srcSet={srcSet}
        style={style}
        width={width}
      />
    </span>
  );
}
