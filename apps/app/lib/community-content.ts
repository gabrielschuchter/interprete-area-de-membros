const allowedNodes = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "codeBlock",
  "image",
  "communityArticle",
  "communityFile",
  "communityVideo",
  "mention",
]);

const allowedMarks = new Set(["bold", "italic", "code", "link"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isMemberAssetUrl = (value: string) => {
  if (!value.startsWith("/api/member-assets?path=")) {
    return false;
  }

  try {
    const path = new URL(value, "https://interprete.local").searchParams.get(
      "path"
    );
    return Boolean(
      path &&
        !path.includes("..") &&
        [
          "community-assets/inline/",
          "community-assets/covers/",
          "community-assets/attachments/",
          "profile-assets/avatars/",
        ].some((prefix) => path.startsWith(prefix))
    );
  } catch {
    return false;
  }
};

const safeHref = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  if (isMemberAssetUrl(value)) {
    return value;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: rich-document attribute validation keeps every persisted media and mention attribute in one allowlist.
const sanitizeAttr = (key: string, value: unknown) => {
  if (
    (key === "href" || key === "src" || key === "url") &&
    typeof value === "string"
  ) {
    const href = safeHref(value);
    return href ? ([key, href] as const) : null;
  }
  if (key === "level" && typeof value === "number") {
    return [key, Math.min(3, Math.max(2, value))] as const;
  }
  if (
    (key === "alt" ||
      key === "title" ||
      key === "name" ||
      key === "mimeType" ||
      key === "authors" ||
      key === "journal" ||
      key === "doi") &&
    typeof value === "string"
  ) {
    return [key, value.slice(0, 240)] as const;
  }
  if (
    (key === "width" || key === "height" || key === "sizeBytes") &&
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return [key, Math.min(50_000_000, Math.max(0, Math.floor(value)))] as const;
  }
  if (key === "year" && typeof value === "number" && Number.isFinite(value)) {
    return [key, Math.min(2200, Math.max(1500, Math.floor(value)))] as const;
  }
  if (key === "provider" && (value === "youtube" || value === "vimeo")) {
    return [key, value] as const;
  }
  if (
    key === "metadataStatus" &&
    (value === "available" || value === "unavailable")
  ) {
    return [key, value] as const;
  }
  if (
    (key === "id" || key === "username" || key === "label") &&
    typeof value === "string"
  ) {
    return [key, value.slice(0, 120)] as const;
  }
  if (key === "kind" && (value === "USER" || value === "GROUP")) {
    return [key, value] as const;
  }
  if (key === "recipientCount" && typeof value === "number") {
    return [key, Math.min(100_000, Math.max(0, Math.floor(value)))] as const;
  }
  return null;
};

const sanitizeAttrs = (value: unknown) => {
  if (!isRecord(value)) {
    return undefined;
  }
  const attrs: Record<string, string | number> = {};
  for (const [key, attr] of Object.entries(value)) {
    const sanitized = sanitizeAttr(key, attr);
    if (sanitized) {
      attrs[sanitized[0]] = sanitized[1];
    }
  }
  return Object.keys(attrs).length > 0 ? attrs : undefined;
};

const sanitizeMarks = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const marks = value.filter(isRecord).flatMap((mark) => {
    if (typeof mark.type !== "string" || !allowedMarks.has(mark.type)) {
      return [];
    }
    if (mark.type === "link") {
      const attrs = sanitizeAttrs(mark.attrs);
      return attrs && typeof attrs.href === "string"
        ? [{ type: "link", attrs }]
        : [];
    }
    return [{ type: mark.type }];
  });
  return marks.length > 0 ? marks : undefined;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: recursive document sanitization deliberately validates node type, attributes, marks, and bounded children together.
function sanitizeNode(
  value: unknown,
  depth: number
): Record<string, unknown> | null {
  if (
    depth > 8 ||
    !isRecord(value) ||
    typeof value.type !== "string" ||
    !allowedNodes.has(value.type)
  ) {
    return null;
  }
  const node: Record<string, unknown> = { type: value.type };
  if (value.type === "text") {
    const text =
      typeof value.text === "string" ? value.text.slice(0, 20_000) : "";
    if (!text) {
      return null;
    }
    node.text = text;
  }
  const attrs = sanitizeAttrs(value.attrs);
  const marks = sanitizeMarks(value.marks);
  if (value.type === "image" && (!attrs || typeof attrs.src !== "string")) {
    return null;
  }
  if (
    value.type === "communityFile" &&
    (!attrs || typeof attrs.src !== "string" || typeof attrs.name !== "string")
  ) {
    return null;
  }
  if (
    value.type === "communityVideo" &&
    (!attrs || typeof attrs.src !== "string")
  ) {
    return null;
  }
  if (
    value.type === "communityArticle" &&
    (!attrs || (typeof attrs.url !== "string" && typeof attrs.doi !== "string"))
  ) {
    return null;
  }
  if (
    value.type === "mention" &&
    (!attrs ||
      typeof attrs.id !== "string" ||
      typeof attrs.username !== "string")
  ) {
    return null;
  }
  if (attrs) {
    node.attrs = attrs;
  }
  if (marks) {
    node.marks = marks;
  }
  if (Array.isArray(value.content)) {
    node.content = value.content
      .map((child) => sanitizeNode(child, depth + 1))
      .filter((child): child is Record<string, unknown> => child !== null)
      .slice(0, 200);
  }
  return node;
}

export const sanitizeRichDocument = (value: unknown) => {
  const document = sanitizeNode(value, 0);
  return document?.type === "doc" ? document : null;
};

export const plainTextFromDocument = (value: unknown) => {
  const collect = (node: unknown): string => {
    if (!isRecord(node)) {
      return "";
    }
    if (node.type === "text") {
      return typeof node.text === "string" ? node.text : "";
    }
    if (node.type === "hardBreak") {
      return "\n";
    }
    if (node.type === "mention") {
      const attrs = isRecord(node.attrs) ? node.attrs : {};
      const username =
        typeof attrs.username === "string" ? attrs.username : "membro";
      return `@${username}`;
    }
    return collectChildren(node, collect);
  };

  return collect(value)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 40_000);
};

const collectChildren = (
  node: Record<string, unknown>,
  collect: (child: unknown) => string
) => {
  if (!Array.isArray(node.content)) {
    return "";
  }
  const content = node.content.map(collect).join("");
  return node.type === "paragraph" || node.type === "heading"
    ? `${content}\n`
    : content;
};
