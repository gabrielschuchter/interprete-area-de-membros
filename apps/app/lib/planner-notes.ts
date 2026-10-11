import "server-only";

import { Buffer } from "node:buffer";
import { database, Prisma } from "@repo/database";
import { z } from "zod";
import { getMemberAccessibleLesson } from "./learning";

const noteIdSchema = z.string().trim().min(1).max(255);
const noteFolderSchema = z.object({
  id: noteIdSchema.optional(),
  name: z.string().trim().min(1).max(48),
  icon: z.string().trim().min(1).max(32).default("folder"),
  parentId: noteIdSchema.nullable().optional(),
});
const jsonContentSchema = z.record(z.string(), z.unknown());
const noteSchema = z
  .object({
    id: noteIdSchema.optional(),
    folderId: noteIdSchema.nullable().optional(),
    title: z.string().trim().max(180).default("Sem título"),
    contentJson: jsonContentSchema,
    tagNames: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
    linkedResourceType: z.literal("LESSON").nullable().optional(),
    linkedResourceId: z.string().trim().max(255).nullable().optional(),
    expectedUpdatedAt: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
  })
  .refine(
    (input) =>
      Boolean(input.linkedResourceType) === Boolean(input.linkedResourceId),
    { message: "Escolha uma aula para criar o vínculo da nota." }
  );

const noteRetentionDays = 30;
const maximumNoteBytes = 300_000;
const notePreviewCharacters = 320;
const maximumNoteSearchCharacters = 120;

export interface PlannerNoteSummary {
  contentText: string;
  createdAt: Date;
  deletedAt: Date | null;
  folderId: string | null;
  id: string;
  linkedResourceId: string | null;
  linkedResourceType: string | null;
  pinnedAt: Date | null;
  tags: { id: string; name: string }[];
  title: string;
  updatedAt: Date;
}
const emptyDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const getNodeText = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(getNodeText).join(" ");
  }
  const record = value as Record<string, unknown>;
  if (record.type === "text" && typeof record.text === "string") {
    return record.text;
  }
  const content = Array.isArray(record.content) ? record.content : [];
  return content
    .map(getNodeText)
    .join(record.type === "hardBreak" ? "\n" : " ");
};

const ensureContentSize = (contentJson: Record<string, unknown>) => {
  const serialized = JSON.stringify(contentJson);
  if (Buffer.byteLength(serialized, "utf8") > maximumNoteBytes) {
    throw new Error("Esta nota excede o limite de 300 KB.");
  }
  return serialized;
};

export const getPlannerNotes = async (
  memberId: string,
  options: {
    folderId?: string | null;
    linkedLessons?: boolean;
    linkedResourceId?: string;
    limit?: number;
    pinnedOnly?: boolean;
    tagId?: string;
    sort?: "RECENT" | "TITLE";
    search?: string;
    trash?: boolean;
  } = {}
) => {
  const expiredBefore = new Date(Date.now() - noteRetentionDays * 86_400_000);
  const search =
    options.search?.trim().slice(0, maximumNoteSearchCharacters) ?? "";
  let folderCondition = Prisma.empty;
  if (options.folderId === null) {
    folderCondition = Prisma.sql`AND n."folderId" IS NULL`;
  } else if (options.folderId !== undefined) {
    folderCondition = Prisma.sql`AND n."folderId" = ${options.folderId}`;
  }
  const searchCondition = search
    ? Prisma.sql`AND (
        position(lower(${search}) in lower(n.title)) > 0 OR
        position(lower(${search}) in lower(n."contentText")) > 0 OR
        EXISTS (
          SELECT 1
          FROM "PlannerNoteTagAssignment" search_assignment
          JOIN "PlannerNoteTag" search_tag
            ON search_tag.id = search_assignment."tagId"
            AND search_tag."memberId" = search_assignment."memberId"
          WHERE search_assignment."noteId" = n.id
            AND search_assignment."memberId" = n."memberId"
            AND position(lower(${search}) in lower(search_tag.name)) > 0
        )
      )`
    : Prisma.empty;
  const deletedCondition = options.trash
    ? Prisma.sql`AND n."deletedAt" IS NOT NULL AND n."deletedAt" >= ${expiredBefore}`
    : Prisma.sql`AND n."deletedAt" IS NULL`;
  const linkedCondition = options.linkedLessons
    ? Prisma.sql`AND n."linkedResourceType" = 'LESSON' AND n."linkedResourceId" IS NOT NULL`
    : Prisma.empty;
  const pinnedCondition = options.pinnedOnly
    ? Prisma.sql`AND n."pinnedAt" IS NOT NULL`
    : Prisma.empty;
  const linkedResourceCondition = options.linkedResourceId
    ? Prisma.sql`AND n."linkedResourceType" = 'LESSON' AND n."linkedResourceId" = ${noteIdSchema.parse(options.linkedResourceId)}`
    : Prisma.empty;
  const tagCondition = options.tagId
    ? Prisma.sql`AND EXISTS (
        SELECT 1
        FROM "PlannerNoteTagAssignment" tag_assignment
        WHERE tag_assignment."noteId" = n.id
          AND tag_assignment."memberId" = n."memberId"
          AND tag_assignment."tagId" = ${noteIdSchema.parse(options.tagId)}
      )`
    : Prisma.empty;
  const sortOrder =
    options.sort === "TITLE"
      ? Prisma.sql`n."pinnedAt" DESC NULLS LAST, lower(n.title) ASC, n.id ASC`
      : Prisma.sql`n."pinnedAt" DESC NULLS LAST, n."updatedAt" DESC, n.id ASC`;
  await database.plannerNote.deleteMany({
    where: { memberId, deletedAt: { lt: expiredBefore } },
  });
  const requestedLimit = options.limit ?? 100;
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(Math.trunc(requestedLimit), 100))
    : 100;
  const [folders, notes, tags, preferences] = await Promise.all([
    database.plannerNoteFolder.findMany({
      where: { memberId, deletedAt: null },
      orderBy: [{ parentId: "asc" }, { position: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        icon: true,
        parentId: true,
        position: true,
      },
    }),
    database.$queryRaw<PlannerNoteSummary[]>(Prisma.sql`
      SELECT
        n.id,
        n."folderId",
        n.title,
        n."linkedResourceType",
        n."linkedResourceId",
        left(n."contentText", ${notePreviewCharacters}) AS "contentText",
        n."pinnedAt",
        n."deletedAt",
        n."createdAt",
        n."updatedAt",
        COALESCE(
          jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name))
            FILTER (WHERE t.id IS NOT NULL),
          '[]'::jsonb
        ) AS tags
      FROM "PlannerNote" n
      LEFT JOIN "PlannerNoteTagAssignment" a
        ON a."noteId" = n.id AND a."memberId" = n."memberId"
      LEFT JOIN "PlannerNoteTag" t
        ON t.id = a."tagId" AND t."memberId" = n."memberId"
      WHERE n."memberId" = ${memberId}
        ${deletedCondition}
        ${folderCondition}
        ${linkedCondition}
        ${linkedResourceCondition}
        ${pinnedCondition}
        ${tagCondition}
        ${searchCondition}
      GROUP BY n.id
      ORDER BY ${sortOrder}
      LIMIT ${limit}
    `),
    database.plannerNoteTag.findMany({
      where: { memberId, notes: { some: { note: { deletedAt: null } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    database.plannerPreferences.findUnique({
      where: { memberId },
      select: { timezone: true },
    }),
  ]);
  return {
    timezone: preferences?.timezone ?? "America/Sao_Paulo",
    referenceNow: new Date().toISOString(),
    folders,
    notes,
    tags,
    trashRetentionDays: noteRetentionDays,
  };
};

export const getPlannerNote = (memberId: string, id: string) => {
  return database.plannerNote
    .findFirst({
      where: { id: noteIdSchema.parse(id), memberId, deletedAt: null },
      select: {
        id: true,
        folderId: true,
        title: true,
        contentJson: true,
        contentText: true,
        linkedResourceType: true,
        linkedResourceId: true,
        pinnedAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        tags: { select: { tag: { select: { id: true, name: true } } } },
      },
    })
    .then((note) =>
      note
        ? {
            ...note,
            tags: note.tags.map(({ tag }) => tag),
          }
        : null
    );
};

export const createPlannerNote = async (
  memberId: string,
  folderId?: string | null,
  linkedLessonId?: string | null
) => {
  const safeFolderId = folderId ? noteIdSchema.parse(folderId) : null;
  const linkedLesson = linkedLessonId
    ? await getMemberAccessibleLesson(
        memberId,
        noteIdSchema.parse(linkedLessonId)
      )
    : null;
  if (linkedLessonId && !linkedLesson) {
    throw new Error("A aula não está disponível para vincular a nota.");
  }
  if (safeFolderId) {
    const folder = await database.plannerNoteFolder.findFirst({
      where: { id: safeFolderId, memberId, deletedAt: null },
      select: { id: true },
    });
    if (!folder) {
      throw new Error("A pasta não foi encontrada.");
    }
  }
  return database.plannerNote.create({
    data: {
      memberId,
      folderId: safeFolderId,
      linkedResourceType: linkedLesson ? "LESSON" : null,
      linkedResourceId: linkedLesson?.id ?? null,
      contentJson: emptyDocument,
    },
    select: { id: true, title: true, folderId: true, updatedAt: true },
  });
};

export const duplicatePlannerNote = async (memberId: string, id: string) => {
  const source = await database.plannerNote.findFirst({
    where: { id: noteIdSchema.parse(id), memberId, deletedAt: null },
    select: {
      folderId: true,
      title: true,
      contentJson: true,
      contentText: true,
      linkedResourceType: true,
      linkedResourceId: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });
  if (!source) {
    throw new Error("A nota não foi encontrada.");
  }
  const titleSuffix = " (cópia)";
  const title = `${source.title.slice(0, 180 - titleSuffix.length)}${titleSuffix}`;
  const contentJson = jsonContentSchema.parse(
    source.contentJson
  ) as Prisma.InputJsonValue;
  const linkedLesson = source.linkedResourceId
    ? await getMemberAccessibleLesson(memberId, source.linkedResourceId)
    : null;
  return database.$transaction(async (transaction) => {
    const duplicate = await transaction.plannerNote.create({
      data: {
        memberId,
        folderId: source.folderId,
        title,
        contentJson,
        contentText: source.contentText,
        linkedResourceType: linkedLesson ? "LESSON" : null,
        linkedResourceId: linkedLesson?.id ?? null,
      },
      select: { id: true, title: true, folderId: true, updatedAt: true },
    });
    await syncNoteTags(
      transaction,
      memberId,
      duplicate.id,
      source.tags.map(({ tag }) => tag.name)
    );
    return duplicate;
  });
};

const ensureNoteFolder = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  folderId: string | null
) => {
  if (!folderId) {
    return;
  }
  const folder = await transaction.plannerNoteFolder.findFirst({
    where: { id: folderId, memberId, deletedAt: null },
    select: { id: true },
  });
  if (!folder) {
    throw new Error("A pasta não foi encontrada.");
  }
};

const persistNoteContent = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  input: z.infer<typeof noteSchema>,
  folderId: string | null,
  contentText: string
) => {
  const contentJson = input.contentJson as Prisma.InputJsonValue;
  const title = input.title || "Sem título";
  if (input.id) {
    const current = await transaction.plannerNote.findFirst({
      where: { id: input.id, memberId, deletedAt: null },
      select: { id: true, updatedAt: true },
    });
    if (!current) {
      throw new Error("A nota não foi encontrada.");
    }
    if (
      input.expectedUpdatedAt &&
      current.updatedAt.toISOString() !==
        new Date(input.expectedUpdatedAt).toISOString()
    ) {
      throw new Error(
        "Esta nota foi editada em outro aparelho. Recarregue antes de salvar."
      );
    }
    await transaction.plannerNote.update({
      where: { id: current.id },
      data: {
        folderId,
        title,
        contentJson,
        contentText,
        linkedResourceType: input.linkedResourceType ?? null,
        linkedResourceId: input.linkedResourceId ?? null,
      },
    });
    return current.id;
  }
  const created = await transaction.plannerNote.create({
    data: {
      memberId,
      folderId,
      title,
      contentJson,
      contentText,
      linkedResourceType: input.linkedResourceType ?? null,
      linkedResourceId: input.linkedResourceId ?? null,
    },
    select: { id: true },
  });
  return created.id;
};

const syncNoteTags = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  noteId: string,
  names: string[]
) => {
  const requestedNames = [...new Set(names.map((name) => name.trim()))];
  const tagRows = await Promise.all(
    requestedNames.map((name) =>
      transaction.plannerNoteTag.upsert({
        where: { memberId_name: { memberId, name } },
        create: { memberId, name },
        update: {},
        select: { id: true },
      })
    )
  );
  const tagIds = tagRows.map(({ id }) => id);
  await transaction.plannerNoteTagAssignment.deleteMany({
    where: {
      memberId,
      noteId,
      ...(tagIds.length ? { tagId: { notIn: tagIds } } : {}),
    },
  });
  if (tagIds.length) {
    await transaction.plannerNoteTagAssignment.createMany({
      data: tagIds.map((tagId) => ({ memberId, noteId, tagId })),
      skipDuplicates: true,
    });
  }
};

export const savePlannerNote = async (memberId: string, input: unknown) => {
  const parsed = noteSchema.parse(input);
  ensureContentSize(parsed.contentJson);
  if (parsed.linkedResourceId) {
    const lesson = await getMemberAccessibleLesson(
      memberId,
      parsed.linkedResourceId
    );
    if (!lesson) {
      throw new Error("A aula vinculada não está disponível para esta conta.");
    }
  }
  const contentText = getNodeText(parsed.contentJson)
    .replace(/\s+/g, " ")
    .trim();
  const folderId = parsed.folderId ?? null;
  return database.$transaction(async (transaction) => {
    await ensureNoteFolder(transaction, memberId, folderId);
    const noteId = await persistNoteContent(
      transaction,
      memberId,
      parsed,
      folderId,
      contentText
    );
    await syncNoteTags(transaction, memberId, noteId, parsed.tagNames);
    return transaction.plannerNote.findFirstOrThrow({
      where: { id: noteId, memberId },
      select: {
        id: true,
        title: true,
        folderId: true,
        linkedResourceType: true,
        linkedResourceId: true,
        updatedAt: true,
      },
    });
  });
};

export const createPlannerNoteFolder = (memberId: string, input: unknown) => {
  const parsed = noteFolderSchema.parse(input);
  return database.$transaction(async (transaction) => {
    const parentId = parsed.parentId
      ? noteIdSchema.parse(parsed.parentId)
      : null;
    if (parentId) {
      const parent = await transaction.plannerNoteFolder.findFirst({
        where: { id: parentId, memberId, deletedAt: null },
        select: { id: true, parentId: true },
      });
      if (!parent || parent.parentId) {
        throw new Error("Subpastas podem ter apenas um nível de profundidade.");
      }
    }
    return transaction.plannerNoteFolder.create({
      data: { memberId, parentId, name: parsed.name, icon: parsed.icon },
      select: { id: true, name: true, icon: true, parentId: true },
    });
  });
};

export const renamePlannerNoteFolder = async (
  memberId: string,
  input: unknown
) => {
  const parsed = noteFolderSchema.extend({ id: noteIdSchema }).parse(input);
  const result = await database.plannerNoteFolder.updateMany({
    where: { id: parsed.id, memberId, deletedAt: null },
    data: { name: parsed.name, icon: parsed.icon },
  });
  if (result.count === 0) {
    throw new Error("A pasta não foi encontrada.");
  }
  return database.plannerNoteFolder.findFirstOrThrow({
    where: { id: parsed.id, memberId },
    select: { id: true, name: true, icon: true, parentId: true },
  });
};

export const deletePlannerNoteFolder = (memberId: string, id: string) => {
  const parsedId = noteIdSchema.parse(id);
  return database.$transaction(async (transaction) => {
    const folder = await transaction.plannerNoteFolder.findFirst({
      where: { id: parsedId, memberId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!folder) {
      throw new Error("A pasta não foi encontrada.");
    }
    await transaction.plannerNote.updateMany({
      where: { folderId: folder.id, memberId },
      data: { folderId: null },
    });
    await transaction.plannerNoteFolder.updateMany({
      where: { parentId: folder.id, memberId },
      data: { parentId: folder.parentId },
    });
    return transaction.plannerNoteFolder.deleteMany({
      where: { id: folder.id, memberId, deletedAt: null },
    });
  });
};

export const movePlannerNote = (memberId: string, input: unknown) => {
  const parsed = z
    .object({
      noteId: noteIdSchema,
      folderId: noteIdSchema.nullable(),
    })
    .parse(input);
  return database.$transaction(async (transaction) => {
    await ensureNoteFolder(transaction, memberId, parsed.folderId);
    const moved = await transaction.plannerNote.updateMany({
      where: { id: parsed.noteId, memberId, deletedAt: null },
      data: { folderId: parsed.folderId },
    });
    if (!moved.count) {
      throw new Error("A nota não foi encontrada.");
    }
    return transaction.plannerNote.findFirstOrThrow({
      where: { id: parsed.noteId, memberId },
      select: { id: true, folderId: true, updatedAt: true },
    });
  });
};

export const bulkUpdatePlannerNotes = (memberId: string, input: unknown) => {
  const parsed = z
    .object({
      noteIds: z.array(noteIdSchema).min(1).max(100),
      operation: z.enum(["MOVE", "PIN", "UNPIN", "TAG", "TRASH"]),
      folderId: noteIdSchema.nullable().optional(),
      tagName: z.string().trim().min(1).max(32).optional(),
    })
    .refine(
      ({ noteIds }) => new Set(noteIds).size === noteIds.length,
      "A seleção contém notas repetidas."
    )
    .parse(input);
  return database.$transaction(async (transaction) => {
    const notes = await transaction.plannerNote.findMany({
      where: {
        id: { in: parsed.noteIds },
        memberId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (notes.length !== parsed.noteIds.length) {
      throw new Error("Uma ou mais notas não estão mais disponíveis.");
    }
    if (parsed.operation === "MOVE") {
      if (parsed.folderId === undefined) {
        throw new Error("Escolha uma pasta para mover as notas.");
      }
      await ensureNoteFolder(transaction, memberId, parsed.folderId);
      await transaction.plannerNote.updateMany({
        where: { id: { in: parsed.noteIds }, memberId, deletedAt: null },
        data: { folderId: parsed.folderId },
      });
    } else if (parsed.operation === "PIN") {
      await transaction.plannerNote.updateMany({
        where: { id: { in: parsed.noteIds }, memberId, deletedAt: null },
        data: { pinnedAt: new Date() },
      });
    } else if (parsed.operation === "UNPIN") {
      await transaction.plannerNote.updateMany({
        where: { id: { in: parsed.noteIds }, memberId, deletedAt: null },
        data: { pinnedAt: null },
      });
    } else if (parsed.operation === "TRASH") {
      await transaction.plannerNote.updateMany({
        where: { id: { in: parsed.noteIds }, memberId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    } else {
      if (!parsed.tagName) {
        throw new Error("Informe uma etiqueta para as notas selecionadas.");
      }
      const tag = await transaction.plannerNoteTag.upsert({
        where: {
          memberId_name: { memberId, name: parsed.tagName },
        },
        create: { memberId, name: parsed.tagName },
        update: {},
        select: { id: true },
      });
      await transaction.plannerNoteTagAssignment.createMany({
        data: parsed.noteIds.map((noteId) => ({
          memberId,
          noteId,
          tagId: tag.id,
        })),
        skipDuplicates: true,
      });
      await transaction.plannerNote.updateMany({
        where: { id: { in: parsed.noteIds }, memberId, deletedAt: null },
        data: { updatedAt: new Date() },
      });
    }
    return { count: parsed.noteIds.length };
  });
};

export const movePlannerNoteToTrash = async (memberId: string, id: string) =>
  database.plannerNote.updateMany({
    where: { id: noteIdSchema.parse(id), memberId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

export const restorePlannerNote = async (memberId: string, id: string) =>
  database.plannerNote.updateMany({
    where: { id: noteIdSchema.parse(id), memberId, deletedAt: { not: null } },
    data: { deletedAt: null },
  });

export const deletePlannerNoteForever = async (memberId: string, id: string) =>
  database.plannerNote.deleteMany({
    where: { id: noteIdSchema.parse(id), memberId, deletedAt: { not: null } },
  });

export const togglePlannerNotePin = async (memberId: string, id: string) => {
  const parsedId = noteIdSchema.parse(id);
  const note = await database.plannerNote.findFirst({
    where: { id: parsedId, memberId, deletedAt: null },
    select: { pinnedAt: true },
  });
  if (!note) {
    throw new Error("A nota não foi encontrada.");
  }
  return database.plannerNote.update({
    where: { id: parsedId },
    data: { pinnedAt: note.pinnedAt ? null : new Date() },
    select: { id: true, pinnedAt: true },
  });
};

const markdownText = (node: unknown): string => {
  if (!node || typeof node !== "object") {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map(markdownText).join("");
  }
  const record = node as Record<string, unknown>;
  const content = Array.isArray(record.content)
    ? markdownText(record.content)
    : "";
  if (record.type === "text" && typeof record.text === "string") {
    const marks = Array.isArray(record.marks) ? record.marks : [];
    return marks.reduce<string>(applyMarkdownMark, record.text);
  }
  switch (record.type) {
    case "doc":
      return content.trim();
    case "paragraph":
      return `${content}\n\n`;
    case "heading": {
      const level = Number(
        (record.attrs as Record<string, unknown> | undefined)?.level ?? 2
      );
      return `${"#".repeat(Math.min(6, Math.max(1, level)))} ${content.trim()}\n\n`;
    }
    case "bulletList":
    case "orderedList":
      return content;
    case "listItem":
      return `- ${content.trim()}\n`;
    case "taskList":
      return content;
    case "taskItem":
      return `- [${(record.attrs as Record<string, unknown> | undefined)?.checked ? "x" : " "}] ${content.trim()}\n`;
    case "table": {
      const rows = Array.isArray(record.content) ? record.content : [];
      return `${rows
        .map((row, index) => {
          const cells =
            row &&
            typeof row === "object" &&
            Array.isArray((row as Record<string, unknown>).content)
              ? ((row as Record<string, unknown>).content as unknown[])
              : [];
          const values = cells.map((cell) => markdownText(cell).trim());
          const line = `| ${values.join(" | ")} |`;
          return index === 0
            ? `${line}\n| ${values.map(() => "---").join(" | ")} |`
            : line;
        })
        .join("\n")}\n\n`;
    }
    case "tableRow":
    case "tableCell":
    case "tableHeader":
      return content.trim();
    case "blockquote":
      return `${content
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`;
    case "codeBlock":
      return `\`\`\`\n${content.trim()}\n\`\`\`\n\n`;
    case "horizontalRule":
      return "---\n\n";
    case "hardBreak":
      return "  \n";
    default:
      return content;
  }
};

const applyMarkdownMark = (text: string, mark: unknown) => {
  if (!mark || typeof mark !== "object") {
    return text;
  }
  const record = mark as Record<string, unknown>;
  switch (record.type) {
    case "bold":
      return `**${text}**`;
    case "italic":
      return `*${text}*`;
    case "code":
      return `\`${text}\``;
    case "strike":
      return `~~${text}~~`;
    case "highlight":
      return `==${text}==`;
    case "link": {
      const attrs = record.attrs as Record<string, unknown> | undefined;
      return `[${text}](${typeof attrs?.href === "string" ? attrs.href : ""})`;
    }
    default:
      return text;
  }
};

export const exportPlannerNoteMarkdown = async (
  memberId: string,
  id: string
) => {
  const note = await database.plannerNote.findFirst({
    where: { id: noteIdSchema.parse(id), memberId, deletedAt: null },
    select: { title: true, contentJson: true, updatedAt: true },
  });
  if (!note) {
    throw new Error("A nota não foi encontrada.");
  }
  const markdown = `# ${note.title.replace(/[\r\n]+/g, " ")}\n\n${markdownText(note.contentJson).trim()}\n`;
  return {
    title: note.title,
    updatedAt: note.updatedAt.toISOString(),
    markdown,
  };
};
