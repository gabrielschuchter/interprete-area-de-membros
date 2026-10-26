"use server";

import { BadgeCriterion, ContentStatus, database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const listPath = "/gestao/administracao/medalhas";
const accentPattern = /[̀-ͯ]/g;
const nonSlugPattern = /[^a-z0-9]+/g;
const edgeDashPattern = /^-|-$/g;

export interface MedalFormState {
  readonly error: string | null;
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(accentPattern, "")
    .toLowerCase()
    .replace(nonSlugPattern, "-")
    .replace(edgeDashPattern, "")
    .slice(0, 80);

const readDefinition = (formData: FormData) => {
  const title = text(formData, "title").slice(0, 120);
  const description = text(formData, "description").slice(0, 1000);
  const criterion = Object.values(BadgeCriterion).find(
    (value) => value === text(formData, "criterion")
  );
  const threshold = Number.parseInt(text(formData, "threshold"), 10);
  if (
    !(title && description && criterion && Number.isInteger(threshold)) ||
    threshold < 1 ||
    threshold > 1_000_000
  ) {
    return null;
  }
  return { criterion, description, threshold, title };
};

const uniqueSlug = async (title: string) => {
  const base = slugify(title);
  if (!base) {
    return null;
  }
  let slug = base;
  for (
    let suffix = 2;
    await database.badgeDefinition.findUnique({
      where: { slug },
      select: { id: true },
    });
    suffix += 1
  ) {
    slug = `${base.slice(0, 74)}-${suffix}`;
  }
  return slug;
};

export const saveGestaoMedal = async (
  _previous: MedalFormState,
  formData: FormData
): Promise<MedalFormState> => {
  const { actor } = await requireGestaoAction("badges.manage");
  const definition = readDefinition(formData);
  if (!definition) {
    return {
      error:
        "Preencha nome, critério, quantidade (de 1 a 1.000.000) e descrição.",
    };
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const id = text(formData, "id");
  if (!id) {
    const slug = await uniqueSlug(definition.title);
    if (!slug) {
      return { error: "O nome precisa ter letras ou números." };
    }
    const created = await database.badgeDefinition.create({
      data: {
        ...definition,
        createdByMemberId: actor.userId,
        revisions: {
          create: {
            ...definition,
            createdByMemberId: actor.userId,
            version: 1,
          },
        },
        slug,
        version: 1,
      },
      select: { id: true },
    });
    await recordAuditEvent({
      actorId: actor.userId,
      aggregateId: created.id,
      aggregateType: "BadgeDefinition",
      eventType: "gestao.medal.created",
      payload: { criterion: definition.criterion, title: definition.title },
    });
    revalidatePath(listPath);
    redirect(`${listPath}/${created.id}?resultado=criada`);
  }
  const outcome = await database.$transaction(async (transaction) => {
    const current = await transaction.badgeDefinition.findFirst({
      where: { id, status: { not: ContentStatus.ARCHIVED } },
      select: {
        criterion: true,
        description: true,
        threshold: true,
        title: true,
        version: true,
      },
    });
    if (!current) {
      return "missing" as const;
    }
    const changed =
      current.criterion !== definition.criterion ||
      current.description !== definition.description ||
      current.threshold !== definition.threshold ||
      current.title !== definition.title;
    if (!changed) {
      return "unchanged" as const;
    }
    const version = current.version + 1;
    const updated = await transaction.badgeDefinition.updateMany({
      where: {
        id,
        status: { not: ContentStatus.ARCHIVED },
        version: current.version,
      },
      data: { ...definition, version },
    });
    if (updated.count !== 1) {
      return "conflict" as const;
    }
    await transaction.badgeDefinitionRevision.create({
      data: {
        ...definition,
        badgeId: id,
        createdByMemberId: actor.userId,
        version,
      },
    });
    await recordAuditEvent(
      {
        actorId: actor.userId,
        aggregateId: id,
        aggregateType: "BadgeDefinition",
        eventType: "gestao.medal.updated",
        payload: { criterion: definition.criterion, version },
      },
      transaction
    );
    return "saved" as const;
  });
  if (outcome === "missing") {
    return { error: "Esta medalha não está mais disponível para edição." };
  }
  if (outcome === "conflict") {
    return {
      error: "Outra pessoa editou esta medalha agora há pouco. Recarregue.",
    };
  }
  revalidatePath(listPath);
  revalidatePath("/perfil");
  redirect(
    `${listPath}/${id}?resultado=${outcome === "saved" ? "salva" : "igual"}`
  );
};

export const setGestaoMedalStatus = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("badges.manage");
  const id = text(formData, "id");
  const status = Object.values(ContentStatus).find(
    (value) => value === text(formData, "status")
  );
  if (!(id && status)) {
    redirect(`${listPath}?resultado=invalido`);
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const updated = await database.badgeDefinition.updateMany({
    where: { id },
    data: { status },
  });
  if (updated.count !== 1) {
    redirect(`${listPath}?resultado=indisponivel`);
  }
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: id,
    aggregateType: "BadgeDefinition",
    eventType: "gestao.medal.status_changed",
    payload: { status },
  });
  revalidatePath(listPath);
  revalidatePath("/perfil");
  revalidatePath("/membros", "layout");
  redirect(`${listPath}/${id}?resultado=${status.toLowerCase()}`);
};
