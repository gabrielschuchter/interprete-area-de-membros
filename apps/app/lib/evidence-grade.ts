import type { Rob2Judgement } from "./evidence-rob2";

/**
 * GRADE para um desfecho: ensaios randomizados começam com certeza alta e
 * estudos observacionais com baixa; cada domínio pode rebaixar um ou dois
 * níveis; estudos observacionais sem rebaixamento podem ser elevados.
 */

export const gradeDesigns = ["RCT", "OBSERVATIONAL"] as const;
export type GradeDesign = (typeof gradeDesigns)[number];

export const gradeDesignLabels: Record<GradeDesign, string> = {
  RCT: "Ensaios randomizados",
  OBSERVATIONAL: "Estudos observacionais",
};

export const gradeDowngradeDomains = [
  {
    id: "riskOfBias",
    title: "Risco de viés",
    hint: "Limitações no delineamento ou na condução dos estudos.",
    maxLevels: 2,
  },
  {
    id: "inconsistency",
    title: "Inconsistência",
    hint: "Heterogeneidade não explicada entre os resultados dos estudos.",
    maxLevels: 2,
  },
  {
    id: "indirectness",
    title: "Evidência indireta",
    hint: "População, intervenção, comparador ou desfecho diferentes da pergunta.",
    maxLevels: 2,
  },
  {
    id: "imprecision",
    title: "Imprecisão",
    hint: "Poucos eventos ou intervalo de confiança largo, cruzando o limiar de decisão.",
    maxLevels: 2,
  },
  {
    id: "publicationBias",
    title: "Viés de publicação",
    hint: "Suspeita forte de estudos não publicados ou relato seletivo.",
    maxLevels: 1,
  },
] as const;

export type GradeDowngradeDomainId =
  (typeof gradeDowngradeDomains)[number]["id"];

export const gradeUpgradeFactors = [
  {
    id: "largeEffect",
    title: "Efeito de grande magnitude",
    maxLevels: 2,
  },
  {
    id: "doseResponse",
    title: "Gradiente dose-resposta",
    maxLevels: 1,
  },
  {
    id: "confounding",
    title: "Confundimento plausível reduziria o efeito observado",
    maxLevels: 1,
  },
] as const;

export type GradeUpgradeFactorId = (typeof gradeUpgradeFactors)[number]["id"];

export const gradeDowngradeLabels = [
  "Não grave",
  "Grave",
  "Muito grave",
] as const;

export interface GradeRating {
  readonly levels: number;
  readonly reason: string;
}

export type GradeDowngrades = Record<GradeDowngradeDomainId, GradeRating>;
export type GradeUpgrades = Record<GradeUpgradeFactorId, number>;

export const gradeCertaintyLevels = [
  "VERY_LOW",
  "LOW",
  "MODERATE",
  "HIGH",
] as const;
export type GradeCertainty = (typeof gradeCertaintyLevels)[number];

export const gradeCertaintyPresentation: Record<
  GradeCertainty,
  { readonly label: string; readonly meaning: string; readonly symbols: string }
> = {
  HIGH: {
    label: "Alta",
    symbols: "⊕⊕⊕⊕",
    meaning:
      "Há forte confiança de que o efeito verdadeiro está próximo do efeito estimado.",
  },
  MODERATE: {
    label: "Moderada",
    symbols: "⊕⊕⊕◯",
    meaning:
      "O efeito verdadeiro provavelmente está próximo do estimado, mas pode ser substancialmente diferente.",
  },
  LOW: {
    label: "Baixa",
    symbols: "⊕⊕◯◯",
    meaning:
      "O efeito verdadeiro pode ser substancialmente diferente do efeito estimado.",
  },
  VERY_LOW: {
    label: "Muito baixa",
    symbols: "⊕◯◯◯",
    meaning:
      "O efeito verdadeiro provavelmente é substancialmente diferente do efeito estimado.",
  },
};

export const emptyGradeDowngrades = (): GradeDowngrades => ({
  riskOfBias: { levels: 0, reason: "" },
  inconsistency: { levels: 0, reason: "" },
  indirectness: { levels: 0, reason: "" },
  imprecision: { levels: 0, reason: "" },
  publicationBias: { levels: 0, reason: "" },
});

export const emptyGradeUpgrades = (): GradeUpgrades => ({
  largeEffect: 0,
  doseResponse: 0,
  confounding: 0,
});

export const gradeTotalDowngrade = (downgrades: GradeDowngrades) =>
  gradeDowngradeDomains.reduce(
    (total, domain) =>
      total +
      Math.min(
        Math.max(downgrades[domain.id]?.levels ?? 0, 0),
        domain.maxLevels
      ),
    0
  );

/** Elevar só vale para estudos observacionais sem nenhum rebaixamento. */
export const gradeUpgradeAllowed = (
  design: GradeDesign,
  downgrades: GradeDowngrades
) => design === "OBSERVATIONAL" && gradeTotalDowngrade(downgrades) === 0;

export const gradeCertainty = (
  design: GradeDesign,
  downgrades: GradeDowngrades,
  upgrades: GradeUpgrades
): GradeCertainty => {
  const start = design === "RCT" ? 4 : 2;
  const upgrade = gradeUpgradeAllowed(design, downgrades)
    ? gradeUpgradeFactors.reduce(
        (total, factor) =>
          total +
          Math.min(Math.max(upgrades[factor.id] ?? 0, 0), factor.maxLevels),
        0
      )
    : 0;
  const level = Math.min(
    4,
    Math.max(1, start - gradeTotalDowngrade(downgrades) + upgrade)
  );
  return gradeCertaintyLevels[level - 1] ?? "VERY_LOW";
};

/**
 * Sugestão para o domínio risco de viés a partir dos RoB 2 ligados ao
 * desfecho: muito grave se metade ou mais tiver alto risco; grave se algum
 * tiver alto risco ou se a maioria tiver ao menos algumas preocupações.
 */
export const suggestGradeRiskOfBias = (
  judgements: readonly (Rob2Judgement | null)[]
): number | null => {
  const decided = judgements.filter(
    (judgement): judgement is Rob2Judgement => judgement !== null
  );
  if (decided.length === 0) {
    return null;
  }
  const high = decided.filter((judgement) => judgement === "HIGH").length;
  const concerns = decided.filter((judgement) => judgement !== "LOW").length;
  if (high / decided.length >= 0.5) {
    return 2;
  }
  if (high > 0 || concerns / decided.length > 0.5) {
    return 1;
  }
  return 0;
};
