import { beforeEach, describe, expect, test, vi } from "vitest";

const { database, KnownError } = vi.hoisted(() => {
  class KnownErrorImpl extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    KnownError: KnownErrorImpl,
    database: {
      contentLink: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
      exerciseList: { findMany: vi.fn(), findUnique: vi.fn() },
      lesson: { findUnique: vi.fn() },
      libraryItem: { findMany: vi.fn(), findUnique: vi.fn() },
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED", DRAFT: "DRAFT" },
  Prisma: { PrismaClientKnownRequestError: KnownError },
  database,
}));
vi.mock("./content-access", () => ({
  getLearningAccessScope: async () => ({ scope: true }),
}));
vi.mock("./exercises", () => ({
  publishedListWhere: { status: "PUBLISHED" },
}));
vi.mock("./library", () => ({
  buildLibraryItemAccessWhere: () => ({ ACCESS: true }),
}));

import { addContentLink, getLessonPractice } from "./content-links";

beforeEach(() => {
  vi.clearAllMocks();
  database.lesson.findUnique.mockResolvedValue({ id: "a1" });
  database.exerciseList.findUnique.mockResolvedValue({ id: "l1" });
  database.libraryItem.findUnique.mockResolvedValue({ id: "m1" });
});

describe("addContentLink", () => {
  test("cria o vínculo com as duas colunas", async () => {
    database.contentLink.create.mockResolvedValue({});
    const result = await addContentLink(
      { side: "lesson", id: "a1" },
      { side: "exerciseList", id: "l1" }
    );
    expect(result).toEqual({ ok: true });
    expect(database.contentLink.create).toHaveBeenCalledWith({
      data: { lessonId: "a1", exerciseListId: "l1" },
    });
  });

  test("vincular de novo o mesmo par não dá erro", async () => {
    database.contentLink.create.mockRejectedValue(new KnownError("P2002"));
    const result = await addContentLink(
      { side: "exerciseList", id: "l1" },
      { side: "lesson", id: "a1" }
    );
    expect(result).toEqual({ ok: true });
  });

  test("recusa tipos iguais sem tocar no banco", async () => {
    const result = await addContentLink(
      { side: "lesson", id: "a1" },
      { side: "lesson", id: "a2" }
    );
    expect(result.ok).toBe(false);
    expect(database.contentLink.create).not.toHaveBeenCalled();
  });

  test("recusa quando um dos conteúdos não existe mais", async () => {
    database.libraryItem.findUnique.mockResolvedValue(null);
    const result = await addContentLink(
      { side: "lesson", id: "a1" },
      { side: "libraryItem", id: "m1" }
    );
    expect(result.ok).toBe(false);
    expect(database.contentLink.create).not.toHaveBeenCalled();
  });
});

describe("getLessonPractice (Continue praticando)", () => {
  test("sem vínculos não consulta listas nem materiais", async () => {
    database.contentLink.findMany.mockResolvedValue([]);
    database.libraryItem.findMany.mockResolvedValue([]);
    const result = await getLessonPractice("m", "a1");
    expect(result).toEqual({ exerciseLists: [], libraryItems: [] });
    expect(database.exerciseList.findMany).not.toHaveBeenCalled();
  });

  test("mostra só o que o aluno pode abrir, na ordem do professor", async () => {
    database.contentLink.findMany.mockResolvedValue([
      { exerciseListId: "l2", libraryItemId: null },
      { exerciseListId: "l1", libraryItemId: null },
      { exerciseListId: null, libraryItemId: "m1" },
    ]);
    // m9 é o vínculo antigo (campo "Aula relacionada" do material).
    database.libraryItem.findMany
      .mockResolvedValueOnce([{ id: "m9" }, { id: "m1" }])
      .mockResolvedValueOnce([
        { id: "m1", kind: "ARTICLE", title: "Artigo 1" },
        { id: "m9", kind: "PDF", title: "PDF antigo" },
      ]);
    database.exerciseList.findMany.mockResolvedValue([
      {
        id: "l1",
        slug: "um",
        title: "Lista 1",
        bank: { title: "B" },
        _count: { items: 5 },
      },
      {
        id: "l2",
        slug: "dois",
        title: "Lista 2",
        bank: { title: "B" },
        _count: { items: 8 },
      },
      {
        id: "l3",
        slug: "vazia",
        title: "Sem questões",
        bank: { title: "B" },
        _count: { items: 0 },
      },
    ]);

    const result = await getLessonPractice("m", "a1");

    expect(result.exerciseLists.map(({ id }) => id)).toEqual(["l2", "l1"]);
    expect(result.libraryItems.map(({ id }) => id)).toEqual(["m1", "m9"]);
    const listWhere = database.exerciseList.findMany.mock.calls[0]?.[0].where;
    expect(listWhere).toMatchObject({ status: "PUBLISHED" });
    const itemWhere = database.libraryItem.findMany.mock.calls[1]?.[0].where;
    expect(itemWhere.AND).toContainEqual({ ACCESS: true });
    expect(itemWhere.AND[0]).toMatchObject({ status: "PUBLISHED" });
  });

  test("lista sem nenhuma questão publicada não é sugerida", async () => {
    database.contentLink.findMany.mockResolvedValue([
      { exerciseListId: "l3", libraryItemId: null },
    ]);
    database.libraryItem.findMany.mockResolvedValue([]);
    database.exerciseList.findMany.mockResolvedValue([
      {
        id: "l3",
        slug: "vazia",
        title: "Sem questões",
        bank: { title: "B" },
        _count: { items: 0 },
      },
    ]);
    const result = await getLessonPractice("m", "a1");
    expect(result.exerciseLists).toEqual([]);
  });
});
