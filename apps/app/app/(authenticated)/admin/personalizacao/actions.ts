"use server";

import { database, HomeBlockType, type Prisma } from "@repo/database";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization";
import {
  consumeMutationRateLimit,
  mutationLog,
} from "@/lib/mutation-reliability";

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const finish = (status: "success" | "error", message?: string): never => {
  const query = new URLSearchParams({ status });
  if (message) {
    query.set("message", message);
  }
  redirect(`/admin/personalizacao?${query.toString()}`);
};

export const saveProductSettings = async (formData: FormData) => {
  const { userId } = await requireAdmin();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const startedAt = Date.now();

  try {
    const settings = [
      [
        "recordingsExperienceV2",
        formData.get("recordingsExperienceV2") === "on",
      ],
      ["showLearnNavigation", formData.get("showLearnNavigation") === "on"],
    ] as const;

    await database.$transaction(
      settings.map(([key, value]) =>
        database.productSetting.upsert({
          where: { key },
          create: { key, value, updatedByMemberId: userId },
          update: { value, updatedByMemberId: userId },
        })
      )
    );
    mutationLog({
      action: "admin.product-settings.update",
      memberId: userId,
      status: "success",
      durationMs: Date.now() - startedAt,
    });
    revalidatePath("/");
    revalidatePath("/admin/personalizacao");
    finish("success", "Configurações do produto atualizadas.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    mutationLog({
      action: "admin.product-settings.update",
      memberId: userId,
      status: "error",
      durationMs: Date.now() - startedAt,
    });
    console.error("Product settings update failed", error);
    finish("error", "Não foi possível salvar essa configuração agora.");
  }
};

const homeBlockInput = z.object({
  collectionId: z.string().max(120),
  enabled: z.boolean(),
  itemCount: z.number().int().min(1).max(12),
  position: z.number().int().min(0).max(999),
  subtitle: z.string().max(500),
  title: z.string().max(120),
  type: z.enum(
    Object.values(HomeBlockType) as [HomeBlockType, ...HomeBlockType[]]
  ),
});

export const saveHomeBlock = async (formData: FormData) => {
  const { userId } = await requireAdmin();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: userId,
  });
  const parsed = homeBlockInput.safeParse({
    collectionId: text(formData.get("collectionId")),
    enabled: formData.get("enabled") === "on",
    itemCount: Number(text(formData.get("itemCount"))),
    position: Number(text(formData.get("position"))),
    subtitle: text(formData.get("subtitle")),
    title: text(formData.get("title")),
    type: text(formData.get("type")),
  });

  if (!parsed.success) {
    return finish("error", "Revise os campos da seção antes de salvar.");
  }

  const input = parsed.data;
  const collectionId =
    input.type === HomeBlockType.COLLECTION && input.collectionId
      ? input.collectionId
      : null;
  const data: Prisma.HomeBlockConfigurationUncheckedCreateInput = {
    collectionId,
    enabled: input.enabled,
    itemCount: input.itemCount,
    position: input.position,
    subtitle: input.subtitle || null,
    title: input.title || null,
    type: input.type,
    updatedByMemberId: userId,
  };

  try {
    if (collectionId) {
      const collection = await database.contentCollection.findUnique({
        where: { id: collectionId },
        select: { id: true },
      });
      if (!collection) {
        return finish("error", "A coleção escolhida não existe mais.");
      }
    }
    await database.homeBlockConfiguration.upsert({
      where: { type: input.type },
      create: { ...data, createdByMemberId: userId },
      update: data,
    });
    mutationLog({
      action: "admin.home-block.update",
      memberId: userId,
      resource: input.type,
      status: "success",
    });
    revalidatePath("/");
    revalidatePath("/admin/personalizacao");
    finish("success", "Seção da página inicial atualizada.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    mutationLog({
      action: "admin.home-block.update",
      memberId: userId,
      resource: input.type,
      status: "error",
    });
    console.error("Home block update failed", error);
    finish("error", "Não foi possível salvar essa seção agora.");
  }
};
