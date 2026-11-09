import { describe, expect, test } from "vitest";
import {
  emptyGradeDowngrades,
  emptyGradeUpgrades,
  gradeCertainty,
  suggestGradeRiskOfBias,
} from "./evidence-grade";
import {
  pruneRob2Answers,
  type Rob2Answers,
  rob2Domains,
  rob2OverallJudgement,
  rob2PendingQuestions,
  suggestRob2DomainJudgement,
} from "./evidence-rob2";

const lowRisk: Rob2Answers = {
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

describe("RoB 2: julgamento sugerido por domínio", () => {
  test("domínio 1 segue ocultação, aleatoriedade e desequilíbrio basal", () => {
    expect(suggestRob2DomainJudgement("D1", lowRisk)).toBe("LOW");
    expect(suggestRob2DomainJudgement("D1", { ...lowRisk, "1.2": "PN" })).toBe(
      "HIGH"
    );
    expect(
      suggestRob2DomainJudgement("D1", { ...lowRisk, "1.2": "NI", "1.3": "Y" })
    ).toBe("HIGH");
    expect(suggestRob2DomainJudgement("D1", { ...lowRisk, "1.2": "NI" })).toBe(
      "SOME_CONCERNS"
    );
    expect(suggestRob2DomainJudgement("D1", { ...lowRisk, "1.3": "PY" })).toBe(
      "SOME_CONCERNS"
    );
  });

  test("domínio 2 combina desvios e análise por intenção de tratar", () => {
    expect(suggestRob2DomainJudgement("D2", lowRisk)).toBe("LOW");
    const unblinded = {
      ...lowRisk,
      "2.1": "Y",
      "2.3": "Y",
      "2.4": "PY",
    } as const;
    expect(suggestRob2DomainJudgement("D2", unblinded)).toBeNull();
    expect(suggestRob2DomainJudgement("D2", { ...unblinded, "2.5": "N" })).toBe(
      "HIGH"
    );
    expect(suggestRob2DomainJudgement("D2", { ...unblinded, "2.5": "Y" })).toBe(
      "SOME_CONCERNS"
    );
    expect(
      suggestRob2DomainJudgement("D2", { ...lowRisk, "2.6": "N", "2.7": "N" })
    ).toBe("SOME_CONCERNS");
    expect(
      suggestRob2DomainJudgement("D2", { ...lowRisk, "2.6": "N", "2.7": "NI" })
    ).toBe("HIGH");
  });

  test("domínio 3 só pesa quando faltam dados e a ausência depende do desfecho", () => {
    const missing = { ...lowRisk, "3.1": "N", "3.2": "N" } as const;
    expect(suggestRob2DomainJudgement("D3", { ...missing, "3.3": "N" })).toBe(
      "LOW"
    );
    expect(
      suggestRob2DomainJudgement("D3", { ...missing, "3.3": "Y", "3.4": "N" })
    ).toBe("SOME_CONCERNS");
    expect(
      suggestRob2DomainJudgement("D3", { ...missing, "3.3": "Y", "3.4": "PY" })
    ).toBe("HIGH");
    expect(
      suggestRob2DomainJudgement("D3", {
        ...lowRisk,
        "3.1": "NI",
        "3.2": "NI",
        "3.3": "N",
      })
    ).toBe("LOW");
  });

  test("domínio 4 diferencia método inadequado e avaliador sem cegamento", () => {
    expect(suggestRob2DomainJudgement("D4", lowRisk)).toBe("LOW");
    expect(suggestRob2DomainJudgement("D4", { ...lowRisk, "4.1": "Y" })).toBe(
      "HIGH"
    );
    expect(
      suggestRob2DomainJudgement("D4", { ...lowRisk, "4.2": "NI", "4.3": "N" })
    ).toBe("SOME_CONCERNS");
    expect(
      suggestRob2DomainJudgement("D4", {
        ...lowRisk,
        "4.3": "Y",
        "4.4": "Y",
        "4.5": "PN",
      })
    ).toBe("SOME_CONCERNS");
    expect(
      suggestRob2DomainJudgement("D4", {
        ...lowRisk,
        "4.3": "Y",
        "4.4": "Y",
        "4.5": "Y",
      })
    ).toBe("HIGH");
  });

  test("domínio 5 depende do plano prévio e da seleção do resultado", () => {
    expect(suggestRob2DomainJudgement("D5", lowRisk)).toBe("LOW");
    expect(suggestRob2DomainJudgement("D5", { ...lowRisk, "5.1": "NI" })).toBe(
      "SOME_CONCERNS"
    );
    expect(suggestRob2DomainJudgement("D5", { ...lowRisk, "5.3": "PY" })).toBe(
      "HIGH"
    );
  });
});

describe("RoB 2: perguntas condicionais e julgamento geral", () => {
  test("só pede as perguntas que se aplicam", () => {
    const domain2 = rob2Domains[1];
    expect(
      domain2 &&
        rob2PendingQuestions(domain2, { "2.1": "N", "2.2": "N" }).map(
          ({ id }) => id
        )
    ).toEqual(["2.6"]);
  });

  test("descarta respostas de perguntas que deixaram de se aplicar", () => {
    expect(
      pruneRob2Answers({ ...lowRisk, "2.3": "Y", "2.4": "Y", "2.5": "N" })
    ).toEqual(lowRisk);
  });

  test("geral: baixo, alto, preocupações e elevação opcional", () => {
    expect(rob2OverallJudgement(lowRisk, {})).toBe("LOW");
    expect(rob2OverallJudgement({ ...lowRisk, "5.1": "NI" }, {})).toBe(
      "SOME_CONCERNS"
    );
    expect(rob2OverallJudgement({ ...lowRisk, "5.1": "NI" }, {}, "HIGH")).toBe(
      "HIGH"
    );
    expect(rob2OverallJudgement({ ...lowRisk, "4.1": "PY" }, {})).toBe("HIGH");
    expect(
      rob2OverallJudgement(lowRisk, {
        D3: { judgement: "HIGH", reason: "Perdas de 40% em um grupo." },
      })
    ).toBe("HIGH");
    expect(rob2OverallJudgement({ "1.1": "Y" }, {})).toBeNull();
  });
});

describe("GRADE: certeza da evidência", () => {
  test("ensaios começam altos e perdem um nível por domínio grave", () => {
    const downgrades = emptyGradeDowngrades();
    expect(gradeCertainty("RCT", downgrades, emptyGradeUpgrades())).toBe(
      "HIGH"
    );
    downgrades.imprecision = { levels: 1, reason: "IC cruza o limiar." };
    expect(gradeCertainty("RCT", downgrades, emptyGradeUpgrades())).toBe(
      "MODERATE"
    );
    downgrades.riskOfBias = { levels: 2, reason: "Maioria com alto risco." };
    downgrades.inconsistency = { levels: 2, reason: "I² de 85%." };
    expect(gradeCertainty("RCT", downgrades, emptyGradeUpgrades())).toBe(
      "VERY_LOW"
    );
  });

  test("observacionais começam baixos e só sobem sem rebaixamento", () => {
    const upgrades = { ...emptyGradeUpgrades(), largeEffect: 2 };
    expect(
      gradeCertainty("OBSERVATIONAL", emptyGradeDowngrades(), upgrades)
    ).toBe("HIGH");
    const downgrades = {
      ...emptyGradeDowngrades(),
      indirectness: { levels: 1, reason: "População diferente." },
    };
    expect(gradeCertainty("OBSERVATIONAL", downgrades, upgrades)).toBe(
      "VERY_LOW"
    );
    expect(gradeCertainty("RCT", emptyGradeDowngrades(), upgrades)).toBe(
      "HIGH"
    );
  });

  test("sugestão de risco de viés a partir dos RoB 2 ligados", () => {
    expect(suggestGradeRiskOfBias([])).toBeNull();
    expect(suggestGradeRiskOfBias(["LOW", "LOW", "SOME_CONCERNS"])).toBe(0);
    expect(suggestGradeRiskOfBias(["LOW", "SOME_CONCERNS", "HIGH"])).toBe(1);
    expect(
      suggestGradeRiskOfBias(["SOME_CONCERNS", "SOME_CONCERNS", "LOW"])
    ).toBe(1);
    expect(suggestGradeRiskOfBias(["HIGH", "HIGH", "LOW"])).toBe(2);
  });
});
