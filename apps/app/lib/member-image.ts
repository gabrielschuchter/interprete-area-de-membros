import "server-only";

import sharp from "sharp";

export type MemberImageKind =
  | "avatar"
  | "cover"
  | "inline"
  | "submission"
  | "library";

export const memberImageInputTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const limits: Record<
  MemberImageKind,
  { readonly width: number; readonly height: number }
> = {
  avatar: { width: 512, height: 512 },
  cover: { width: 2000, height: 1200 },
  inline: { width: 2000, height: 2000 },
  submission: { width: 2000, height: 2000 },
  library: { width: 2000, height: 2000 },
};

const qualities: Record<MemberImageKind, number> = {
  avatar: 86,
  cover: 84,
  inline: 84,
  submission: 82,
  library: 82,
};

export class MemberImageError extends Error {
  constructor(message = "Não foi possível processar esta imagem.") {
    super(message);
    this.name = "MemberImageError";
  }
}

export const normalizeMemberImage = async (
  file: File,
  kind: MemberImageKind
) => {
  if (!memberImageInputTypes.has(file.type)) {
    throw new MemberImageError("Envie uma imagem JPG, PNG ou WebP.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  let inputMetadata: { format?: string; width?: number; height?: number };

  try {
    inputMetadata = await sharp(input).metadata();
  } catch {
    throw new MemberImageError("O arquivo enviado não é uma imagem válida.");
  }

  if (!(inputMetadata.format && inputMetadata.width && inputMetadata.height)) {
    throw new MemberImageError("Não foi possível ler as dimensões da imagem.");
  }

  const limit = limits[kind];
  let output: Buffer;

  try {
    output = await sharp(input)
      // Applies EXIF orientation before writing and omits the original EXIF,
      // including GPS/camera metadata, from the resulting asset.
      .rotate()
      .resize({
        width: limit.width,
        height: limit.height,
        fit: "inside",
        withoutEnlargement: true,
      })
      // smartSubsample preserva as bordas coloridas (texto, vermelhos da
      // marca) que a subamostragem padrão de croma borra; qualidade um pouco
      // maior para fotos de pessoas e capas, que são o que mais se vê.
      .webp({ quality: qualities[kind], effort: 5, smartSubsample: true })
      .toBuffer();
  } catch {
    throw new MemberImageError("Não foi possível otimizar esta imagem.");
  }

  const outputMetadata = await sharp(output).metadata();
  if (!(outputMetadata.width && outputMetadata.height && output.length > 0)) {
    throw new MemberImageError("A imagem otimizada ficou inválida.");
  }

  return {
    body: output,
    mimeType: "image/webp" as const,
    extension: "webp" as const,
    inputMimeType: file.type,
    inputSize: file.size,
    inputWidth: inputMetadata.width,
    inputHeight: inputMetadata.height,
    width: outputMetadata.width,
    height: outputMetadata.height,
    size: output.length,
  };
};
