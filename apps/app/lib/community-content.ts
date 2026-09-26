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
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const safeImageSrc = (value: unknown) =>
  typeof value === "string" && isMemberAssetUrl(value) ? value : null;

const sanitizeAttr = (key: string, value: unknown) => {
  if (key === "href") {
    const href = safeHref(value);
    return href ? ([key, href] as const) : null;
  }
  if (key === "src") {
    const src = safeImageSrc(value);
    return src ? ([key, src] as const) : null;
  }
  if (key === "level" && typeof value === "number") {
    return [key, Math.min(3, Math.max(2, value))] as const;
  }
  if ((key === "alt" || key === "title") && typeof value === "string") {
    return [key, value.slice(0, 240)] as const;
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
      const href = isRecord(mark.attrs) ? safeHref(mark.attrs.href) : null;
      return href ? [{ type: "link", attrs: { href } }] : [];
    }
    return [{ type: mark.type }];
  });
  return marks.length > 0 ? marks : undefined;
};

const sanitizeNode = (
  value: unknown,
  depth: number
): Record<string, unknown> | null => {
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
};

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
