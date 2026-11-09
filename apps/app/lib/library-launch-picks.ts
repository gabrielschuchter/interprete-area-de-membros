/**
 * Seleção inicial da esteira "Materiais mais acessados" (09/11/2026).
 *
 * Na implantação quase não há cliques (7 materiais com 9 aberturas no total),
 * então a esteira mostra materiais que costumam ser os mais procurados por
 * quem começa na prática baseada em evidências, escolhidos entre os já
 * publicados. Identificados pela URL, igual em produção, no catálogo
 * versionado e na seed. A ordem alterna os temas ao longo da faixa.
 */
export const libraryLaunchPickUrls: readonly string[] = [
  // Fundamentos da prática baseada em evidências (Sackett, 1996)
  "https://www.bmj.com/content/312/7023/71",
  // Pergunta clínica (PICO)
  "https://www.cebm.ox.ac.uk/resources/top-tips/what-makes-a-good-clinical-question",
  // PubMed
  "https://pubmed.ncbi.nlm.nih.gov/",
  // Sistema GRADE: manual brasileiro (Conitec)
  "https://www.gov.br/conitec/pt-br/midias/artigos_publicacoes/diretrizes/sistema-grade.pdf/%40%40display-file/file",
  // Nutrição baseada em evidências: hierarquia da evidência
  "https://pubmed.ncbi.nlm.nih.gov/34918032/",
  // RoB 2: ferramenta Cochrane de risco de viés
  "https://methods.cochrane.org/bias/resources/rob-2-revised-cochrane-risk-bias-tool-randomized-trials",
  // Intervalo de confiança, valor de p e significância
  "https://pubmed.ncbi.nlm.nih.gov/25724837/",
  // Cochrane Handbook
  "https://training.cochrane.org/handbook/current",
  // Desenhos de estudo
  "https://www.cebm.ox.ac.uk/resources/ebm-tools/study-designs",
  // PRISMA 2020
  "https://www.prisma-statement.org/prisma-2020",
];

/**
 * A esteira passa a seguir os cliques quando houver ao menos este número de
 * materiais abertos por pessoas diferentes o bastante para não refletir o
 * gosto de uma ou duas contas.
 */
export const CLICK_RANKING_MIN_ITEMS = 8;
export const CLICK_RANKING_MIN_READERS = 3;
