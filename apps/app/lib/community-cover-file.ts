/**
 * Prepara a original da capa para envio. O arquivo vai como foi escolhido; só
 * quando passa do limite do servidor (5 MB) ele é recodificado inteiro, sem
 * recorte, em WebP e com no máximo 2560 px no maior lado.
 */
export const coverUploadLimitBytes = 5 * 1024 * 1024;
export const coverUploadMaxEdge = 2560;
export const coverSourceLimitBytes = 25 * 1024 * 1024;
export const coverAcceptedTypes = ["image/jpeg", "image/png", "image/webp"];

const extensionPattern = /\.[^.]+$/u;

export interface PreparedCoverFile {
  readonly file: File;
  readonly height: number;
  readonly width: number;
}

/** Lado maior limitado, sem ampliar. */
export const scaledCoverSize = (
  width: number,
  height: number,
  maxEdge = coverUploadMaxEdge
) => {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
};

const encode = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality)
  );

const decode = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("invalid image"));
    image.src = src;
  });

export const prepareCoverOriginal = async (
  file: File,
  natural: { readonly height: number; readonly width: number }
): Promise<PreparedCoverFile> => {
  if (file.size <= coverUploadLimitBytes) {
    return { file, height: natural.height, width: natural.width };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await decode(url);
    const size = scaledCoverSize(natural.width, natural.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Este navegador não conseguiu preparar a imagem.");
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, size.width, size.height);
    for (const quality of [0.92, 0.85, 0.75, 0.65]) {
      const blob = await encode(canvas, quality);
      if (
        blob &&
        blob.type === "image/webp" &&
        blob.size <= coverUploadLimitBytes
      ) {
        const baseName = file.name.replace(extensionPattern, "") || "capa";
        return {
          file: new File([blob], `${baseName}.webp`, { type: blob.type }),
          height: size.height,
          width: size.width,
        };
      }
    }
    throw new Error("A imagem é grande demais. Escolha um arquivo menor.");
  } finally {
    URL.revokeObjectURL(url);
  }
};
