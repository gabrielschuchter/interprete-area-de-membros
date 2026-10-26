"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onboardingCopy as copy } from "@/lib/onboarding/copy";

const OUTPUT = 512;

interface PhotoCropperProps {
  readonly onChange: (blob: Blob | null) => void;
  readonly size: number;
  readonly source: string;
}

// Square crop drawn on a canvas. Drag to position, slider to zoom (100% to
// 300%). The result is a 512 x 512 WebP without metadata.
export const PhotoCropper = ({ onChange, size, source }: PhotoCropperProps) => {
  const image = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null
  );
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const element = new Image();
    element.crossOrigin = "anonymous";
    element.onload = () => {
      image.current = element;
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setReady(true);
    };
    element.src = source;
  }, [source]);

  const draw = useCallback(
    (target: HTMLCanvasElement, side: number) => {
      const element = image.current;
      const context = target.getContext("2d");
      if (!(element && context)) {
        return;
      }
      const base = side / Math.min(element.width, element.height);
      const scale = base * zoom;
      const width = element.width * scale;
      const height = element.height * scale;
      const maxX = Math.max(0, (width - side) / 2);
      const maxY = Math.max(0, (height - side) / 2);
      const ratio = side / size;
      const x = Math.max(-maxX, Math.min(maxX, offset.x * ratio));
      const y = Math.max(-maxY, Math.min(maxY, offset.y * ratio));
      context.clearRect(0, 0, side, side);
      context.drawImage(
        element,
        (side - width) / 2 + x,
        (side - height) / 2 + y,
        width,
        height
      );
    },
    [offset.x, offset.y, size, zoom]
  );

  useEffect(() => {
    if (!(ready && canvas.current)) {
      return;
    }
    draw(canvas.current, size * 2);
    const handle = window.setTimeout(() => {
      const output = document.createElement("canvas");
      output.width = OUTPUT;
      output.height = OUTPUT;
      draw(output, OUTPUT);
      output.toBlob((blob) => onChange(blob), "image/webp", 0.85);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [draw, onChange, ready, size]);

  return (
    <div className="ob-crop">
      <canvas
        aria-label={copy.foto.enquadramento}
        className="ob-crop-canvas"
        height={size * 2}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            ox: offset.x,
            oy: offset.y,
          };
        }}
        onPointerMove={(event) => {
          if (drag.current) {
            setOffset({
              x: drag.current.ox + event.clientX - drag.current.x,
              y: drag.current.oy + event.clientY - drag.current.y,
            });
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        ref={canvas}
        style={{ height: size, width: size }}
        width={size * 2}
      />
      <label className="ob-crop-zoom">
        <span>{copy.foto.enquadramento}</span>
        <input
          aria-label={copy.foto.enquadramento}
          max={3}
          min={1}
          onChange={(event) => setZoom(Number(event.target.value))}
          step={0.02}
          type="range"
          value={zoom}
        />
      </label>
    </div>
  );
};
