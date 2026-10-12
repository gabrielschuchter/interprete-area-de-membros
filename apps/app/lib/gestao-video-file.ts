export const GESTAO_VIDEO_UPLOAD_DEFAULT_LIMIT = 500_000_000;
export const GESTAO_VIDEO_UPLOAD_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
export const GESTAO_VIDEO_UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const videoMimeTypes = {
  "video/mp4": "mp4",
  "video/webm": "webm",
} as const;

export type GestaoVideoMimeType = keyof typeof videoMimeTypes;

export const isGestaoVideoMimeType = (
  value: string
): value is GestaoVideoMimeType => Object.hasOwn(videoMimeTypes, value);

export const gestaoVideoExtension = (mimeType: GestaoVideoMimeType) =>
  videoMimeTypes[mimeType];

const filePathSeparatorPattern = /[\\/]/;
const invalidFileNameCharacterPattern = /[^a-zA-Z0-9À-ÿ._() -]/g;
const repeatedWhitespacePattern = /\s+/g;

export const normalizeGestaoVideoFileName = (value: string) => {
  const basename =
    value.split(filePathSeparatorPattern).at(-1)?.normalize("NFKC").trim() ??
    "";
  const safeName = basename
    .replace(invalidFileNameCharacterPattern, "-")
    .replace(repeatedWhitespacePattern, " ")
    .slice(0, 220)
    .trim();
  return safeName || "video";
};

export const hasGestaoVideoSignature = (
  mimeType: string,
  bytes: Uint8Array
) => {
  if (mimeType === "video/mp4") {
    return (
      bytes.byteLength >= 12 &&
      String.fromCharCode(...bytes.slice(4, 8)) === "ftyp"
    );
  }
  if (mimeType === "video/webm") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  }
  return false;
};
