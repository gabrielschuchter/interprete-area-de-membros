export type CommunityMediaProvider = "youtube" | "vimeo";

export interface CommunityMediaItem {
  readonly alt?: string;
  readonly authors?: string;
  readonly doi?: string;
  readonly domain?: string;
  readonly height?: number;
  readonly journal?: string;
  readonly kind: "article" | "file" | "image" | "link" | "video";
  readonly metadataStatus?: "available" | "unavailable";
  readonly mimeType?: string;
  readonly name?: string;
  readonly provider?: CommunityMediaProvider;
  readonly sizeBytes?: number;
  readonly src: string;
  readonly title?: string;
  readonly url?: string;
  readonly width?: number;
  readonly year?: number;
}

const memberAssetPrefixes = [
  "community-assets/inline/",
  "community-assets/covers/",
  "community-assets/attachments/",
  "profile-assets/avatars/",
] as const;

const doiPattern = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;
const directVideoPattern = /\.(mp4|webm|ogg)(?:$|[?#])/i;
const youtubeIdPattern = /^[A-Za-z0-9_-]{6,}$/;
const vimeoIdPattern = /^\d+$/;
const wwwPrefixPattern = /^www\./;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readString = (value: unknown, maxLength = 500) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : undefined;

const readNumber = (value: unknown, min = 0, max = 100_000_000) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
};

const readAttributes = (value: unknown) =>
  isRecord(value) ? value : ({} as Record<string, unknown>);

export const safeCommunityMediaUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const candidate = value.trim();

  if (candidate.startsWith("/api/member-assets?path=")) {
    try {
      const path = new URL(
        candidate,
        "https://interprete.local"
      ).searchParams.get("path");
      if (
        path &&
        !path.includes("..") &&
        memberAssetPrefixes.some((prefix) => path.startsWith(prefix))
      ) {
        return candidate.slice(0, 2000);
      }
    } catch {
      return null;
    }
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString().slice(0, 2000)
      : null;
  } catch {
    return null;
  }
};

export const communityMediaImageUrl = (
  value: string,
  variant: "thumb" | "full" = "full"
) => {
  if (variant !== "thumb" || !value.startsWith("/api/member-assets?path=")) {
    return value;
  }
  try {
    const url = new URL(value, "https://interprete.local");
    const path = url.searchParams.get("path");
    if (
      !(
        path &&
        ["community-assets/inline/", "community-assets/covers/"].some(
          (prefix) => path.startsWith(prefix)
        )
      )
    ) {
      return value;
    }
    url.searchParams.set("variant", "thumb");
    return `${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    return value;
  }
};

const trimDoiPunctuation = (value: string) =>
  value.replace(/[.,;:!?]+$/g, "").replace(/[\])}]+$/g, "");

export const extractDoi = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const candidate = value.trim();
  const directMatch = candidate.match(doiPattern)?.[0];
  if (directMatch) {
    return trimDoiPunctuation(directMatch);
  }

  try {
    const url = new URL(candidate);
    if (!(url.protocol === "https:" || url.protocol === "http:")) {
      return null;
    }
    if (!(url.hostname === "doi.org" || url.hostname === "dx.doi.org")) {
      return null;
    }
    const urlMatch = decodeURIComponent(url.pathname).match(doiPattern)?.[0];
    return urlMatch ? trimDoiPunctuation(urlMatch) : null;
  } catch {
    return null;
  }
};

export const articleUrlFrom = (value: unknown) => {
  const safeUrl = safeCommunityMediaUrl(value);
  if (safeUrl) {
    return safeUrl;
  }
  const doi = extractDoi(value);
  return doi ? `https://doi.org/${doi}` : null;
};

export const isScientificArticleReference = (value: unknown) => {
  const doi = extractDoi(value);
  if (doi) {
    return true;
  }
  if (typeof value !== "string") {
    return false;
  }
  try {
    const url = new URL(value);
    return [
      "europepmc.org",
      "ncbi.nlm.nih.gov",
      "pmc.ncbi.nlm.nih.gov",
      "pubmed.ncbi.nlm.nih.gov",
    ].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
};

const youtubeIdFrom = (url: URL) => {
  if (url.hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }
  if (
    url.hostname === "youtube.com" ||
    url.hostname === "www.youtube.com" ||
    url.hostname === "m.youtube.com" ||
    url.hostname === "www.youtube-nocookie.com"
  ) {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "embed" || segments[0] === "shorts") {
      return segments[1] ?? null;
    }
  }
  return null;
};

export const videoEmbedFromUrl = (value: unknown) => {
  const safeUrl = safeCommunityMediaUrl(value);
  if (!safeUrl) {
    return null;
  }
  try {
    const url = new URL(safeUrl);
    const youtubeId = youtubeIdFrom(url);
    if (youtubeId && youtubeIdPattern.test(youtubeId)) {
      return {
        provider: "youtube" as const,
        src: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`,
      };
    }

    if (
      url.hostname === "vimeo.com" ||
      url.hostname === "www.vimeo.com" ||
      url.hostname === "player.vimeo.com"
    ) {
      const segments = url.pathname.split("/").filter(Boolean);
      const videoId = segments[0] === "video" ? segments[1] : segments.at(-1);
      if (videoId && vimeoIdPattern.test(videoId)) {
        return {
          provider: "vimeo" as const,
          src: `https://player.vimeo.com/video/${videoId}`,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
};

const providerLabel = (provider: CommunityMediaProvider) =>
  provider === "youtube" ? "YouTube" : "Vimeo";

const domainFromUrl = (value: string) => {
  try {
    return new URL(value).hostname.replace(wwwPrefixPattern, "");
  } catch {
    return undefined;
  }
};

const mediaKey = (item: CommunityMediaItem) =>
  `${item.kind}:${item.src}:${item.doi ?? ""}`;

export const extractCommunityMedia = (value: unknown) => {
  const items: CommunityMediaItem[] = [];
  const seen = new Set<string>();
  const imageLimit = 4;
  const otherLimit = 4;

  const add = (item: CommunityMediaItem) => {
    if (seen.has(mediaKey(item))) {
      return;
    }
    if (
      item.kind === "image" &&
      items.filter(({ kind }) => kind === "image").length >= imageLimit
    ) {
      return;
    }
    if (
      item.kind !== "image" &&
      items.filter(({ kind }) => kind !== "image").length >= otherLimit
    ) {
      return;
    }
    seen.add(mediaKey(item));
    items.push(item);
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: media extraction walks one sanitized document and intentionally classifies each supported media node and link.
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isRecord(node)) {
      return;
    }

    const attrs = readAttributes(node.attrs);
    if (node.type === "image") {
      const src = safeCommunityMediaUrl(attrs.src);
      if (src) {
        add({
          alt: readString(attrs.alt, 240),
          height: readNumber(attrs.height, 1, 10_000),
          kind: "image",
          src,
          width: readNumber(attrs.width, 1, 10_000),
        });
      }
    } else if (node.type === "communityFile") {
      const src = safeCommunityMediaUrl(attrs.src);
      if (src) {
        add({
          kind: "file",
          mimeType: readString(attrs.mimeType, 120),
          name: readString(attrs.name, 180) ?? "Arquivo",
          sizeBytes: readNumber(attrs.sizeBytes, 0, 50_000_000),
          src,
        });
      }
    } else if (node.type === "communityVideo") {
      const src = safeCommunityMediaUrl(attrs.src);
      const provider = attrs.provider === "vimeo" ? "vimeo" : "youtube";
      if (src) {
        add({
          kind: "video",
          provider,
          src,
          title:
            readString(attrs.title, 180) ??
            `${providerLabel(provider)} · vídeo`,
        });
      }
    } else if (node.type === "communityArticle") {
      const url = articleUrlFrom(attrs.url ?? attrs.doi);
      if (url) {
        add({
          authors: readString(attrs.authors, 500),
          doi: extractDoi(attrs.doi ?? attrs.url) ?? undefined,
          journal: readString(attrs.journal, 240),
          kind: "article",
          metadataStatus:
            attrs.metadataStatus === "available" ||
            attrs.metadataStatus === "unavailable"
              ? attrs.metadataStatus
              : undefined,
          src: url,
          title: readString(attrs.title, 240),
          url,
          year: readNumber(attrs.year, 1500, 2200),
        });
      }
    } else if (node.type === "text" && Array.isArray(node.marks)) {
      const label = readString(node.text, 160);
      for (const mark of node.marks) {
        if (!isRecord(mark) || mark.type !== "link") {
          continue;
        }
        const markAttrs = readAttributes(mark.attrs);
        const href = safeCommunityMediaUrl(markAttrs.href);
        if (!href) {
          continue;
        }
        const video = videoEmbedFromUrl(href);
        if (video) {
          add({
            kind: "video",
            provider: video.provider,
            src: video.src,
            title: label ?? `${providerLabel(video.provider)} · vídeo`,
          });
          continue;
        }
        const directVideo = directVideoUrl(href);
        if (directVideo) {
          add({
            kind: "video",
            src: directVideo,
            title: label ?? "Vídeo",
          });
          continue;
        }
        if (isScientificArticleReference(href)) {
          add({
            authors: readString(markAttrs.authors, 500),
            doi: extractDoi(markAttrs.doi ?? href) ?? undefined,
            journal: readString(markAttrs.journal, 240),
            kind: "article",
            src: href,
            metadataStatus:
              markAttrs.metadataStatus === "available" ||
              markAttrs.metadataStatus === "unavailable"
                ? markAttrs.metadataStatus
                : undefined,
            title: readString(markAttrs.title, 240) ?? label,
            url: href,
            year: readNumber(markAttrs.year, 1500, 2200),
          });
          continue;
        }
        add({
          domain: domainFromUrl(href),
          kind: "link",
          src: href,
          title: label,
          url: href,
        });
      }
    }

    visit(node.content);
  };

  visit(value);
  return items;
};

export const formatCommunityFileSize = (sizeBytes: number | undefined) => {
  if (!(sizeBytes && sizeBytes > 0)) {
    return null;
  }
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1).replace(".0", "")} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1).replace(".0", "")} MB`;
};

export const communityMediaTypeLabel = (item: CommunityMediaItem) => {
  if (item.kind === "article") {
    return "Artigo científico";
  }
  if (item.kind === "video") {
    return "Vídeo · embed";
  }
  if (item.kind === "file") {
    return item.mimeType === "application/pdf" ? "PDF" : "Arquivo";
  }
  if (item.kind === "image") {
    return "Imagem";
  }
  return "Link";
};

export const directVideoUrl = (value: unknown) => {
  const url = safeCommunityMediaUrl(value);
  if (!(url && directVideoPattern.test(url))) {
    return null;
  }
  return url;
};
