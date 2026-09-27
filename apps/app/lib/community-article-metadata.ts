import "server-only";

import {
  articleUrlFrom,
  extractDoi,
  isScientificArticleReference,
} from "./community-media";

interface ArticleMetadata {
  readonly authors?: string;
  readonly journal?: string;
  readonly title?: string;
  readonly year?: number;
}

interface CrossrefAuthor {
  readonly family?: string;
  readonly given?: string;
}

interface CrossrefDate {
  readonly "date-parts"?: readonly (readonly number[])[];
}

interface CrossrefMessage {
  readonly author?: readonly CrossrefAuthor[];
  readonly "container-title"?: readonly string[];
  readonly published?: CrossrefDate;
  readonly "published-online"?: CrossrefDate;
  readonly "published-print"?: CrossrefDate;
  readonly title?: readonly string[];
  readonly [key: string]: unknown;
}

const ARTICLE_METADATA_CACHE_TTL = 15 * 60 * 1000;
const ARTICLE_REQUEST_TIMEOUT = 2500;
const articleMetadataCache = new Map<
  string,
  { readonly expiresAt: number; readonly value: ArticleMetadata | null }
>();
const articleMetadataRequests = new Map<
  string,
  Promise<ArticleMetadata | null>
>();

const yearFrom = (message: CrossrefMessage) => {
  const dates = [
    message.published?.["date-parts"]?.[0]?.[0],
    message["published-print"]?.["date-parts"]?.[0]?.[0],
    message["published-online"]?.["date-parts"]?.[0]?.[0],
  ];
  const year = dates.find(
    (value): value is number =>
      typeof value === "number" && value >= 1500 && value <= 2200
  );
  return year;
};

const parseArticleMetadata = (value: unknown): ArticleMetadata | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const message = (value as { message?: CrossrefMessage }).message;
  if (!message || typeof message !== "object") {
    return null;
  }
  const title = message.title?.[0]?.trim();
  const authors = (message.author ?? [])
    .map(({ family, given }) => [given, family].filter(Boolean).join(" "))
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");
  const journal = message["container-title"]?.[0]?.trim();
  const year = yearFrom(message);
  if (!(title || authors || journal || year)) {
    return null;
  }
  return {
    ...(authors ? { authors: authors.slice(0, 500) } : {}),
    ...(journal ? { journal: journal.slice(0, 240) } : {}),
    ...(title ? { title: title.slice(0, 240) } : {}),
    ...(year ? { year } : {}),
  };
};

const fetchArticleMetadata = (doi: string) => {
  const cached = articleMetadataCache.get(doi);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value);
  }
  const activeRequest = articleMetadataRequests.get(doi);
  if (activeRequest) {
    return activeRequest;
  }

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      ARTICLE_REQUEST_TIMEOUT
    );
    let metadata: ArticleMetadata | null = null;
    try {
      const response = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
        {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }
      );
      if (response.ok) {
        metadata = parseArticleMetadata(await response.json());
      }
    } catch {
      metadata = null;
    } finally {
      clearTimeout(timeout);
    }
    articleMetadataCache.set(doi, {
      expiresAt: Date.now() + ARTICLE_METADATA_CACHE_TTL,
      value: metadata,
    });
    return metadata;
  })().finally(() => {
    articleMetadataRequests.delete(doi);
  });
  articleMetadataRequests.set(doi, request);
  return request;
};

const enrichLinkMark = async (value: unknown) => {
  if (!value || typeof value !== "object") {
    return value;
  }
  const mark = value as Record<string, unknown>;
  if (mark.type !== "link") {
    return value;
  }
  const attrs =
    mark.attrs && typeof mark.attrs === "object"
      ? (mark.attrs as Record<string, unknown>)
      : null;
  const href = typeof attrs?.href === "string" ? attrs.href : null;
  if (
    !(
      href &&
      isScientificArticleReference(href) &&
      attrs?.metadataStatus !== "available" &&
      attrs?.metadataStatus !== "unavailable"
    )
  ) {
    return value;
  }

  const doi = extractDoi(href);
  if (!doi) {
    return {
      ...mark,
      attrs: { ...attrs, metadataStatus: "unavailable" },
    };
  }
  const metadata = await fetchArticleMetadata(doi);
  return {
    ...mark,
    attrs: {
      ...attrs,
      ...(metadata ?? {}),
      doi,
      metadataStatus: metadata ? "available" : "unavailable",
    },
  };
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: article enrichment traverses one bounded rich document and preserves every unrelated node unchanged.
const enrichNode = async (value: unknown): Promise<unknown> => {
  if (Array.isArray(value)) {
    return Promise.all(value.map((child) => enrichNode(child)));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const attrs =
    record.attrs && typeof record.attrs === "object"
      ? (record.attrs as Record<string, unknown>)
      : null;
  if (record.type === "communityArticle" && attrs) {
    const doi = extractDoi(attrs.doi ?? attrs.url);
    if (
      doi &&
      attrs.metadataStatus !== "available" &&
      attrs.metadataStatus !== "unavailable"
    ) {
      const metadata = await fetchArticleMetadata(doi);
      const articleUrl = articleUrlFrom(attrs.url ?? doi);
      return {
        ...record,
        attrs: {
          ...attrs,
          ...(articleUrl ? { url: articleUrl } : {}),
          doi,
          metadataStatus: metadata ? "available" : "unavailable",
          ...metadata,
        },
      };
    }
  }

  const enrichedRecord = { ...record };
  if (record.type === "text" && Array.isArray(record.marks)) {
    enrichedRecord.marks = await Promise.all(
      record.marks.map((mark) => enrichLinkMark(mark))
    );
  }
  if (Array.isArray(record.content)) {
    enrichedRecord.content = await enrichNode(record.content);
  }
  return enrichedRecord;
};

export const enrichCommunityArticleMetadata = (document: unknown) => {
  if (!document) {
    return Promise.resolve(document);
  }
  return enrichNode(document);
};
