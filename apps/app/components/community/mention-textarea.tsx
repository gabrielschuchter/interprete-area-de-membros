"use client";

import { cn } from "@repo/design-system/lib/utils";
import { AtSignIcon } from "lucide-react";
import {
  type CSSProperties,
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

interface MentionCandidate {
  readonly avatarUrl: string | null;
  readonly context?: "DISCUSSION" | "COMMUNITY";
  readonly displayName: string | null;
  readonly id: string;
  readonly kind?: "USER" | "GROUP";
  readonly notificationEligible?: boolean;
  readonly notificationNote?: string;
  readonly recipientCount?: number;
  readonly role: string;
  readonly username: string;
}

interface MentionRange {
  readonly end: number;
  readonly start: number;
}

interface MentionTextareaProperties
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  readonly defaultDocument?: unknown;
  readonly documentName?: string;
  readonly onChange?: (value: string) => void;
  readonly onGroupMentionChange?: (
    hasGroupMention: boolean,
    confirmed: boolean
  ) => void;
  readonly postId?: string;
}

interface MentionSearchResponse {
  readonly communityItems?: MentionCandidate[];
  readonly discussionItems?: MentionCandidate[];
  readonly groups?: MentionCandidate[];
  readonly items?: MentionCandidate[];
}

const mentionPattern = /(?:^|\s)@([a-z0-9-]{0,30})$/i;
const mentionTokenPattern = /(^|\s)@([a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?)/gi;

interface MentionToken {
  readonly id: string;
  readonly kind: "USER" | "GROUP";
  readonly recipientCount?: number;
  readonly username: string;
}

const documentForValue = (value: string, mentions: readonly MentionToken[]) => {
  const content: Record<string, unknown>[] = [];
  let cursor = 0;
  for (const match of value.matchAll(mentionTokenPattern)) {
    const matchIndex = match.index ?? 0;
    const mentionStart = matchIndex + (match[1]?.length ?? 0);
    const username = match[2];
    const mentionEnd = mentionStart + username.length + 1;
    if (mentionStart > cursor) {
      content.push({ type: "text", text: value.slice(cursor, mentionStart) });
    }
    const token = mentions.find(
      (candidate) => candidate.username.toLowerCase() === username.toLowerCase()
    );
    if (token) {
      content.push({
        type: "mention",
        attrs: {
          id: token.id,
          kind: token.kind,
          label: username,
          recipientCount: token.recipientCount,
          username: token.username,
        },
      });
    } else {
      content.push({
        type: "text",
        text: value.slice(mentionStart, mentionEnd),
      });
    }
    cursor = mentionEnd;
  }
  if (cursor < value.length) {
    content.push({ type: "text", text: value.slice(cursor) });
  }
  return {
    type: "doc",
    content: [
      { content: content.length > 0 ? content : undefined, type: "paragraph" },
    ],
  };
};

const mentionTokenFromRecord = (record: Record<string, unknown>) => {
  if (record.type !== "mention" || !record.attrs) {
    return null;
  }
  if (typeof record.attrs !== "object") {
    return null;
  }
  const attrs = record.attrs as Record<string, unknown>;
  if (typeof attrs.id !== "string" || typeof attrs.username !== "string") {
    return null;
  }
  return {
    id: attrs.id,
    kind: attrs.kind === "GROUP" ? ("GROUP" as const) : ("USER" as const),
    recipientCount:
      typeof attrs.recipientCount === "number"
        ? attrs.recipientCount
        : undefined,
    username: attrs.username,
  };
};

const collectMentionTokens = (node: unknown, result: MentionToken[]): void => {
  if (!node || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      collectMentionTokens(child, result);
    }
    return;
  }
  const record = node as Record<string, unknown>;
  const token = mentionTokenFromRecord(record);
  if (token) {
    result.push(token);
  }
  for (const child of Object.values(record)) {
    collectMentionTokens(child, result);
  }
};

const mentionsFromDocument = (value: unknown): MentionToken[] => {
  const result: MentionToken[] = [];
  collectMentionTokens(value, result);
  return [...new Map(result.map((mention) => [mention.id, mention])).values()];
};

const candidatesFromSearch = (
  postId: string | undefined,
  result: MentionSearchResponse
) =>
  postId
    ? [
        ...(result.groups ?? []),
        ...(result.discussionItems ?? []),
        ...(result.communityItems ?? []),
      ]
    : (result.items ?? []);

const MentionAvatar = ({ candidate }: { candidate: MentionCandidate }) => (
  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-xs">
    {candidate.avatarUrl ? (
      // biome-ignore lint/performance/noImgElement: member assets resolve through an authenticated route.
      <img
        alt=""
        className="size-full object-cover object-center"
        height={32}
        src={candidate.avatarUrl}
        width={32}
      />
    ) : (
      (candidate.displayName ?? candidate.username).slice(0, 1).toUpperCase()
    )}
  </span>
);

const candidateMeta = (candidate: MentionCandidate) => {
  if (candidate.kind === "GROUP") {
    return ` · ${candidate.recipientCount ?? 0} membros`;
  }
  if (candidate.role !== "MEMBER") {
    return ` · ${candidate.role === "ADMIN" ? "Admin" : "Professor"}`;
  }
  return "";
};

export const MentionTextarea = ({
  className,
  defaultDocument,
  defaultValue,
  documentName = "contentDocument",
  onChange,
  onGroupMentionChange,
  postId,
  ...props
}: MentionTextareaProperties) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listboxId = useId();
  const [value, setValue] = useState(String(defaultValue ?? ""));
  const [range, setRange] = useState<MentionRange | null>(null);
  const [searchScope, setSearchScope] = useState<"discussion" | "community">(
    "discussion"
  );
  const [searchResult, setSearchResult] = useState<MentionSearchResponse>({});
  const [searchPending, setSearchPending] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<CSSProperties>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentions, setMentions] = useState<MentionToken[]>(() =>
    mentionsFromDocument(defaultDocument)
  );
  const [groupMentionConfirmed, setGroupMentionConfirmed] = useState(false);
  const hasGroupMention = mentions.some((mention) => mention.kind === "GROUP");
  const candidates = candidatesFromSearch(postId, searchResult);

  useEffect(() => {
    onGroupMentionChange?.(
      hasGroupMention,
      hasGroupMention ? groupMentionConfirmed : true
    );
  }, [groupMentionConfirmed, hasGroupMention, onGroupMentionChange]);

  useEffect(() => {
    if (!range) {
      setSearchResult({});
      setSearchScope("discussion");
      setSearchPending(false);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      q: value.slice(range.start + 1, range.end),
    });
    if (postId) {
      params.set("postId", postId);
      params.set("scope", searchScope);
    }
    setSearchPending(true);
    fetch(`/api/members/search?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          return {};
        }
        return (await response.json()) as MentionSearchResponse;
      })
      .then((payload: MentionSearchResponse) => {
        setSearchResult(payload);
        setSelectedIndex(0);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSearchResult({});
        }
      });
    const updatePopoverPosition = () => {
      const textarea = textareaRef.current;
      if (!(textarea && window.matchMedia("(max-width: 767px)").matches)) {
        setPopoverPosition(undefined);
        return;
      }
      const rect = textarea.getBoundingClientRect();
      const viewport = window.visualViewport;
      const visibleBottom =
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const availableHeight = viewport?.height ?? window.innerHeight;
      setPopoverPosition({
        position: "fixed",
        left: rect.left,
        right: Math.max(8, window.innerWidth - rect.right),
        bottom: Math.max(8, window.innerHeight - visibleBottom + 8),
        maxHeight: `min(14rem, ${Math.max(112, Math.floor(availableHeight * 0.55))}px)`,
      });
    };
    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.visualViewport?.addEventListener("resize", updatePopoverPosition);
    window.visualViewport?.addEventListener("scroll", updatePopoverPosition);
    return () => {
      controller.abort();
      window.removeEventListener("resize", updatePopoverPosition);
      window.visualViewport?.removeEventListener(
        "resize",
        updatePopoverPosition
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        updatePopoverPosition
      );
    };
  }, [postId, range, searchScope, value]);

  const updateValue = (nextValue: string, cursor: number) => {
    setValue(nextValue);
    setMentions((current) =>
      current.filter((mention) =>
        nextValue.toLowerCase().includes(`@${mention.username.toLowerCase()}`)
      )
    );
    onChange?.(nextValue);
    const beforeCursor = nextValue.slice(0, cursor);
    const match = beforeCursor.match(mentionPattern);
    if (!match) {
      setRange(null);
      return;
    }
    setRange({ end: cursor, start: cursor - match[1].length - 1 });
  };

  const chooseCandidate = (candidate: MentionCandidate) => {
    if (!range) {
      return;
    }
    const nextValue = `${value.slice(0, range.start)}@${candidate.username} ${value.slice(range.end)}`;
    const nextCursor = range.start + candidate.username.length + 2;
    updateValue(nextValue, nextCursor);
    setMentions((current) => [
      ...current.filter((mention) => mention.username !== candidate.username),
      {
        id: candidate.id,
        kind: candidate.kind === "GROUP" ? "GROUP" : "USER",
        recipientCount: candidate.recipientCount,
        username: candidate.username,
      },
    ]);
    if (candidate.kind === "GROUP") {
      setGroupMentionConfirmed(false);
    }
    setRange(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertMentionTrigger = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${value.slice(0, start)}@${value.slice(end)}`;
    const nextCursor = start + 1;
    updateValue(nextValue, nextCursor);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const showSuggestions = Boolean(range && (candidates.length > 0 || postId));

  const chooseSuggestion = (index: number) => {
    const candidate = candidates[index];
    if (candidate) {
      chooseCandidate(candidate);
    }
  };

  return (
    <div className="relative">
      <input
        name={documentName}
        type="hidden"
        value={JSON.stringify(documentForValue(value, mentions))}
      />
      <input
        name="confirmGroupMention"
        type="hidden"
        value={hasGroupMention && groupMentionConfirmed ? "1" : "0"}
      />
      <textarea
        {...props}
        aria-autocomplete="list"
        aria-controls={showSuggestions ? listboxId : undefined}
        className={cn(className)}
        defaultValue={undefined}
        onChange={(event) =>
          updateValue(event.target.value, event.target.selectionStart)
        }
        onKeyDown={(event) => {
          if (!showSuggestions) {
            props.onKeyDown?.(event);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((current) => (current + 1) % candidates.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex(
              (current) => (current - 1 + candidates.length) % candidates.length
            );
          } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            chooseSuggestion(selectedIndex);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setRange(null);
          } else {
            props.onKeyDown?.(event);
          }
        }}
        ref={textareaRef}
        value={value}
      />
      <div className="community-mention-toolbar">
        <button
          aria-label="Mencionar alguém"
          className="community-mention-toolbar__button"
          onClick={insertMentionTrigger}
          type="button"
        >
          <AtSignIcon aria-hidden="true" />
        </button>
      </div>
      {showSuggestions && (
        <div
          aria-label="Membros para mencionar"
          className="community-mention-list motion-layer absolute right-2 bottom-2 left-2 z-40 max-h-56 overflow-y-auto rounded-sm border bg-background p-1 shadow-[var(--shadow-floating)]"
          id={listboxId}
          role="listbox"
          style={popoverPosition}
        >
          {postId &&
            ((searchResult.groups?.length ?? 0) > 0 ||
              (searchResult.discussionItems?.length ?? 0) > 0) && (
              <div
                className="community-mention-list__section-title"
                role="presentation"
              >
                NESTA DISCUSSÃO
              </div>
            )}
          {candidates.slice(0, 16).map((candidate, index) => (
            <Fragment key={candidate.id}>
              {candidate.context === "COMMUNITY" &&
                searchResult.communityItems?.[0]?.id === candidate.id && (
                  <div
                    className="community-mention-list__section-title"
                    role="presentation"
                  >
                    NA COMUNIDADE
                  </div>
                )}
              <button
                aria-selected={index === selectedIndex}
                className={cn(
                  "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm",
                  index === selectedIndex ? "bg-accent" : "hover:bg-accent/60"
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseCandidate(candidate);
                }}
                role="option"
                type="button"
              >
                <MentionAvatar candidate={candidate} />
                <span className="min-w-0">
                  {candidate.kind === "GROUP" && (
                    <span className="mb-0.5 block text-[11px] text-muted-foreground">
                      {candidate.recipientCount ?? 0}{" "}
                      {candidate.recipientCount === 1
                        ? "membro será"
                        : "membros serão"}{" "}
                      notificados
                    </span>
                  )}
                  <span className="block truncate font-medium">
                    {candidate.displayName ?? candidate.username}
                  </span>
                  <span className="block truncate text-muted-foreground text-xs">
                    @{candidate.username}
                    {candidateMeta(candidate)}
                  </span>
                  {candidate.notificationNote && (
                    <span className="block truncate text-muted-foreground text-xs">
                      {candidate.notificationNote}
                    </span>
                  )}
                </span>
              </button>
            </Fragment>
          ))}
          {searchPending && candidates.length === 0 && (
            <p className="px-3 py-2 text-muted-foreground text-xs">Buscando…</p>
          )}
          {postId &&
            searchScope === "discussion" &&
            value.slice((range?.start ?? 0) + 1, range?.end).trim() &&
            candidates.length === 0 &&
            !searchPending && (
              <div className="grid gap-1 px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  Ninguém com esse nome nesta discussão.
                </p>
                <button
                  className="w-fit text-brand-structural text-xs underline underline-offset-2"
                  onClick={() => setSearchScope("community")}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                >
                  Procurar em toda a comunidade
                </button>
              </div>
            )}
          {postId &&
            searchScope === "community" &&
            candidates.length === 0 &&
            !searchPending && (
              <p className="px-3 py-2 text-muted-foreground text-xs">
                Ninguém com esse nome na comunidade.
              </p>
            )}
        </div>
      )}
      {hasGroupMention && (
        <label className="mt-2 flex items-start gap-2 rounded-sm border border-brand-action/30 bg-brand-action/5 px-3 py-2 text-muted-foreground text-xs">
          <input
            checked={groupMentionConfirmed}
            className="mt-0.5"
            onChange={(event) => setGroupMentionConfirmed(event.target.checked)}
            type="checkbox"
          />
          <span>
            Você está prestes a notificar um grupo. Confirme o envio para
            publicar esta menção.
          </span>
        </label>
      )}
    </div>
  );
};
