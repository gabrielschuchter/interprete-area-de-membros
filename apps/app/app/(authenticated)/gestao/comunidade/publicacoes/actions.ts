"use server";

import { ContentStatus, database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { communityPostHref } from "@/lib/community";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import { createNotification, notificationTypes } from "@/lib/notifications";

const listPath = "/gestao/comunidade/publicacoes";
const reasonLimit = 500;

const operations = [
  "archive",
  "feature",
  "pin",
  "remove",
  "restore",
  "unfeature",
  "unpin",
] as const;
type PublicationOperation = (typeof operations)[number];

const auditByOperation = {
  archive: "gestao.post.archived",
  feature: "gestao.post.featured",
  pin: "gestao.post.pinned",
  remove: "gestao.post.removed",
  restore: "gestao.post.restored",
  unfeature: "gestao.post.featured",
  unpin: "gestao.post.pinned",
} as const satisfies Record<PublicationOperation, string>;

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const readOperation = (value: string) =>
  operations.find((operation) => operation === value) ?? null;

interface PostSnapshot {
  readonly publishedAt: Date | null;
  readonly status: ContentStatus;
}

/** Devolve a mudança no registro, ou null quando o estado não permite. */
const planOperation = (
  operation: PublicationOperation,
  post: PostSnapshot,
  now: Date
) => {
  const live = post.status === ContentStatus.PUBLISHED;
  switch (operation) {
    case "pin":
    case "unpin":
      return live ? { isPinned: operation === "pin" } : null;
    case "feature":
    case "unfeature":
      return live
        ? {
            featuredAt: operation === "feature" ? now : null,
            isFeatured: operation === "feature",
          }
        : null;
    case "archive":
      return live ? { status: ContentStatus.ARCHIVED } : null;
    case "restore":
      return post.status === ContentStatus.ARCHIVED && post.publishedAt
        ? { status: ContentStatus.PUBLISHED }
        : null;
    case "remove":
      return { deletedAt: now, status: ContentStatus.ARCHIVED };
    default:
      return null;
  }
};

export const setGestaoPublicationState = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("community.moderate");
  const id = text(formData, "id");
  const operation = readOperation(text(formData, "operation"));
  if (!(id && operation)) {
    return;
  }
  const post = await database.communityPost.findFirst({
    where: { id, deletedAt: null, status: { not: ContentStatus.DRAFT } },
    select: {
      authorId: true,
      id: true,
      publishedAt: true,
      slug: true,
      space: { select: { slug: true } },
      status: true,
      title: true,
    },
  });
  const now = new Date();
  const change = post ? planOperation(operation, post, now) : null;
  if (!(post && change)) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.moderation",
    memberId: actor.userId,
  });
  await database.communityPost.update({ where: { id }, data: change });
  const reason = text(formData, "reason").slice(0, reasonLimit);
  if (operation === "archive" && post.authorId !== actor.userId) {
    await createNotification({
      actorId: actor.userId,
      body:
        reason ||
        "A equipe arquivou esta publicação. O conteúdo foi preservado.",
      entityId: post.id,
      entityType: "TOPIC",
      href: communityPostHref(post),
      recipientId: post.authorId,
      title: "Sua publicação foi arquivada",
      type: notificationTypes.announcement,
    });
  }
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: id,
    aggregateType: "CommunityPost",
    eventType: auditByOperation[operation],
    payload: {
      operation,
      reason: operation === "archive" ? reason : "",
      title: post.title,
    },
  });
  revalidatePath(listPath);
  revalidatePath("/comunidade");
  if (post.space?.slug) {
    revalidatePath(`/comunidade/${post.space.slug}`);
  }
  if (post.slug) {
    revalidatePath(`/comunidade/publicacoes/${post.slug}`);
  }
};
