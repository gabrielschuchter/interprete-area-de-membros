import { beforeEach, describe, expect, test, vi } from "vitest";

const { database } = vi.hoisted(() => ({
  database: {
    evidenceAssessment: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  database,
  EvidenceToolKind: { GRADE: "GRADE", ROB2: "ROB2" },
}));

import {
  deleteEvidenceAssessment,
  EvidenceAssessmentError,
  saveGradeAssessment,
  saveRob2Assessment,
} from "./evidence-assessments";

const lowRiskAnswers = {
  "1.1": "Y",
  "1.2": "Y",
  "1.3": "N",
  "2.1": "N",
  "2.2": "N",
  "2.6": "Y",
  "3.1": "Y",
  "4.1": "N",
  "4.2": "N",
  "4.3": "N",
  "5.1": "Y",
  "5.2": "N",
  "5.3": "N",
};

const gradeInput = {
  title: "HbA1c",
  design: "RCT",
  downgrades: {
    riskOfBias: { levels: 1, reason: "Um ensaio com alto risco." },
    inconsistency: { levels: 0, reason: "" },
    indirectness: { levels: 0, reason: "" },
    imprecision: { levels: 0, reason: "" },
    publicationBias: { levels: 0, reason: "" },
  },
  upgrades: { largeEffect: 0, doseResponse: 0, confounding: 0 },
};

describe("avaliações de evidência no servidor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.evidenceAssessment.count.mockResolvedValue(0);
    database.evidenceAssessment.create.mockImplementation(({ data }) => ({
      ...data,
      id: "nova",
      version: 1,
    }));
  });

  test("o julgamento do RoB 2 é calculado no servidor e respostas fora de contexto somem", async () => {
    await saveRob2Assessment("member-a", {
      title: "Silva 2021",
      answers: { ...lowRiskAnswers, "2.4": "Y" },
      result: "HIGH",
    });
    const data = database.evidenceAssessment.create.mock.calls[0]?.[0]?.data;
    expect(data?.memberId).toBe("member-a");
    expect(data?.tool).toBe("ROB2");
    expect(data?.result).toBe("LOW");
    expect(data?.data.answers).not.toHaveProperty("2.4");
  });

  test("mudar o julgamento de um domínio exige justificativa", async () => {
    await expect(
      saveRob2Assessment("member-a", {
        title: "Silva 2021",
        answers: lowRiskAnswers,
        overrides: { D3: { judgement: "HIGH", reason: "" } },
      })
    ).rejects.toBeInstanceOf(EvidenceAssessmentError);
    expect(database.evidenceAssessment.create).not.toHaveBeenCalled();
  });

  test("edição só alcança a avaliação do próprio membro, na versão esperada", async () => {
    database.evidenceAssessment.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      saveRob2Assessment("member-b", {
        id: "da-member-a",
        version: 3,
        title: "Silva 2021",
        answers: lowRiskAnswers,
      })
    ).rejects.toThrow("mudou em outra aba");
    expect(
      database.evidenceAssessment.updateMany.mock.calls[0]?.[0].where
    ).toEqual({
      id: "da-member-a",
      memberId: "member-b",
      tool: "ROB2",
      deletedAt: null,
      version: 3,
    });
  });

  test("GRADE só liga RoB 2 do próprio membro e calcula a certeza", async () => {
    database.evidenceAssessment.findMany.mockResolvedValue([{ id: "meu-rob" }]);
    await saveGradeAssessment("member-a", {
      ...gradeInput,
      rob2Ids: ["meu-rob", "rob-de-outra-pessoa"],
    });
    expect(
      database.evidenceAssessment.findMany.mock.calls[0]?.[0].where
    ).toMatchObject({ memberId: "member-a", tool: "ROB2", deletedAt: null });
    const data = database.evidenceAssessment.create.mock.calls[0]?.[0]?.data;
    expect(data?.data.rob2Ids).toEqual(["meu-rob"]);
    expect(data?.result).toBe("MODERATE");
  });

  test("rebaixar no GRADE sem justificar é recusado", async () => {
    await expect(
      saveGradeAssessment("member-a", {
        ...gradeInput,
        downgrades: {
          ...gradeInput.downgrades,
          imprecision: { levels: 2, reason: "" },
        },
      })
    ).rejects.toThrow("imprecisão");
  });

  test("excluir é lógico e restrito ao dono", async () => {
    database.evidenceAssessment.updateMany.mockResolvedValue({ count: 1 });
    await deleteEvidenceAssessment("member-a", "GRADE" as never, "x");
    const call = database.evidenceAssessment.updateMany.mock.calls[0]?.[0];
    expect(call.where).toEqual({
      id: "x",
      memberId: "member-a",
      tool: "GRADE",
      deletedAt: null,
    });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });
});
