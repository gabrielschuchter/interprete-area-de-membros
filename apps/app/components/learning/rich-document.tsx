import type { ReactNode } from "react";

interface RichMark {
  readonly attrs?: Record<string, unknown>;
  readonly type?: string;
}

interface RichNode {
  readonly attrs?: Record<string, unknown>;
  readonly content?: readonly RichNode[];
  readonly marks?: readonly RichMark[];
  readonly text?: string;
  readonly type?: string;
}

const asRichNode = (value: unknown): RichNode | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as RichNode;
};

const getChildren = (node: RichNode) =>
  Array.isArray(node.content) ? node.content : [];

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

  if (isMemberAssetUrl(value)) {
    return value;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const applyMark = (
  content: ReactNode,
  mark: RichMark,
  key: string
): ReactNode => {
  switch (mark.type) {
    case "bold":
      return <strong key={`${key}-bold`}>{content}</strong>;
    case "italic":
      return <em key={`${key}-italic`}>{content}</em>;
    case "code":
      return (
        <code
          className="rounded-sm bg-muted px-1.5 py-0.5 font-data text-sm"
          key={`${key}-code`}
        >
          {content}
        </code>
      );
    case "link": {
      const href = safeHref(mark.attrs?.href);

      if (!href) {
        return content;
      }

      return (
        <a
          className="font-medium text-primary underline underline-offset-4"
          href={href}
          key={`${key}-link`}
          rel="noreferrer"
          target="_blank"
        >
          {content}
        </a>
      );
    }
    default:
      return content;
  }
};

const renderInline = (
  node: RichNode,
  key: string,
  currentMemberId?: string
): ReactNode => {
  if (node.type === "text") {
    let content: ReactNode = node.text ?? "";

    for (const [index, mark] of (node.marks ?? []).entries()) {
      content = applyMark(content, mark, `${key}-${index}`);
    }

    return content;
  }

  if (node.type === "hardBreak") {
    return <br key={key} />;
  }

  if (node.type === "mention") {
    const id = typeof node.attrs?.id === "string" ? node.attrs.id : "";
    let username = "membro";
    if (typeof node.attrs?.username === "string") {
      username = node.attrs.username;
    } else if (typeof node.attrs?.label === "string") {
      username = node.attrs.label;
    }
    return (
      <span
        className={
          id && id === currentMemberId
            ? "community-mention community-mention-current"
            : "community-mention"
        }
        data-mention-id={id || undefined}
        key={key}
      >
        @{username}
      </span>
    );
  }

  return getChildren(node).map((child, index) =>
    renderInline(child, `${key}-${index}`, currentMemberId)
  );
};

const renderBlock = (
  node: RichNode,
  key: string,
  currentMemberId?: string
): ReactNode => {
  const children = getChildren(node);
  const renderedChildren = children.map((child, index) =>
    node.type === "paragraph" || node.type === "heading"
      ? renderInline(child, `${key}-${index}`, currentMemberId)
      : renderBlock(child, `${key}-${index}`, currentMemberId)
  );

  switch (node.type) {
    case "doc":
      return <div key={key}>{renderedChildren}</div>;
    case "paragraph":
      return (
        <p className="leading-7" key={key}>
          {renderedChildren}
        </p>
      );
    case "heading": {
      const level =
        typeof node.attrs?.level === "number" &&
        node.attrs.level >= 1 &&
        node.attrs.level <= 6
          ? node.attrs.level
          : 2;
      let className = "font-display text-xl leading-tight tracking-tight";

      if (level === 1) {
        className = "font-display text-3xl leading-tight tracking-tight";
      } else if (level === 2) {
        className = "font-display text-2xl leading-tight tracking-tight";
      }

      if (level === 1) {
        return (
          <h1 className={className} key={key}>
            {renderedChildren}
          </h1>
        );
      }

      if (level === 2) {
        return (
          <h2 className={className} key={key}>
            {renderedChildren}
          </h2>
        );
      }

      return (
        <h3 className={className} key={key}>
          {renderedChildren}
        </h3>
      );
    }
    case "bulletList":
      return (
        <ul className="list-disc space-y-2 pl-6" key={key}>
          {renderedChildren}
        </ul>
      );
    case "orderedList":
      return (
        <ol className="list-decimal space-y-2 pl-6" key={key}>
          {renderedChildren}
        </ol>
      );
    case "listItem":
      return <li key={key}>{renderedChildren}</li>;
    case "blockquote":
      return (
        <blockquote
          className="border-brand-action/60 border-l-2 pl-5 text-muted-foreground italic"
          key={key}
        >
          {renderedChildren}
        </blockquote>
      );
    case "horizontalRule":
      return <hr className="border-border" key={key} />;
    case "image": {
      const src = safeHref(node.attrs?.src);
      if (!src) {
        return null;
      }

      return (
        <figure className="space-y-2" key={key}>
          {/* biome-ignore lint/performance/noImgElement: document images are sanitized external URLs and may come from hosts not configured for next/image. */}
          <img
            alt={typeof node.attrs?.alt === "string" ? node.attrs.alt : ""}
            className="h-auto max-h-[42rem] w-full rounded-sm border object-contain"
            height={675}
            loading="lazy"
            referrerPolicy="no-referrer"
            src={src}
            width={1200}
          />
          {typeof node.attrs?.title === "string" && node.attrs.title && (
            <figcaption className="text-muted-foreground text-sm">
              {node.attrs.title}
            </figcaption>
          )}
        </figure>
      );
    }
    case "codeBlock":
      return (
        <pre
          className="paper-surface overflow-x-auto border p-4 font-data text-sm"
          key={key}
        >
          <code>
            {children.map((child, index) =>
              renderInline(child, `${key}-${index}`, currentMemberId)
            )}
          </code>
        </pre>
      );
    default:
      return children.length > 0 ? (
        <div className="space-y-4" key={key}>
          {renderedChildren}
        </div>
      ) : null;
  }
};

interface RichDocumentProperties {
  readonly currentMemberId?: string;
  readonly value: unknown;
}

export const RichDocument = ({
  currentMemberId,
  value,
}: RichDocumentProperties) => {
  const document = asRichNode(value);

  if (!document) {
    return null;
  }

  return (
    <div className="space-y-5">
      {renderBlock(document, "document", currentMemberId)}
    </div>
  );
};
