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
]);

const allowedMarks = new Set(["bold", "italic", "code", "link"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const safeHref = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
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

const sanitizeAttrs = (value: unknown) => {
  if (!isRecord(value)) {
    return undefined;
  }
  const attrs: Record<string, string | number> = {};
  for (const [key, attr] of Object.entries(value)) {
    if (key === "href" && typeof attr === "string") {
      const href = safeHref(attr);
      if (href) {
        attrs[key] = href;
      }
    } else if (key === "level" && typeof attr === "number") {
      attrs[key] = Math.min(3, Math.max(2, attr));
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
    if (!Array.isArray(node.content)) {
      return "";
    }
    const content = node.content.map(collect).join("");
    return node.type === "paragraph" || node.type === "heading"
      ? `${content}\n`
      : content;
  };

  return collect(value)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 40_000);
};
