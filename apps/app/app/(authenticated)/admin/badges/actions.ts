"use server";

import { BadgeCriterion, ContentStatus, database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/authorization";

const textValue = (formData: FormData, field: string) => {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
};

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const validatedDefinition = (formData: FormData) => {
  const title = textValue(formData, "title").slice(0, 120);
  const description = textValue(formData, "description").slice(0, 1000);
  const criterion = textValue(formData, "criterion") as BadgeCriterion;
  const threshold = Number.parseInt(textValue(formData, "threshold"), 10);
  const imageUrlRaw = textValue(formData, "imageUrl");
  let imageUrl: string | null = null;
  if (imageUrlRaw) {
    try {
      const url = new URL(imageUrlRaw);
      if (url.protocol !== "https:") {
        return null;
      }
      imageUrl = url.toString().slice(0, 2000);
    } catch {
      return null;
    }
  }
  if (
    !(
      title &&
      description &&
      Object.values(BadgeCriterion).includes(criterion) &&
      Number.isInteger(threshold)
    ) ||
    threshold < 1 ||
    threshold > 1_000_000
  ) {
    return null;
  }
  return { criterion, description, imageUrl, threshold, title };
};

export const saveBadgeDefinition = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const definition = validatedDefinition(formData);
  const id = textValue(formData, "id");
  if (!definition) {
    redirect("/admin/badges?resultado=invalido");
  }

  if (id) {
    const updated = await database.$transaction(async (transaction) => {
      const current = await transaction.badgeDefinition.findFirst({
        where: { id, status: { not: ContentStatus.ARCHIVED } },
        select: {
          criterion: true,
          description: true,
          imageUrl: true,
          threshold: true,
          title: true,
          version: true,
        },
      });
      if (!current) {
        return false;
      }
      const changed =
        current.criterion !== definition.criterion ||
        current.description !== definition.description ||
        current.imageUrl !== definition.imageUrl ||
        current.threshold !== definition.threshold ||
        current.title !== definition.title;
      const nextVersion = current.version + Number(changed);
      const result = await transaction.badgeDefinition.updateMany({
        where: {
          id,
          status: { not: ContentStatus.ARCHIVED },
          version: current.version,
        },
        data: { ...definition, version: nextVersion },
      });
      if (result.count !== 1) {
        return false;
      }
      if (changed) {
        await transaction.badgeDefinitionRevision.create({
          data: {
            badgeId: id,
            version: nextVersion,
            ...definition,
            createdByMemberId: userId,
          },
        });
      }
      return true;
    });
    if (!updated) {
      redirect("/admin/badges?resultado=indisponivel");
    }
  } else {
    const baseSlug = slugify(definition.title);
    if (!baseSlug) {
      redirect("/admin/badges?resultado=invalido");
    }
    let slug = baseSlug;
    for (
      let suffix = 2;
      await database.badgeDefinition.findUnique({
        where: { slug },
        select: { id: true },
      });
      suffix += 1
    ) {
      slug = `${baseSlug.slice(0, 74)}-${suffix}`;
    }
    await database.badgeDefinition.create({
      data: {
        ...definition,
        slug,
        createdByMemberId: userId,
        version: 1,
        revisions: {
          create: { ...definition, version: 1, createdByMemberId: userId },
        },
      },
    });
  }

  revalidatePath("/admin/badges");
  revalidatePath("/perfil");
  revalidatePath("/membros", "layout");
  redirect("/admin/badges?resultado=salvo");
};

export const setBadgeStatus = async (formData: FormData) => {
  await requireStaff();
  const id = textValue(formData, "id");
  const status = textValue(formData, "status") as ContentStatus;
  if (
    !(
      id &&
      [
        ContentStatus.DRAFT,
        ContentStatus.PUBLISHED,
        ContentStatus.ARCHIVED,
      ].includes(status)
    )
  ) {
    redirect("/admin/badges?resultado=invalido");
  }
  const updated = await database.badgeDefinition.updateMany({
    where: { id },
    data: { status },
  });
  if (updated.count !== 1) {
    redirect("/admin/badges?resultado=indisponivel");
  }
  revalidatePath("/admin/badges");
  revalidatePath("/perfil");
  revalidatePath("/membros", "layout");
  redirect("/admin/badges?resultado=atualizado");
};
