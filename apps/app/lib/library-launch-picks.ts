/**
 * Seleção inicial da esteira "Materiais mais acessados" (09/11/2026).
 *
 * Na implantação quase não há cliques (7 materiais com 9 aberturas no total),
 * então a esteira mostra materiais que já estão na Biblioteca e costumam ser
 * os mais procurados por quem começa na prática baseada em evidências. Nada é
 * criado: cada escolha aponta para um material existente pelas URLs que ele
 * tem em produção e no catálogo versionado (alguns links diferem entre os
 * dois). A ordem alterna os temas ao longo da faixa.
 */
export const libraryLaunchPicks: readonly {
  readonly label: string;
  readonly urls: readonly string[];
}[] = [
  {
    label: "Evidence based medicine: what it is and what it isn't (Sackett)",
    urls: [
      "https://www.bmj.com/content/312/7023/71",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC2349778/",
    ],
  },
  {
    label: "Asking focused clinical questions (PICO)",
    urls: [
      "https://www.cebm.ox.ac.uk/resources/top-tips/what-makes-a-good-clinical-question",
    ],
  },
  { label: "PubMed", urls: ["https://pubmed.ncbi.nlm.nih.gov/"] },
  {
    label: "Sistema GRADE: manual brasileiro (Conitec)",
    urls: [
      "https://www.gov.br/conitec/pt-br/midias/artigos_publicacoes/diretrizes/sistema-grade.pdf/%40%40display-file/file",
    ],
  },
  {
    label: "USDA NESR: grading the strength of evidence (PMID 34918032)",
    urls: ["https://pubmed.ncbi.nlm.nih.gov/34918032/"],
  },
  {
    label: "RoB 2: Cochrane risk-of-bias tool",
    urls: [
      "https://methods.cochrane.org/bias/resources/rob-2-revised-cochrane-risk-bias-tool-randomized-trials",
    ],
  },
  {
    label: "Confidence intervals, P values, and statistical significance",
    urls: ["https://pubmed.ncbi.nlm.nih.gov/25724837/"],
  },
  {
    label: "Cochrane Handbook for Systematic Reviews of Interventions",
    urls: [
      "https://training.cochrane.org/handbook/current",
      "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current",
    ],
  },
  {
    label: "Study designs in clinical research",
    urls: ["https://www.cebm.ox.ac.uk/resources/ebm-tools/study-designs"],
  },
  {
    label: "PRISMA 2020",
    urls: ["https://www.prisma-statement.org/prisma-2020"],
  },
];

export const libraryLaunchPickUrls: readonly string[] =
  libraryLaunchPicks.flatMap((pick) => pick.urls);

/** Posição da escolha a que a URL pertence; -1 se não for da seleção. */
export const libraryLaunchPickIndex = (url: string) =>
  libraryLaunchPicks.findIndex((pick) => pick.urls.includes(url));

/**
 * A esteira passa a seguir os cliques quando houver ao menos este número de
 * materiais abertos por pessoas diferentes o bastante para não refletir o
 * gosto de uma ou duas contas.
 */
export const CLICK_RANKING_MIN_ITEMS = 8;
export const CLICK_RANKING_MIN_READERS = 3;
