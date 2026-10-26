"use server";

import { randomUUID } from "node:crypto";
import {
  CommunitySpaceMemberRole,
  CommunitySpaceVisibility,
  ContentStatus,
  database,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { isAllowedCollectionCoverUrl } from "@/lib/collection-covers";
import {
  communitySpaceSlugBase,
  normalizeCommunitySpaceTitle,
} from "@/lib/community-space-rules";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";

export interface GestaoGroupFormState {
  readonly done: boolean;
  readonly error: string | null;
}

const listPath = "/gestao/comunidade/grupos";
const titleMin = 3;
const titleMax = 80;
const descriptionMax = 500;
const slugTries = 20;

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const revalidateGroups = (slug?: string) => {
  revalidatePath(listPath);
  revalidatePath("/comunidade");
  if (slug) {
    revalidatePath(`/comunidade/${slug}`);
  }
};

const readCover = (formData: FormData) => {
  const cover = text(formData, "coverUrl");
  if (!cover) {
    return { ok: true as const, value: null };
  }
  return isAllowedCollectionCoverUrl(cover)
    ? { ok: true as const, value: cover.slice(0, 2000) }
    : { ok: false as const };
};

const freeSlug = async (title: string, ignoreId?: string) => {
  const base = communitySpaceSlugBase(title);
  for (let attempt = 0; attempt < slugTries; attempt += 1) {
    const slug = attempt === 0 ? base : `${base.slice(0, 70)}-${attempt + 1}`;
    const taken = await database.communitySpace.findFirst({
      where: { slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!taken) {
      return slug;
    }
  }
  return `${base.slice(0, 60)}-${randomUUID().slice(0, 6)}`;
};

const readTitle = (formData: FormData) => {
  const title = text(formData, "title");
  return title.length >= titleMin && title.length <= titleMax ? title : null;
};

export const createGestaoGroup = async (
  _previous: GestaoGroupFormState,
  formData: FormData
): Promise<GestaoGroupFormState> => {
  const { actor } = await requireGestaoAction("community.moderate");
  const title = readTitle(formData);
  if (!title) {
    return {
      done: false,
      error: `O nome precisa ter entre ${titleMin} e ${titleMax} letras.`,
    };
  }
  const cover = readCover(formData);
  if (!cover.ok) {
    return { done: false, error: "Essa imagem não é aceita. Envie outra." };
  }
  const study = text(formData, "kind") !== "institutional";
  const normalizedTitle = normalizeCommunitySpaceTitle(title);
  if (!normalizedTitle) {
    return { done: false, error: "Escolha um nome com letras ou números." };
  }
  await consumeMutationRateLimit({
    action: "community.moderation",
    memberId: actor.userId,
  });
  if (study) {
    const duplicate = await database.communitySpace.findFirst({
      where: { ownerId: actor.userId, normalizedTitle },
      select: { id: true },
    });
    if (duplicate) {
      return {
        done: false,
        error: "Você já tem um grupo de estudo com esse nome.",
      };
    }
  }
  try {
    const space = await database.communitySpace.create({
      data: {
        coverUrl: cover.value,
        description:
          text(formData, "description").slice(0, descriptionMax) || null,
        normalizedTitle: study ? normalizedTitle : null,
        slug: await freeSlug(title),
        status: ContentStatus.PUBLISHED,
        title,
        visibility: CommunitySpaceVisibility.PUBLIC,
        ...(study
          ? {
              members: {
                create: {
                  memberId: actor.userId,
                  role: CommunitySpaceMemberRole.OWNER,
                },
              },
              ownerId: actor.userId,
            }
          : {}),
      },
      select: { id: true, slug: true },
    });
    await recordAuditEvent({
      actorId: actor.userId,
      aggregateId: space.id,
      aggregateType: "CommunitySpace",
      eventType: "gestao.group.created",
      payload: {
        kind: study ? "study" : "institutional",
        slug: space.slug,
        title,
      },
    });
    revalidateGroups(space.slug);
    return { done: true, error: null };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        done: false,
        error: "Outro grupo acabou de usar esse endereço. Tente de novo.",
      };
    }
    throw error;
  }
};

export const updateGestaoGroup = async (
  _previous: GestaoGroupFormState,
  formData: FormData
): Promise<GestaoGroupFormState> => {
  const { actor } = await requireGestaoAction("community.moderate");
  const id = text(formData, "id");
  const title = readTitle(formData);
  const cover = readCover(formData);
  if (!(id && title)) {
    return {
      done: false,
      error: `O nome precisa ter entre ${titleMin} e ${titleMax} letras.`,
    };
  }
  if (!cover.ok) {
    return { done: false, error: "Essa imagem não é aceita. Envie outra." };
  }
  const current = await database.communitySpace.findUnique({
    where: { id },
    select: { ownerId: true, slug: true },
  });
  if (!current) {
    return { done: false, error: "Este grupo não existe mais." };
  }
  const slug = communitySpaceSlugBase(text(formData, "slug") || current.slug);
  if (slug !== current.slug) {
    if (text(formData, "confirmAddress") !== "on") {
      return {
        done: false,
        error:
          "Confirme a mudança de endereço: links já compartilhados deixam de funcionar.",
      };
    }
    const taken = await database.communitySpace.findFirst({
      where: { slug, NOT: { id } },
      select: { id: true },
    });
    if (taken) {
      return { done: false, error: "Esse endereço já é de outro grupo." };
    }
  }
  await consumeMutationRateLimit({
    action: "community.moderation",
    memberId: actor.userId,
  });
  const normalizedTitle = normalizeCommunitySpaceTitle(title);
  try {
    await database.communitySpace.update({
      where: { id },
      data: {
        coverUrl: cover.value,
        description:
          text(formData, "description").slice(0, descriptionMax) || null,
        slug,
        title,
        ...(current.ownerId ? { normalizedTitle } : {}),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        done: false,
        error: "Já existe um grupo com esse nome ou endereço.",
      };
    }
    throw error;
  }
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: id,
    aggregateType: "CommunitySpace",
    eventType: "gestao.group.updated",
    payload: { addressChanged: slug !== current.slug, slug, title },
  });
  revalidateGroups(slug);
  if (slug !== current.slug) {
    revalidateGroups(current.slug);
  }
  return { done: true, error: null };
};

const groupOperations = ["archive", "close", "open", "publish"] as const;

export const setGestaoGroupState = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("community.moderate");
  const id = text(formData, "id");
  const operation = groupOperations.find(
    (item) => item === text(formData, "operation")
  );
  if (!(id && operation)) {
    return;
  }
  const space = await database.communitySpace.findUnique({
    where: { id },
    select: { slug: true, title: true },
  });
  if (!space) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.moderation",
    memberId: actor.userId,
  });
  if (operation === "close" || operation === "open") {
    await database.communitySpace.update({
      where: { id },
      data: { commentsClosed: operation === "close" },
    });
  } else {
    await database.communitySpace.update({
      where: { id },
      data: {
        status:
          operation === "publish"
            ? ContentStatus.PUBLISHED
            : ContentStatus.ARCHIVED,
      },
    });
  }
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: id,
    aggregateType: "CommunitySpace",
    eventType: "gestao.group.status_changed",
    payload: { operation, title: space.title },
  });
  revalidateGroups(space.slug);
};
