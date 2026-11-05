"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

interface CommunityCoverImageProperties {
  readonly alt: string;
  readonly className: string;
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

  return (
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
      width={width}
    />
  );
}
