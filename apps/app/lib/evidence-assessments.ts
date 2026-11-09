import "server-only";

import { database, EvidenceToolKind, type Prisma } from "@repo/database";
import { z } from "zod";
import {
  type GradeDowngrades,
  type GradeUpgrades,
  gradeCertainty,
  gradeDesigns,
  gradeDowngradeDomains,
} from "./evidence-grade";
import {
  pruneRob2Answers,
  type Rob2Answers,
  type Rob2Judgement,
  type Rob2Overrides,
  rob2Answers,
  rob2DomainIds,
  rob2Judgements,
  rob2OverallJudgement,
  rob2QuestionIds,
} from "./evidence-rob2";

/** Limite por ferramenta, contra uso abusivo; muito acima do uso real. */
const MAX_ASSESSMENTS_PER_TOOL = 300;

export class EvidenceAssessmentError extends Error {}

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

const baseInput = {
  id: z.string().trim().min(1).max(64).optional(),
  version: z.number().int().min(0).optional(),
};

const rob2InputSchema = z.object({
  ...baseInput,
  title: text(160).min(1, "Informe o estudo avaliado."),
  context: optionalText(300),
  experimental: optionalText(200),
  comparator: optionalText(200),
  numericalResult: optionalText(200),
  answers: z.partialRecord(z.enum(rob2QuestionIds), z.enum(rob2Answers)),
  domainNotes: z.partialRecord(z.enum(rob2DomainIds), text(1500)).default({}),
  overrides: z
    .partialRecord(
      z.enum(rob2DomainIds),
      z.object({
        judgement: z.enum(rob2Judgements),
        reason: text(1500).min(1, "Justifique a mudança do julgamento."),
      })
    )
    .default({}),
  overallOverride: z.enum(["HIGH"]).nullable().default(null),
});

const levels = (max: number) => z.number().int().min(0).max(max);
const rating = (max: number) =>
  z.object({ levels: levels(max), reason: text(1500) });

const gradeInputSchema = z
  .object({
    ...baseInput,
    title: text(160).min(1, "Informe o desfecho."),
    context: optionalText(300),
    design: z.enum(gradeDesigns),
    studies: z.number().int().min(0).max(10_000).nullable().default(null),
    participants: z
      .number()
      .int()
      .min(0)
      .max(100_000_000)
      .nullable()
      .default(null),
    effect: optionalText(200),
    downgrades: z.object({
      riskOfBias: rating(2),
      inconsistency: rating(2),
      indirectness: rating(2),
      imprecision: rating(2),
      publicationBias: rating(1),
    }),
    upgrades: z.object({
      largeEffect: levels(2),
      doseResponse: levels(1),
      confounding: levels(1),
    }),
    upgradeNote: text(1500).default(""),
    rob2Ids: z.array(z.string().trim().min(1).max(64)).max(100).default([]),
  })
  .superRefine((value, context) => {
    for (const domain of gradeDowngradeDomains) {
      const rating = value.downgrades[domain.id];
      if (rating && rating.levels > 0 && !rating.reason) {
        context.addIssue({
          code: "custom",
          path: ["downgrades", domain.id, "reason"],
          message: `Explique por que rebaixou em ${domain.title.toLowerCase()}.`,
        });
      }
    }
  });

export type Rob2Input = z.input<typeof rob2InputSchema>;
export type GradeInput = z.input<typeof gradeInputSchema>;

const parse = <T extends z.ZodType>(schema: T, input: unknown) => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new EvidenceAssessmentError(
      parsed.error.issues[0]?.message ?? "Revise os campos da avaliação."
    );
  }
  return parsed.data as z.output<T>;
};

const listSelect = {
  id: true,
  title: true,
  context: true,
  result: true,
  updatedAt: true,
} as const;

export const listEvidenceAssessments = (
  memberId: string,
  tool: EvidenceToolKind
) =>
  database.evidenceAssessment.findMany({
    where: { memberId, tool, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: MAX_ASSESSMENTS_PER_TOOL,
    select: listSelect,
  });

export const getEvidenceAssessment = (
  memberId: string,
  tool: EvidenceToolKind,
  id: string
) =>
  database.evidenceAssessment.findFirst({
    where: { id, memberId, tool, deletedAt: null },
    select: { ...listSelect, data: true, version: true },
  });

const persist = async (
  memberId: string,
  tool: EvidenceToolKind,
  input: {
    readonly context: string | null;
    readonly id?: string;
    readonly title: string;
    readonly version?: number;
  },
  data: Prisma.InputJsonValue,
  result: string | null
) => {
  if (input.id) {
    const updated = await database.evidenceAssessment.updateMany({
      where: {
        id: input.id,
        memberId,
        tool,
        deletedAt: null,
        ...(input.version === undefined ? {} : { version: input.version }),
      },
      data: {
        title: input.title,
        context: input.context,
        data,
        result,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new EvidenceAssessmentError(
        "Esta avaliação mudou em outra aba ou não está mais disponível. Recarregue a página para ver a versão atual."
      );
    }
    const saved = await getEvidenceAssessment(memberId, tool, input.id);
    if (!saved) {
      throw new EvidenceAssessmentError(
        "A avaliação não está mais disponível."
      );
    }
    return saved;
  }

  const count = await database.evidenceAssessment.count({
    where: { memberId, tool, deletedAt: null },
  });
  if (count >= MAX_ASSESSMENTS_PER_TOOL) {
    throw new EvidenceAssessmentError(
      "Você chegou ao limite de avaliações desta ferramenta. Exclua as que não usa mais."
    );
  }
  return database.evidenceAssessment.create({
    data: {
      memberId,
      tool,
      title: input.title,
      context: input.context,
      data,
      result,
    },
    select: { ...listSelect, data: true, version: true },
  });
};

export const saveRob2Assessment = async (memberId: string, raw: unknown) => {
  const input = parse(rob2InputSchema, raw);
  const answers = pruneRob2Answers(input.answers as Rob2Answers);
  const overrides = input.overrides as Rob2Overrides;
  const result = rob2OverallJudgement(
    answers,
    overrides,
    input.overallOverride
  );
  const saved = await persist(
    memberId,
    EvidenceToolKind.ROB2,
    input,
    {
      version: 1,
      design: "PARALLEL_RCT",
      effect: "ASSIGNMENT",
      experimental: input.experimental,
      comparator: input.comparator,
      numericalResult: input.numericalResult,
      answers,
      domainNotes: input.domainNotes,
      overrides,
      overallOverride: input.overallOverride,
    } as unknown as Prisma.InputJsonValue,
    result
  );
  return saved;
};

export const saveGradeAssessment = async (memberId: string, raw: unknown) => {
  const input = parse(gradeInputSchema, raw);
  // Só RoB 2 do próprio membro, ainda ativos, entram na ligação.
  const ownedRob2 = input.rob2Ids.length
    ? await database.evidenceAssessment.findMany({
        where: {
          id: { in: [...new Set(input.rob2Ids)] },
          memberId,
          tool: EvidenceToolKind.ROB2,
          deletedAt: null,
        },
        select: { id: true },
      })
    : [];
  const downgrades = input.downgrades as GradeDowngrades;
  const upgrades = input.upgrades as GradeUpgrades;
  const result = gradeCertainty(input.design, downgrades, upgrades);
  return persist(
    memberId,
    EvidenceToolKind.GRADE,
    input,
    {
      version: 1,
      design: input.design,
      studies: input.studies,
      participants: input.participants,
      effect: input.effect,
      downgrades,
      upgrades,
      upgradeNote: input.upgradeNote,
      rob2Ids: ownedRob2.map(({ id }) => id),
    } as unknown as Prisma.InputJsonValue,
    result
  );
};

export const deleteEvidenceAssessment = async (
  memberId: string,
  tool: EvidenceToolKind,
  id: string
) => {
  const deleted = await database.evidenceAssessment.updateMany({
    where: { id, memberId, tool, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (deleted.count === 0) {
    throw new EvidenceAssessmentError("A avaliação não está mais disponível.");
  }
};

export const isRob2Judgement = (value: unknown): value is Rob2Judgement =>
  typeof value === "string" &&
  (rob2Judgements as readonly string[]).includes(value);
