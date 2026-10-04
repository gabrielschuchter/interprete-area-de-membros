import { LibraryItemKind } from "./generated/client";

export type LibraryCatalogDifficulty =
  | "INTRODUCTORY"
  | "INTERMEDIATE"
  | "ADVANCED";

export type LibraryCatalogAccessType =
  | "OPEN_ACCESS"
  | "FREE_TO_READ"
  | "FREE_TOOL";

export interface LibraryCatalogEntry {
  accessNote: string;
  accessType: LibraryCatalogAccessType;
  authors: string;
  category: string;
  description: string;
  difficulty: LibraryCatalogDifficulty;
  doi?: string;
  kind: LibraryItemKind;
  language: string;
  linkCheckedAt: Date;
  pmid?: string;
  tags: string[];
  title: string;
  url: string;
  version?: string;
  year?: number;
}

const checkedAt = new Date("2026-10-04T00:00:00.000Z");
const defaultAccessNote =
  "A página de origem é acessível gratuitamente; materiais e artigos vinculados podem ter condições próprias, descritas pela instituição.";

const entry = (
  record: Omit<LibraryCatalogEntry, "accessNote" | "linkCheckedAt"> & {
    accessNote?: string;
  }
): LibraryCatalogEntry => ({
  accessNote: record.accessNote ?? defaultAccessNote,
  linkCheckedAt: checkedAt,
  ...record,
});

/**
 * Curadoria versionada para seed de desenvolvimento e importação aditiva pelo
 * staff. URLs apontam para a fonte oficial ou para texto integral legalmente
 * aberto. Não contém usuários, tentativas, dados de produção ou cópias locais.
 */
export const libraryCatalog: LibraryCatalogEntry[] = [
  entry({
    title: "Evidence based medicine: what it is and what it isn't",
    authors: "Sackett DL; Rosenberg WMC; Gray JAM; Haynes RB; Richardson WS",
    year: 1996,
    kind: LibraryItemKind.ARTICLE,
    category: "Fundamentos e perguntas clínicas",
    description:
      "Texto fundador sobre integrar a melhor evidência disponível, experiência clínica e valores da pessoa atendida.",
    doi: "10.1136/bmj.312.7023.71",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2349778/",
    tags: ["ebm", "fundamentos", "sackett"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TO_READ",
    accessNote:
      "Texto integral disponível gratuitamente no BMJ; artigo histórico de 1996.",
  }),
  entry({
    title: "Cochrane Handbook for Systematic Reviews of Interventions",
    authors:
      "Higgins JPT; Thomas J; Chandler J; Cumpston M; Li T; Page MJ; Welch VA (editors)",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Revisões sistemáticas e meta-análises",
    description:
      "Manual oficial para planejar, conduzir, analisar, relatar e interpretar revisões sistemáticas de intervenções.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current",
    tags: ["cochrane", "revisão sistemática", "meta-análise", "handbook"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "6.5 (2024); capítulos recebem atualizações contínuas",
    accessNote:
      "Versão HTML atual disponível gratuitamente; acesso a alguns materiais suplementares pode exigir conta Cochrane gratuita.",
  }),
  entry({
    title:
      "GRADE: an emerging consensus on rating quality of evidence and strength of recommendations",
    authors:
      "Atkins D; Best D; Briss PA; Eccles M; Falck-Ytter Y; Flottorp S; et al.",
    year: 2004,
    kind: LibraryItemKind.ARTICLE,
    category: "Certeza da evidência e GRADE",
    description:
      "Artigo fundador do grupo GRADE, útil para entender por que certeza da evidência e força da recomendação são conceitos distintos.",
    doi: "10.1136/bmj.328.7454.1490",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/2335261/",
    tags: ["grade", "certeza", "recomendação"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "OPEN_ACCESS",
    accessNote: "Artigo de acesso aberto no BMJ.",
  }),
  entry({
    title:
      "CONSORT 2010 Statement: updated guidelines for reporting parallel group randomised trials",
    authors: "Schulz KF; Altman DG; Moher D; CONSORT Group",
    year: 2010,
    kind: LibraryItemKind.ARTICLE,
    category: "Relato científico",
    description:
      "Versão histórica que permite comparar a evolução dos padrões de relato de ensaios; CONSORT 2025 é a referência atual.",
    doi: "10.1136/bmj.c332",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2844940/",
    tags: ["consort", "ensaio clínico", "histórico", "relato"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "OPEN_ACCESS",
    version:
      "2010, mantida para comparação histórica; consultar CONSORT 2025 para uso atual",
    accessNote: "Artigo histórico de acesso aberto no BMJ.",
  }),
  entry({
    title:
      "The PRISMA 2020 statement: an updated guideline for reporting systematic reviews",
    authors:
      "Page MJ; McKenzie JE; Bossuyt PM; Boutron I; Hoffmann TC; Mulrow CD; et al.",
    year: 2021,
    kind: LibraryItemKind.ARTICLE,
    category: "Relato científico",
    description:
      "Artigo da diretriz PRISMA 2020 para relato transparente de revisões sistemáticas e meta-análises.",
    doi: "10.1136/bmj.n71",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/8005924/",
    tags: ["prisma", "revisão sistemática", "relato"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "OPEN_ACCESS",
    version: "PRISMA 2020",
    accessNote:
      "Artigo de acesso aberto; checklists oficiais também estão no site PRISMA.",
  }),
  entry({
    title:
      "The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) Statement",
    authors:
      "von Elm E; Altman DG; Egger M; Pocock SJ; Gøtzsche PC; Vandenbroucke JP; STROBE Initiative",
    year: 2007,
    kind: LibraryItemKind.ARTICLE,
    category: "Relato científico",
    description:
      "Versão integral gratuita do artigo da iniciativa STROBE; apresenta itens de relato para estudos observacionais.",
    doi: "10.1371/journal.pmed.0040296",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2020495/",
    tags: ["strobe", "observacional", "epidemiologia", "relato"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "OPEN_ACCESS",
    version: "Statement de 2007; conferir extensões e traduções no site STROBE",
    accessNote:
      "Texto integral legalmente disponível no PubMed Central e no PLOS Medicine.",
  }),
  entry({
    title:
      "RoB 2: a revised tool for assessing risk of bias in randomised trials",
    authors:
      "Sterne JAC; Savović J; Page MJ; Elbers RG; Blencowe NS; Boutron I; et al.",
    year: 2019,
    kind: LibraryItemKind.ARTICLE,
    category: "Leitura crítica e risco de viés",
    description:
      "Artigo que descreve a ferramenta Cochrane RoB 2 e sua avaliação por resultado em ensaios randomizados.",
    doi: "10.1136/bmj.l4898",
    url: "https://pubmed.ncbi.nlm.nih.gov/31462531/",
    tags: ["rob2", "risco de viés", "ensaio clínico"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "OPEN_ACCESS",
    version: "RoB 2",
    accessNote:
      "Artigo de acesso aberto no BMJ; ferramenta e guias oficiais também listados.",
  }),
  entry({
    title: "Evidence-based nutrition: the importance of the evidence hierarchy",
    authors: "Dinu M; Pagliai G; Casini A; Sofi F",
    year: 2022,
    kind: LibraryItemKind.ARTICLE,
    category: "Nutrição baseada em evidências",
    description:
      "Discussão sobre hierarquia da evidência e sua aplicação crítica à avaliação de intervenções nutricionais.",
    doi: "10.1093/advances/nmab147",
    pmid: "34918032",
    url: "https://pubmed.ncbi.nlm.nih.gov/34918032/",
    tags: ["nutrição", "ebn", "hierarquia"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    accessNote:
      "Registro PubMed gratuito; seguir a opção de texto integral quando disponível na página do artigo.",
  }),
  entry({
    title: "Causal Inference: What If",
    authors: "Hernán MA; Robins JM",
    year: 2020,
    kind: LibraryItemKind.GUIDE,
    category: "Epidemiologia e desenhos de estudo",
    description:
      "Livro aberto de epidemiologia causal sobre perguntas causais, confundimento, desenhos de estudo e métodos de análise.",
    url: "https://miguelhernan.org/whatifbook",
    tags: ["causalidade", "epidemiologia", "livro aberto", "confundimento"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "OPEN_ACCESS",
    accessNote: "Livro completo disponibilizado gratuitamente pelos autores.",
  }),
  entry({
    title: "Evidence-Based Medicine Tools",
    authors: "Centre for Evidence-Based Medicine, University of Oxford",
    kind: LibraryItemKind.GUIDE,
    category: "Fundamentos e perguntas clínicas",
    description:
      "Portal institucional com recursos de perguntas clínicas, busca, leitura crítica, medidas de efeito e aplicação da evidência.",
    url: "https://www.cebm.ox.ac.uk/resources/ebm-tools",
    tags: ["ebm", "ferramentas", "oxford"],
    language: "en/pt",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TO_READ",
    accessNote:
      "Ferramentas educacionais gratuitas; a página inclui worksheets em português.",
  }),

  entry({
    title: "Asking focused clinical questions: what makes a good question?",
    authors: "Centre for Evidence-Based Medicine, University of Oxford",
    kind: LibraryItemKind.GUIDE,
    category: "Fundamentos e perguntas clínicas",
    description:
      "Guia prático para transformar dúvidas de atendimento em perguntas clínicas focadas e pesquisáveis.",
    url: "https://www.cebm.ox.ac.uk/resources/top-tips/what-makes-a-good-clinical-question",
    tags: ["pico", "pergunta clínica", "busca"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TO_READ",
  }),
  entry({
    title: "Finding the evidence: a how-to guide",
    authors: "Neal Thurley; Owen Coxall; Oxford CEBM",
    kind: LibraryItemKind.GUIDE,
    category: "Busca bibliográfica",
    description:
      "Tutorial universitário que percorre a transformação de PICO em termos, estratégia de busca e pesquisa no PubMed.",
    url: "https://www.cebm.ox.ac.uk/resources/ebm-tools/finding-the-evidence-tutorial",
    tags: ["pico", "pubmed", "estratégia de busca"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TO_READ",
  }),
  entry({
    title: "Critical appraisal tools and worksheets",
    authors: "Centre for Evidence-Based Medicine, University of Oxford",
    kind: LibraryItemKind.GUIDE,
    category: "Leitura crítica e risco de viés",
    description:
      "Folhas de leitura crítica para ensaios, diagnóstico, prognóstico, revisões sistemáticas e estudos qualitativos; inclui traduções para português.",
    url: "https://www.cebm.ox.ac.uk/resources/ebm-tools/critical-appraisal-tools",
    tags: ["leitura crítica", "worksheet", "português", "diagnóstico"],
    language: "en/pt",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
  }),
  entry({
    title: "Making a decision with clinical evidence",
    authors: "Centre for Evidence-Based Medicine, University of Oxford",
    kind: LibraryItemKind.GUIDE,
    category: "Diretrizes e decisão clínica",
    description:
      "Aplica validade interna e externa, medidas absolutas de efeito e contexto clínico à decisão baseada em evidências.",
    url: "https://www.cebm.ox.ac.uk/resources/ebm-tools/making-a-decision",
    tags: ["aplicabilidade", "validade externa", "nnt", "decisão clínica"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
  }),
  entry({
    title: "Study designs in clinical research",
    authors: "Centre for Evidence-Based Medicine, University of Oxford",
    kind: LibraryItemKind.GUIDE,
    category: "Epidemiologia e desenhos de estudo",
    description:
      "Visão comparativa de desenhos experimentais e observacionais e dos tipos de pergunta que cada desenho pode responder.",
    url: "https://www.cebm.ox.ac.uk/resources/ebm-tools/study-designs",
    tags: ["desenho de estudo", "ensaio clínico", "coorte", "caso-controle"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TO_READ",
  }),
  entry({
    title: "Data extraction in meta-analysis",
    authors: "Centre for Evidence-Based Medicine, University of Oxford",
    kind: LibraryItemKind.GUIDE,
    category: "Revisões sistemáticas e meta-análises",
    description:
      "Orientações para extração de dados e tratamento de tabelas de resultados em meta-análises, incluindo dados diagnósticos.",
    url: "https://www.cebm.ox.ac.uk/resources/ebm-tools/data-extraction-in-meta-analysis",
    tags: ["extração de dados", "meta-análise", "2x2"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
  }),
  entry({
    title: "Five tips to jump-start your evidence-based practice",
    authors: "Centre for Evidence-Based Medicine, University of Oxford",
    kind: LibraryItemKind.ARTICLE,
    category: "Fundamentos e perguntas clínicas",
    description:
      "Introdução concisa aos passos de uma prática baseada em evidências, incluindo PICO, leitura e uso da pesquisa.",
    url: "https://www.cebm.ox.ac.uk/resources/top-tips/five-tips-to-jump-start-your-evidence-based-practice",
    tags: ["pbe", "pico", "fundamentos"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TO_READ",
  }),

  entry({
    title:
      "Cochrane Handbook, Chapter 2: Determining the scope of the review and the questions it will address",
    authors: "Cochrane Methods; Cochrane Information Retrieval Methods Group",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Fundamentos e perguntas clínicas",
    description:
      "Capítulo sobre delimitação da pergunta, população, intervenção, comparadores, desfechos e escopo de uma revisão.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-02",
    tags: ["pico", "pergunta", "revisão sistemática"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Handbook 6.5; verifique a data de atualização do capítulo",
  }),
  entry({
    title: "Cochrane Handbook, Chapter 4: Searching for and selecting studies",
    authors: "Cochrane Information Retrieval Methods Group",
    year: 2025,
    kind: LibraryItemKind.GUIDE,
    category: "Busca bibliográfica",
    description:
      "Planejamento de buscas sensíveis e reproduzíveis, fontes de informação, gestão de registros e seleção de estudos.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-04",
    tags: ["cochrane", "embase", "pubmed", "estratégia de busca"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Handbook 6.5.1; capítulo atualizado em março de 2025",
  }),
  entry({
    title:
      "Cochrane Handbook, Chapter 6: Choosing effect measures and computing estimates of effect",
    authors: "Cochrane Statistical Methods Group",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Bioestatística e interpretação",
    description:
      "Escolha e interpretação de medidas de efeito para desfechos binários, contínuos e de tempo até evento.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06",
    tags: ["medidas de efeito", "rr", "or", "diferença média"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Handbook 6.5",
  }),
  entry({
    title:
      "Cochrane Handbook, Chapter 7: Considering bias and conflicts of interest among the included studies",
    authors: "Cochrane Methods",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Leitura crítica e risco de viés",
    description:
      "Discute como vieses e conflitos de interesse nos estudos incluídos afetam a interpretação de uma revisão.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-07",
    tags: ["viés", "conflito de interesse", "revisão sistemática"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Handbook 6.5",
  }),
  entry({
    title:
      "Cochrane Handbook, Chapter 8: Assessing risk of bias in a randomized trial",
    authors: "Cochrane Bias Methods Group",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Leitura crítica e risco de viés",
    description:
      "Fundamentos metodológicos para avaliar risco de viés em ensaios randomizados e aplicar RoB 2.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-08",
    tags: ["rob2", "ensaio randomizado", "risco de viés"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Handbook 6.5",
  }),
  entry({
    title:
      "Cochrane Handbook, Chapter 10: Analysing data and undertaking meta-analyses",
    authors: "Cochrane Statistical Methods Group",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Revisões sistemáticas e meta-análises",
    description:
      "Métodos de síntese quantitativa, modelos, heterogeneidade e interpretação de meta-análises.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-10",
    tags: ["meta-análise", "heterogeneidade", "efeito combinado"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Handbook 6.5",
  }),
  entry({
    title:
      "Cochrane Handbook, Chapter 13: Assessing risk of bias due to missing results in a synthesis",
    authors: "Cochrane Bias Methods Group",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Revisões sistemáticas e meta-análises",
    description:
      "Como identificar e avaliar viés decorrente de resultados ausentes e relato seletivo em sínteses.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-13",
    tags: ["viés de publicação", "resultados ausentes", "rob-me"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Handbook 6.5",
  }),
  entry({
    title:
      "Cochrane Handbook, Chapter 14: Completing summary of findings tables and GRADE assessments",
    authors: "Cochrane Methods; GRADE Working Group",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Certeza da evidência e GRADE",
    description:
      "Construção de tabelas Summary of Findings e aplicação dos domínios GRADE à certeza do conjunto da evidência.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14",
    tags: ["grade", "summary of findings", "certeza"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Handbook 6.5",
  }),
  entry({
    title:
      "Cochrane Handbook, Chapter 15: Interpreting results and drawing conclusions",
    authors: "Cochrane Methods",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Bioestatística e interpretação",
    description:
      "Interpretação de estimativas, intervalos de confiança, heterogeneidade, certeza e aplicabilidade sem depender apenas de p-valores.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-15",
    tags: ["intervalo de confiança", "interpretação", "aplicabilidade"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Handbook 6.5",
  }),
  entry({
    title:
      "Cochrane Handbook for Systematic Reviews of Diagnostic Test Accuracy",
    authors: "Deeks JJ; Bossuyt PM; Leeflang MM; Takwoingi Y (editors)",
    year: 2023,
    kind: LibraryItemKind.GUIDE,
    category: "Diagnóstico e prognóstico",
    description:
      "Manual oficial para perguntas, busca, risco de viés e síntese de revisões de acurácia diagnóstica.",
    url: "https://www.cochrane.org/authors/handbooks-and-manuals/handbook-systematic-reviews-diagnostic-test-accuracy",
    tags: ["diagnóstico", "acurácia", "quadas", "meta-análise"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "2.0, atualizada em julho de 2023",
    accessNote:
      "Página oficial e informações de acesso gratuitas; PDFs dos capítulos podem exigir uma conta Cochrane gratuita.",
  }),

  entry({
    title: "PubMed",
    authors: "National Library of Medicine, National Institutes of Health",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Base gratuita de referências biomédicas com MEDLINE, filtros, termos MeSH e links para texto integral quando disponível.",
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    tags: ["pubmed", "medline", "busca", "meSH"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TOOL",
    accessNote:
      "Busca e registros são gratuitos; nem todo artigo indexado tem texto integral gratuito.",
  }),
  entry({
    title: "PubMed User Guide",
    authors: "National Library of Medicine, National Institutes of Health",
    kind: LibraryItemKind.GUIDE,
    category: "Busca bibliográfica",
    description:
      "Documentação oficial de sintaxe, campos, filtros, histórico, busca avançada, MeSH e Clinical Queries.",
    url: "https://pubmed.ncbi.nlm.nih.gov/help/",
    tags: ["pubmed", "sintaxe", "filtros", "ajuda"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "Documentação online continuamente atualizada",
  }),
  entry({
    title: "How do I search in Embase?",
    authors: "Elsevier Embase Support Center",
    kind: LibraryItemKind.GUIDE,
    category: "Busca bibliográfica",
    description:
      "Documentação oficial de busca no Embase, cobrindo Emtree, mapeamento, busca avançada, operadores booleanos/de proximidade e campos.",
    url: "https://www.elsevier.support/embase/answer/how-do-i-search-in-embase",
    tags: ["embase", "emtree", "busca avançada", "sintaxe", "base de dados"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    accessNote:
      "A documentação de ajuda é gratuita. O acesso à base Embase em si pode exigir assinatura institucional.",
  }),
  entry({
    title: "JBI Manual for Evidence Synthesis, 2024 edition",
    authors: "JBI; editors Edoardo Aromataris and Zachary Munn",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Revisões sistemáticas e meta-análises",
    description:
      "Manual oficial atualizado para diferentes sínteses, incluindo revisões qualitativas, de escopo, umbrella, textuais e de métodos mistos; inclui métodos de busca e aplicação da evidência.",
    url: "https://synthesismanual.jbi.global/",
    tags: ["jbi", "revisão sistemática", "scoping review", "síntese", "manual"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Edição 2024, atualizada on-line",
    accessNote:
      "Manual on-line de acesso gratuito publicado pelo JBI; a edição 2024 substitui edições anteriores como referência corrente.",
  }),
  entry({
    title: "JBI Critical Appraisal Tools",
    authors: "JBI",
    kind: LibraryItemKind.LINK,
    category: "Leitura crítica e risco de viés",
    description:
      "Conjunto oficial de checklists de leitura crítica para diferentes desenhos, incluindo ensaios, estudos qualitativos, prevalência e avaliações econômicas.",
    url: "https://jbi.global/critical-appraisal-tools",
    tags: ["jbi", "checklist", "leitura crítica", "risco de viés"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    accessNote:
      "Página e checklists de uso educacional disponíveis gratuitamente pelo JBI.",
  }),
  entry({
    title: "Diretrizes metodológicas: elaboração de diretrizes clínicas",
    authors: "Brasil. Ministério da Saúde; CONITEC",
    year: 2023,
    kind: LibraryItemKind.PDF,
    category: "Diretrizes e decisão clínica",
    description:
      "Manual brasileiro abrangente para definir perguntas PICO, buscar e avaliar evidências, aplicar GRADE, formular recomendações e adaptar/implementar diretrizes clínicas.",
    url: "https://www.gov.br/conitec/pt-br/midias/artigos_publicacoes/diretrizes/diretrizes-metodologicas-elaboracao-de-diretrizes-clinicas-2020.pdf/%40%40display-file/file",
    tags: ["diretriz clínica", "pico", "grade", "conitec", "português"],
    language: "pt",
    difficulty: "ADVANCED",
    accessType: "OPEN_ACCESS",
    version: "Edição eletrônica 2023",
    accessNote:
      "Publicação oficial de acesso gratuito; licença Creative Commons BY-NC-SA 4.0.",
  }),
  entry({
    title:
      "Revisão sistemática com meta-análise em rede de ensaios clínicos randomizados",
    authors:
      "Brasil. Ministério da Saúde; CONITEC; Hospital Alemão Oswaldo Cruz",
    year: 2025,
    kind: LibraryItemKind.PDF,
    category: "Revisões sistemáticas e meta-análises",
    description:
      "Diretriz metodológica brasileira recente para planejar, conduzir e interpretar revisões sistemáticas com meta-análise em rede de ensaios randomizados.",
    url: "https://www.gov.br/conitec/pt-br/midias/artigos_publicacoes/diretrizes/diretrizes-metodologicas-revisao-sistematica-com-meta-analise-em-rede-de-ensaios-clinicos-randomizados-1/%40%40display-file/file",
    tags: [
      "meta-análise em rede",
      "revisão sistemática",
      "ensaio clínico",
      "português",
    ],
    language: "pt",
    difficulty: "ADVANCED",
    accessType: "OPEN_ACCESS",
    version: "1ª edição eletrônica, 2025",
    accessNote:
      "Publicação oficial de acesso gratuito; licença Creative Commons BY-NC-SA 4.0.",
  }),
  entry({
    title:
      "Diretrizes metodológicas: revisão sistemática e meta-análise de acurácia diagnóstica",
    authors:
      "Brasil. Ministério da Saúde; Departamento de Ciência e Tecnologia",
    year: 2014,
    kind: LibraryItemKind.PDF,
    category: "Diagnóstico e prognóstico",
    description:
      "Manual brasileiro para planejar e conduzir revisões sistemáticas de acurácia diagnóstica, da pergunta e busca à síntese e ao relato.",
    url: "https://www.gov.br/conitec/pt-br/midias/artigos_publicacoes/diretrizes/revisaosistematica_metanaliseestudos.pdf/%40%40display-file/file",
    tags: ["diagnóstico", "acurácia", "revisão sistemática", "português"],
    language: "pt",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "1ª edição, 2014; use junto às ferramentas atuais QUADAS-3",
    accessNote:
      "PDF institucional gratuito. Mantido como introdução em português; a ferramenta QUADAS-3 atual está listada separadamente.",
  }),
  entry({
    title:
      "Sistema GRADE: manual brasileiro para graduação da evidência e força de recomendação",
    authors:
      "Brasil. Ministério da Saúde; Departamento de Ciência e Tecnologia",
    year: 2014,
    kind: LibraryItemKind.PDF,
    category: "Certeza da evidência e GRADE",
    description:
      "Manual em português sobre aplicação do GRADE para avaliar certeza da evidência e força de recomendações na tomada de decisão em saúde.",
    url: "https://www.gov.br/conitec/pt-br/midias/artigos_publicacoes/diretrizes/sistema-grade.pdf/%40%40display-file/file",
    tags: ["grade", "certeza da evidência", "recomendação", "português"],
    language: "pt",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version:
      "1ª edição, 2014; consultar também The GRADE Book para atualizações metodológicas",
    accessNote:
      "PDF institucional gratuito. Referência didática em português; para desenvolvimentos recentes, consultar também o GRADE Book oficial.",
  }),
  entry({
    title:
      "PRESS 2015 Guideline Statement for peer review of search strategies",
    authors:
      "McGowan J; Sampson M; Salzwedel DM; Cogo E; Foerster V; Lefebvre C",
    year: 2016,
    kind: LibraryItemKind.ARTICLE,
    category: "Busca bibliográfica",
    description:
      "Diretriz baseada em evidências para revisão por pares de estratégias eletrônicas de busca em revisões sistemáticas e sínteses de evidência.",
    doi: "10.1016/j.jclinepi.2016.01.021",
    pmid: "27005575",
    url: "https://pubmed.ncbi.nlm.nih.gov/27005575/",
    tags: ["press", "estratégia de busca", "revisão por pares", "protocolo"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "PRESS 2015 Guideline Statement",
    accessNote:
      "Registro PubMed gratuito identificado como artigo gratuito; inclui referência às checklists PRESS 2015.",
  }),
  entry({
    title: "PubMed Advanced Search Builder",
    authors: "National Library of Medicine, National Institutes of Health",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Construtor para combinar consultas, campos, histórico e detalhes da tradução automática da busca PubMed.",
    url: "https://pubmed.ncbi.nlm.nih.gov/advanced/",
    tags: ["pubmed", "busca avançada", "booleanos"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Ferramenta de busca gratuita; o acesso aos artigos varia por publicação.",
  }),
  entry({
    title: "PubMed Clinical Queries",
    authors: "National Library of Medicine, National Institutes of Health",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Filtros especializados para perguntas de terapia, diagnóstico, etiologia, prognóstico e estudos clínicos.",
    url: "https://pubmed.ncbi.nlm.nih.gov/clinical/",
    tags: ["pubmed", "clinical queries", "diagnóstico", "prognóstico"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Filtros e busca gratuitos; o texto integral pode depender da publicação.",
  }),
  entry({
    title: "Medical Subject Headings (MeSH) Browser",
    authors: "National Library of Medicine, National Institutes of Health",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Vocabulário controlado da NLM para identificar descritores, hierarquias e conceitos usados em buscas biomédicas.",
    url: "https://meshb.nlm.nih.gov/",
    tags: ["mesh", "vocabulário controlado", "estratégia de busca"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote: "Base pública gratuita da National Library of Medicine.",
  }),
  entry({
    title: "PubMed Central (PMC)",
    authors: "National Library of Medicine, National Institutes of Health",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Arquivo gratuito de artigos de periódicos biomédicos em texto integral, com informação de licença por artigo.",
    url: "https://pmc.ncbi.nlm.nih.gov/",
    tags: ["pmc", "texto integral", "open access", "arquivo"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TOOL",
    accessNote:
      "A leitura é gratuita; direitos de reutilização variam por artigo e devem ser consultados individualmente.",
  }),
  entry({
    title: "NCBI Bookshelf",
    authors:
      "National Center for Biotechnology Information, National Library of Medicine",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Coleção pública de livros e documentos biomédicos e de ciências da vida em texto integral gratuito.",
    url: "https://www.ncbi.nlm.nih.gov/books/",
    tags: ["livros", "manuais", "ncbi", "texto integral"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TOOL",
    accessNote:
      "Consulta gratuita; licenças e direitos de reutilização variam conforme o livro/documento.",
  }),
  entry({
    title: "Europe PMC",
    authors: "Europe PMC Funders",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Plataforma gratuita de literatura biomédica, preprints, dados de financiamento e links para texto integral aberto.",
    url: "https://europepmc.org/",
    tags: ["europe pmc", "busca", "preprints", "open access"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Busca e registros são gratuitos; a disponibilidade do texto completo depende da licença e do depósito.",
  }),
  entry({
    title: "Epistemonikos Database",
    authors: "Epistemonikos Foundation",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Base de evidência em saúde que organiza revisões sistemáticas e estudos primários relacionados para apoiar decisões.",
    url: "https://www.epistemonikos.org/",
    tags: ["revisões sistemáticas", "evidência em saúde", "busca"],
    language: "en/es",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Busca e resultados bibliográficos gratuitos; o acesso ao texto completo é determinado pela fonte original.",
  }),
  entry({
    title:
      "LILACS: Literatura Latino-Americana e do Caribe em Ciências da Saúde",
    authors: "BIREME/OPAS/OMS",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Índice regional colaborativo de literatura científica e técnica em saúde da América Latina e do Caribe.",
    url: "https://lilacs.bvsalud.org/en/",
    tags: ["lilacs", "américa latina", "saúde", "português"],
    language: "pt/es/en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Busca gratuita; a base indexa registros de diversas fontes e não garante texto integral de todos os itens.",
  }),
  entry({
    title: "Biblioteca Virtual em Saúde (BVS)",
    authors: "BIREME/OPAS/OMS",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Portal regional para pesquisar bases e coleções de literatura em saúde, incluindo LILACS e recursos em português.",
    url: "https://bvsalud.org/",
    tags: ["bvs", "lilacs", "busca", "português"],
    language: "pt/es/en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TOOL",
    accessNote:
      "Portal e busca gratuitos; disponibilidade de texto integral depende de cada registro.",
  }),
  entry({
    title: "OpenAlex",
    authors: "OurResearch",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Catálogo aberto de trabalhos, autores, instituições, fontes e conceitos acadêmicos, com API pública e filtros de acesso aberto.",
    url: "https://openalex.org/",
    tags: ["openalex", "bibliometria", "busca", "metadados"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Consulta pública gratuita; links de texto integral dependem dos repositórios de origem.",
  }),
  entry({
    title: "Directory of Open Access Journals (DOAJ)",
    authors: "DOAJ Foundation",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Diretório de periódicos e artigos de acesso aberto com critérios editoriais e metadados pesquisáveis.",
    url: "https://doaj.org/",
    tags: ["doaj", "periódicos", "open access", "busca"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TOOL",
    accessNote:
      "Diretório de busca gratuito; os artigos listados seguem suas licenças editoriais.",
  }),
  entry({
    title: "Cochrane Evidence",
    authors: "Cochrane",
    kind: LibraryItemKind.LINK,
    category: "Busca bibliográfica",
    description:
      "Resumos em linguagem acessível das revisões Cochrane para localizar e compreender sínteses de evidência em saúde.",
    url: "https://www.cochrane.org/evidence",
    tags: ["cochrane", "revisões", "resumos", "saúde"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TOOL",
    accessNote:
      "Resumos públicos gratuitos; texto integral de algumas revisões pode ter restrições de acesso.",
  }),
  entry({
    title: "ClinicalTrials.gov",
    authors: "U.S. National Library of Medicine, National Institutes of Health",
    kind: LibraryItemKind.LINK,
    category: "Protocolos e registro",
    description:
      "Registro público de estudos clínicos e respectivos resultados enviados por responsáveis pelos estudos.",
    url: "https://clinicaltrials.gov/",
    tags: ["registro de ensaios", "protocolo", "resultados", "busca"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Pesquisa pública gratuita; a qualidade e completude dos registros variam.",
  }),
  entry({
    title: "WHO International Clinical Trials Registry Platform (ICTRP)",
    authors: "World Health Organization",
    kind: LibraryItemKind.LINK,
    category: "Protocolos e registro",
    description:
      "Portal de busca da OMS que agrega registros de ensaios clínicos primários reconhecidos pela ICTRP.",
    url: "https://trialsearch.who.int/",
    tags: ["who", "ict rp", "registro de ensaios", "busca"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Busca pública gratuita de registros; os registros permanecem sob responsabilidade de cada registro primário.",
  }),

  entry({
    title: "Introduction to Epidemiology: Public Health 101",
    authors: "Centers for Disease Control and Prevention (CDC)",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Epidemiologia e desenhos de estudo",
    description:
      "Curso introdutório público sobre conceitos, fontes de dados e desenhos de estudo epidemiológicos.",
    url: "https://www.cdc.gov/training-publichealth101/php/training/introduction-to-epidemiology.html",
    tags: ["epidemiologia", "curso", "cdc", "introdução"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TO_READ",
    accessNote: "Material educacional público e gratuito do CDC.",
  }),
  entry({
    title: "CDC Field Epidemiology Manual: Analyzing and Interpreting Data",
    authors: "Centers for Disease Control and Prevention (CDC)",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Bioestatística e interpretação",
    description:
      "Capítulo aplicado de epidemiologia de campo sobre medidas de associação, intervalos de confiança, testes e interpretação.",
    url: "https://www.cdc.gov/field-epi-manual/php/chapters/analyze-interpret-data.html",
    tags: ["epidemiologia", "intervalo de confiança", "medidas de associação"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
  }),
  entry({
    title:
      "Principles of Epidemiology in Public Health Practice, Third Edition",
    authors: "Centers for Disease Control and Prevention (CDC)",
    year: 2012,
    kind: LibraryItemKind.GUIDE,
    category: "Epidemiologia e desenhos de estudo",
    description:
      "Manual introdutório de epidemiologia aplicada à saúde pública; edição antiga mantida como referência didática fundamental.",
    url: "https://stacks.cdc.gov/view/cdc/13178",
    tags: ["epidemiologia", "cdc", "manual", "fundamentos"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TO_READ",
    version: "3ª edição (2012), material de referência histórico",
    accessNote:
      "Registro oficial gratuito do CDC Stacks com acesso ao PDF integral.",
  }),
  entry({
    title: "Introduction to Statistics for the Life and Biomedical Sciences",
    authors: "OpenIntro; David Harrington; Julie Vu",
    kind: LibraryItemKind.GUIDE,
    category: "Bioestatística e interpretação",
    description:
      "Livro introdutório aberto de estatística com exemplos de medicina, saúde pública e ciências da vida.",
    url: "https://www.openintro.org/book/biostat/",
    tags: ["bioestatística", "livro aberto", "medicina", "exercícios"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "OPEN_ACCESS",
    accessNote:
      "Livro e PDF disponíveis gratuitamente pelo projeto OpenIntro; edição impressa é opcional.",
  }),
  entry({
    title: "Confidence intervals, P values, and statistical significance",
    authors: "Philip Sedgwick",
    year: 2015,
    kind: LibraryItemKind.ARTICLE,
    category: "Bioestatística e interpretação",
    description:
      "Artigo educacional sobre o que intervalos de confiança e p-valores informam — e o que não permitem concluir.",
    doi: "10.1136/bmj.h1113",
    url: "https://pubmed.ncbi.nlm.nih.gov/25724837/",
    tags: ["p-valor", "intervalo de confiança", "significância"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "OPEN_ACCESS",
    accessNote: "Artigo BMJ de acesso aberto.",
  }),
  entry({
    title: "ASA Statement on Statistical Significance and P-Values",
    authors:
      "American Statistical Association; Wasserstein RL; Lazar NA (editors)",
    year: 2016,
    kind: LibraryItemKind.PDF,
    category: "Bioestatística e interpretação",
    description:
      "Seis princípios da ASA para interpretar p-valores e evitar conclusões baseadas em um limiar isolado de significância.",
    doi: "10.1080/00031305.2016.1154108",
    url: "https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf",
    tags: ["asa", "p-valor", "inferência", "significância"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    accessNote:
      "Declaração metodológica em PDF publicada gratuitamente pela ASA.",
  }),
  entry({
    title: "DAGitty: drawing and analyzing causal diagrams",
    authors: "Johannes Textor; DAGitty project",
    kind: LibraryItemKind.LINK,
    category: "Epidemiologia e desenhos de estudo",
    description:
      "Ferramenta interativa para construir diagramas causais, discutir confundimento e identificar conjuntos de ajuste.",
    url: "https://www.dagitty.net/",
    tags: ["causalidade", "dag", "confundimento", "ferramenta"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TOOL",
    accessNote: "Ferramenta web gratuita; software de código aberto.",
  }),
  entry({
    title: "DAGitty tutorials",
    authors: "DAGitty project",
    kind: LibraryItemKind.GUIDE,
    category: "Epidemiologia e desenhos de estudo",
    description:
      "Tutoriais para desenhar DAGs e raciocinar sobre identificação causal, variáveis de ajuste e viés de seleção.",
    url: "https://dagitty.net/learn/",
    tags: ["dag", "causalidade", "tutorial", "viés"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
  }),

  entry({
    title: "RoB 2: Cochrane risk-of-bias tool for randomized trials",
    authors: "Cochrane Bias Methods Group",
    kind: LibraryItemKind.GUIDE,
    category: "Leitura crítica e risco de viés",
    description:
      "Página oficial da ferramenta atual recomendada para julgar risco de viés em resultados de ensaios randomizados.",
    url: "https://methods.cochrane.org/bias/resources/rob-2-revised-cochrane-risk-bias-tool-randomized-trials",
    tags: ["rob2", "ensaio randomizado", "ferramenta", "risco de viés"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "RoB 2; ferramenta recomendada pela Cochrane",
  }),
  entry({
    title: "ROBINS-I V2 tool for non-randomized studies of interventions",
    authors: "Cochrane Bias Methods Group; Bristol Methods Group",
    year: 2025,
    kind: LibraryItemKind.GUIDE,
    category: "Leitura crítica e risco de viés",
    description:
      "Ferramenta para risco de viés em resultados de estudos não randomizados de intervenções; a versão disponível ainda é rascunho.",
    url: "https://www.riskofbias.info/welcome/robins-i-v2",
    tags: ["robins-i", "estudos observacionais", "intervenção", "rascunho"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "V2, revisão de 20 nov. 2025; draft sujeito a alterações",
    accessNote:
      "Documento oficial gratuito; está marcado pelos desenvolvedores como draft, não versão final.",
  }),
  entry({
    title: "ROBINS-E tool for non-randomized studies of exposures",
    authors: "ROBINS-E Development Group; Cochrane Methods",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Leitura crítica e risco de viés",
    description:
      "Ferramenta estruturada para avaliar risco de viés em estudos epidemiológicos observacionais de exposições.",
    url: "https://www.riskofbias.info/welcome/robins-e-tool",
    tags: ["robins-e", "exposição", "observacional", "causalidade"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "24 de março de 2024",
  }),
  entry({
    title: "ROB-ME: risk of bias due to missing evidence",
    authors: "Cochrane Bias Methods Group",
    kind: LibraryItemKind.GUIDE,
    category: "Leitura crítica e risco de viés",
    description:
      "Ferramenta para avaliar viés em sínteses causado por estudos ou resultados ausentes, inclusive relato seletivo.",
    url: "https://methods.cochrane.org/bias/resources/rob-me",
    tags: ["rob-me", "viés de publicação", "resultados ausentes"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version:
      "Ferramenta oficial Cochrane; consultar a página para versão vigente",
  }),
  entry({
    title: "ROBIS: Risk of Bias in Systematic Reviews",
    authors: "University of Bristol; ROBIS Group",
    kind: LibraryItemKind.GUIDE,
    category: "Leitura crítica e risco de viés",
    description:
      "Ferramenta específica para avaliar risco de viés em revisões sistemáticas, distinta de avaliar a qualidade do relato.",
    url: "https://www.bristol.ac.uk/population-health-sciences/projects/robis/",
    tags: ["robis", "revisão sistemática", "risco de viés"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
  }),
  entry({
    title: "QUADAS-3: quality assessment of diagnostic accuracy studies",
    authors: "QUADAS Group; University of Bristol",
    year: 2026,
    kind: LibraryItemKind.GUIDE,
    category: "Diagnóstico e prognóstico",
    description:
      "Ferramenta atual para risco de viés e aplicabilidade em estudos de acurácia diagnóstica incluídos em revisões.",
    url: "https://www.bristol.ac.uk/population-health-sciences/projects/quadas/",
    tags: ["quadas-3", "diagnóstico", "acurácia", "risco de viés"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "QUADAS-3, versão corrente recomendada na página institucional",
  }),
  entry({
    title: "AMSTAR 2: critical appraisal of systematic reviews",
    authors: "Shea BJ; Reeves BC; Wells G; et al.; AMSTAR Group",
    year: 2017,
    kind: LibraryItemKind.GUIDE,
    category: "Leitura crítica e risco de viés",
    description:
      "Ferramenta de 16 itens para avaliar revisões sistemáticas de intervenções que incluam estudos randomizados ou não randomizados.",
    doi: "10.1136/bmj.j4008",
    url: "https://amstar.ca/Amstar-2.php",
    tags: ["amstar 2", "revisão sistemática", "leitura crítica"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "AMSTAR 2",
    accessNote:
      "Ferramenta, formulário e guia oficial de uso disponíveis gratuitamente.",
  }),
  entry({
    title: "PROBAST+AI: risk of bias and applicability of prediction models",
    authors: "PROBAST+AI Group; BMJ",
    year: 2025,
    kind: LibraryItemKind.ARTICLE,
    category: "Diagnóstico e prognóstico",
    description:
      "Atualização da ferramenta para avaliar qualidade, risco de viés e aplicabilidade de modelos de predição com regressão ou IA.",
    doi: "10.1136/bmj-2024-082505",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/11931409/",
    tags: ["probast-ai", "predição", "inteligência artificial", "prognóstico"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "OPEN_ACCESS",
    version: "PROBAST+AI (2025)",
    accessNote: "Artigo e materiais metodológicos de acesso aberto no BMJ.",
  }),
  entry({
    title: "PROBAST: prediction model risk of bias assessment tool",
    authors: "PROBAST Group; University of Bristol",
    year: 2019,
    kind: LibraryItemKind.GUIDE,
    category: "Diagnóstico e prognóstico",
    description:
      "Ferramenta original para avaliar risco de viés e aplicabilidade em estudos de desenvolvimento e validação de modelos de predição.",
    url: "https://www.probast.org/",
    tags: ["probast", "predição", "prognóstico", "validação"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version:
      "PROBAST; usar PROBAST+AI quando a ferramenta/modelo envolver IA conforme seu escopo",
  }),
  entry({
    title: "NHLBI Study Quality Assessment Tools",
    authors: "National Heart, Lung, and Blood Institute, NIH",
    kind: LibraryItemKind.GUIDE,
    category: "Leitura crítica e risco de viés",
    description:
      "Conjunto público de roteiros por desenho, como ensaios, coortes, estudos transversais e séries de casos; não são instrumentos padronizados universais.",
    url: "https://www.nhlbi.nih.gov/health-topics/study-quality-assessment-tools",
    tags: ["nih", "qualidade", "coorte", "ensaio clínico"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    accessNote:
      "Materiais gratuitos; o próprio NHLBI ressalta que esses roteiros não são ferramentas padronizadas independentes.",
  }),

  entry({
    title: "The GRADE Book",
    authors: "GRADE Working Group",
    year: 2026,
    kind: LibraryItemKind.GUIDE,
    category: "Certeza da evidência e GRADE",
    description:
      "Publicação oficial viva do GRADE Working Group, atualizada progressivamente e destinada a substituir o antigo GRADE Handbook.",
    url: "https://book.gradepro.org/",
    tags: ["grade", "certeza", "recomendação", "manual"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "Conteúdo vivo; versão corrente consultada em outubro de 2026",
    accessNote: "Livro online oficial disponível gratuitamente.",
  }),
  entry({
    title: "Overview of the GRADE approach",
    authors: "GRADE Working Group",
    year: 2026,
    kind: LibraryItemKind.GUIDE,
    category: "Certeza da evidência e GRADE",
    description:
      "Capítulo atual sobre domínios de certeza, Summary of Findings, perfis de evidência e passagem da evidência às recomendações.",
    url: "https://book.gradepro.org/guideline/overview-of-the-grade-approach",
    tags: ["grade", "certeza", "summary of findings", "domínios"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "GRADE Book, atualizado em maio de 2026",
  }),
  entry({
    title: "Introduction to GRADE Evidence-to-Decision frameworks",
    authors: "GRADE Working Group",
    year: 2026,
    kind: LibraryItemKind.GUIDE,
    category: "Diretrizes e decisão clínica",
    description:
      "Estrutura julgamentos explícitos sobre benefícios, danos, valores, recursos, equidade, aceitabilidade e viabilidade.",
    url: "https://book.gradepro.org/guideline/introduction-to-the-evidence-to-decision-frameworks",
    tags: [
      "grade",
      "evidence to decision",
      "diretriz",
      "decisão compartilhada",
    ],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "GRADE Book, atualizado em março de 2026",
  }),
  entry({
    title: "GRADEpro Guideline Development Tool (GDT)",
    authors: "McMaster University; GRADE Working Group",
    kind: LibraryItemKind.LINK,
    category: "Certeza da evidência e GRADE",
    description:
      "Aplicação web para preparar perfis de evidência, tabelas Summary of Findings e Evidence-to-Decision.",
    url: "https://gdt.gradepro.org/app/",
    tags: ["gradepro", "grade", "summary of findings", "ferramenta"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TOOL",
    accessNote:
      "Ferramenta web disponibilizada para uso gratuito; criação de conta pode ser necessária para salvar projetos.",
  }),

  entry({
    title: "WHO handbook for guideline development, second edition",
    authors: "World Health Organization",
    year: 2014,
    kind: LibraryItemKind.GUIDE,
    category: "Diretrizes e decisão clínica",
    description:
      "Manual institucional sobre planejamento, síntese de evidência, avaliação GRADE, composição de painéis e recomendações da OMS.",
    doi: "10.2471/BLT.14.142810",
    url: "https://www.who.int/publications/i/item/9789241548960",
    tags: ["who", "diretriz", "grade", "desenvolvimento"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "2ª edição (2014); manual metodológico institucional",
    accessNote: "Publicação institucional disponível gratuitamente pela OMS.",
  }),
  entry({
    title: "WHO guidelines",
    authors: "World Health Organization",
    kind: LibraryItemKind.LINK,
    category: "Diretrizes e decisão clínica",
    description:
      "Repositório institucional de diretrizes da OMS; permite localizar versões, escopo e recomendações oficiais.",
    url: "https://www.who.int/publications/who-guidelines",
    tags: ["who", "guidelines", "diretrizes", "saúde pública"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TOOL",
    accessNote:
      "Consulta pública gratuita; verificar data, jurisdição e atualização de cada diretriz.",
  }),
  entry({
    title:
      "Handbook for Adapting and Implementing Evidence-Informed Guidelines",
    authors: "Pan American Health Organization; World Health Organization",
    year: 2023,
    kind: LibraryItemKind.GUIDE,
    category: "Diretrizes e decisão clínica",
    description:
      "Manual para adaptar e implementar diretrizes informadas por evidências em contextos regionais e de sistemas de saúde.",
    url: "https://www.who.int/publications/i/item/9789275127537",
    tags: ["opas", "who", "adaptação", "implementação de diretrizes"],
    language: "en/es/pt",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "2ª edição (2023)",
    accessNote:
      "Publicação institucional disponibilizada gratuitamente pela OPAS/OMS.",
  }),
  entry({
    title: "Shared decision making: NICE guideline NG197",
    authors: "National Institute for Health and Care Excellence (NICE)",
    year: 2021,
    kind: LibraryItemKind.GUIDE,
    category: "Diretrizes e decisão clínica",
    description:
      "Recomendações para decisões compartilhadas que integrem evidência, preferências, valores e circunstâncias da pessoa.",
    url: "https://www.nice.org.uk/guidance/ng197",
    tags: ["decisão compartilhada", "valores", "preferências", "guideline"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "NG197 (2021); conferir atualizações na página NICE",
  }),
  entry({
    title: "AGREE II: instrument for assessing practice guidelines",
    authors: "AGREE Next Steps Consortium; AGREE Enterprise",
    year: 2017,
    kind: LibraryItemKind.GUIDE,
    category: "Diretrizes e decisão clínica",
    description:
      "Instrumento de 23 itens para avaliar rigor, transparência, escopo, participação, aplicabilidade e apresentação de diretrizes.",
    url: "https://www.agreetrust.org/resource-centre/agree-ii/",
    tags: ["agree ii", "diretrizes", "avaliação", "qualidade"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version:
      "AGREE II; manual e instrumento disponibilizados no resource centre",
    accessNote:
      "Ferramenta de acesso gratuito; consultar termos do AGREE Enterprise para reprodução.",
  }),
  entry({
    title: "MAGICapp evidence ecosystem",
    authors: "MAGIC Evidence Ecosystem Foundation",
    kind: LibraryItemKind.LINK,
    category: "Diretrizes e decisão clínica",
    description:
      "Ecossistema digital público para localizar diretrizes, evidência e recomendações estruturadas e interativas.",
    url: "https://magicevidence.org/",
    tags: ["diretrizes", "evidência", "recomendação", "ferramenta"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Consulta de conteúdos públicos gratuita; alguns recursos de criação podem ter condições próprias.",
  }),

  entry({
    title: "PRISMA 2020: official statement, checklists and flow diagrams",
    authors: "PRISMA Executive; Page MJ; McKenzie JE; Bossuyt PM; et al.",
    year: 2021,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Portal oficial com checklist, checklist expandido, checklist de resumo, fluxogramas e instruções para PRISMA 2020.",
    url: "https://www.prisma-statement.org/prisma-2020",
    tags: ["prisma 2020", "checklist", "fluxograma", "revisão sistemática"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "PRISMA 2020",
    accessNote: "Checklists e diagramas oficiais para download gratuito.",
  }),
  entry({
    title: "PRISMA-S: reporting literature searches",
    authors:
      "PRISMA-S Group; Rethlefsen ML; Kirtley S; Waffenschmidt S; et al.",
    year: 2021,
    kind: LibraryItemKind.GUIDE,
    category: "Busca bibliográfica",
    description:
      "Extensão de 16 itens para documentar de forma reproduzível as buscas bibliográficas em revisões sistemáticas.",
    doi: "10.1186/s13643-020-01542-z",
    url: "https://www.prisma-statement.org/prisma-search",
    tags: ["prisma-s", "estratégia de busca", "reprodutibilidade", "checklist"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "PRISMA-S (2021); página e arquivos oficiais",
    accessNote:
      "Checklist oficial disponível gratuitamente em PDF, Word e Excel.",
  }),
  entry({
    title: "PRISMA-ScR: scoping review reporting guideline",
    authors: "Tricco AC; Lillie E; Zarin W; O'Brien KK; et al.",
    year: 2018,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Checklist e explicações para relato de revisões de escopo; não substitui diretrizes de condução metodológica.",
    doi: "10.7326/M18-0850",
    url: "https://www.prisma-statement.org/scoping",
    tags: ["prisma-scr", "revisão de escopo", "checklist"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "PRISMA-ScR (2018)",
    accessNote:
      "Checklist oficial disponível gratuitamente; artigo de explicação vinculado à página.",
  }),
  entry({
    title: "PRISMA-P: systematic review protocol checklist",
    authors: "Moher D; Shamseer L; Clarke M; Ghersi D; et al.; PRISMA-P Group",
    year: 2015,
    kind: LibraryItemKind.GUIDE,
    category: "Protocolos e registro",
    description:
      "Checklist para planejamento e relato de protocolos de revisões sistemáticas e meta-análises.",
    doi: "10.1186/2046-4053-4-1",
    url: "https://www.prisma-statement.org/protocols",
    tags: ["prisma-p", "protocolo", "revisão sistemática", "registro"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "PRISMA-P 2015",
    accessNote:
      "Checklist oficial gratuita, distribuída sob licença Creative Commons indicada pelo grupo.",
  }),
  entry({
    title: "CONSORT 2025: reporting randomized trials",
    authors: "CONSORT Group; Hopewell S; Chan AW; Collins GS; et al.",
    year: 2025,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Checklist atual de 30 itens e fluxograma para relato completo de ensaios randomizados; substitui CONSORT 2010 para novos relatos.",
    doi: "10.1136/bmj-2024-081123",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/11996237/",
    tags: ["consort 2025", "ensaio clínico", "randomização", "checklist"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "CONSORT 2025",
    accessNote:
      "Checklists, fluxograma e explicações disponíveis gratuitamente no site oficial.",
  }),
  entry({
    title: "SPIRIT 2025: reporting randomized trial protocols",
    authors: "SPIRIT Group; Chan AW; Boutron I; Hopewell S; et al.",
    year: 2025,
    kind: LibraryItemKind.GUIDE,
    category: "Protocolos e registro",
    description:
      "Checklist de 34 itens para conteúdo de protocolos de ensaios randomizados, alinhado à atualização CONSORT 2025.",
    doi: "10.1136/bmj-2024-081477",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/12035670/",
    tags: ["spirit 2025", "protocolo", "ensaio clínico", "checklist"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "SPIRIT 2025",
    accessNote:
      "Checklist e documentos oficiais gratuitos no site do grupo SPIRIT–CONSORT.",
  }),
  entry({
    title: "STROBE checklists for observational studies",
    authors: "STROBE Initiative",
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Checklists oficiais para relatos de estudos de coorte, caso-controle, transversais e resumos de conferência.",
    url: "https://www.strobe-statement.org/checklists/",
    tags: ["strobe", "observacional", "coorte", "caso-controle", "transversal"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "STROBE; consultar extensões e traduções no site oficial",
    accessNote:
      "Checklists oficiais disponíveis gratuitamente para consulta e download.",
  }),
  entry({
    title: "STROBE-Nut: reporting nutritional epidemiology studies",
    authors: "Lachat C; Hawwash D; Ocké MC; et al.; STROBE-nut Group",
    year: 2016,
    kind: LibraryItemKind.GUIDE,
    category: "Nutrição baseada em evidências",
    description:
      "Extensão de 24 recomendações à STROBE para desafios de mensuração, consumo, estado nutricional e epidemiologia nutricional.",
    doi: "10.1017/S1368980016001165",
    url: "https://strobe-nut.ugent.be/recommendations/",
    tags: ["strobe-nut", "nutrição", "epidemiologia nutricional", "relato"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "STROBE-nut (2016)",
    accessNote: "Recomendações e checklist oficiais disponíveis gratuitamente.",
  }),
  entry({
    title: "STARD 2015: reporting diagnostic accuracy studies",
    authors: "STARD Group; Bossuyt PM; Reitsma JB; Bruns DE; et al.",
    year: 2015,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Lista de itens essenciais para relatar estudos de acurácia diagnóstica com transparência e completude.",
    url: "https://www.equator-network.org/reporting-guidelines/stard/",
    tags: ["stard", "diagnóstico", "acurácia", "relato"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "STARD 2015",
    accessNote:
      "Página da diretriz e materiais associados gratuitos na EQUATOR Network.",
  }),
  entry({
    title: "TRIPOD+AI: reporting prediction model studies",
    authors: "Collins GS; Moons KGM; Dhiman P; et al.; TRIPOD+AI Group",
    year: 2024,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Diretriz atualizada de relato para estudos que desenvolvem ou avaliam modelos clínicos de predição com regressão ou aprendizado de máquina.",
    doi: "10.1136/bmj-2023-078378",
    url: "https://www.equator-network.org/reporting-guidelines/tripod-statement/",
    tags: [
      "tripod+ai",
      "modelo de predição",
      "inteligência artificial",
      "relato",
    ],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version:
      "TRIPOD+AI (2024); consultar a página EQUATOR para documentos vigentes",
    accessNote:
      "Diretriz e checklist disponíveis gratuitamente; artigo de explicação conforme licença indicada.",
  }),
  entry({
    title: "CARE guidelines for case reports",
    authors: "CARE Group; Gagnier JJ; Kienle G; Altman DG; et al.",
    year: 2013,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Checklist e orientações para relato completo de casos clínicos, evolução, intervenção e perspectiva do paciente.",
    url: "https://www.care-statement.org/checklist",
    tags: ["care", "relato de caso", "checklist"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TO_READ",
    version: "CARE guideline; verificar atualizações na página oficial",
    accessNote: "Checklist de acesso gratuito no site oficial.",
  }),
  entry({
    title: "COREQ: reporting qualitative research interviews and focus groups",
    authors: "Tong A; Sainsbury P; Craig J; COREQ Group",
    year: 2007,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Checklist de 32 itens para relato de entrevistas e grupos focais em pesquisa qualitativa.",
    doi: "10.1093/intqhc/mzm042",
    url: "https://www.equator-network.org/reporting-guidelines/coreq/",
    tags: ["coreq", "qualitativo", "entrevistas", "grupos focais"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "COREQ (2007)",
  }),
  entry({
    title: "SRQR: standards for reporting qualitative research",
    authors: "O'Brien BC; Harris IB; Beckman TJ; Reed DA; Cook DA",
    year: 2014,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Padrões de relato para estudos qualitativos que ajudam leitores a avaliar transparência, contexto e processo analítico.",
    doi: "10.1097/ACM.0000000000000388",
    url: "https://www.equator-network.org/reporting-guidelines/srqr/",
    tags: ["srqr", "qualitativo", "transparência", "relato"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "SRQR (2014)",
  }),
  entry({
    title: "ARRIVE guidelines 2.0 for animal research",
    authors: "Percie du Sert N; Hurst V; Ahluwalia A; et al.; ARRIVE Group",
    year: 2020,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Checklist Essential 10 e Recommended Set para planejar e relatar estudos com animais de forma transparente.",
    doi: "10.1371/journal.pbio.3000410",
    url: "https://arriveguidelines.org/arrive-guidelines",
    tags: ["arrive 2.0", "pesquisa animal", "relato", "checklist"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "OPEN_ACCESS",
    version: "ARRIVE 2.0",
  }),
  entry({
    title: "SQUIRE 2.0: reporting quality improvement in healthcare",
    authors: "Ogrinc G; Davies L; Goodman D; et al.; SQUIRE Group",
    year: 2016,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Diretriz de relato para estudos de melhoria da qualidade em saúde, incluindo contexto, intervenção e avaliação.",
    doi: "10.1136/bmjqs-2015-004411",
    url: "https://www.equator-network.org/reporting-guidelines/squire/",
    tags: ["squire", "melhoria da qualidade", "implementação"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "SQUIRE 2.0 (2015/2016)",
    accessNote:
      "Entrada oficial da EQUATOR Network com a diretriz e checklist SQUIRE 2.0; acesso gratuito.",
  }),
  entry({
    title: "CHEERS 2022: reporting health economic evaluations",
    authors: "Husereau D; Drummond M; Augustovski F; et al.; CHEERS 2022 Group",
    year: 2022,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Checklist atualizado de 28 itens para relato de avaliações econômicas em saúde.",
    doi: "10.1136/bmj-2021-067975",
    url: "https://www.equator-network.org/reporting-guidelines/cheers/",
    tags: ["cheers 2022", "avaliação econômica", "relato", "checklist"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version: "CHEERS 2022",
  }),
  entry({
    title: "EQUATOR Network Library of reporting guidelines",
    authors: "EQUATOR Network; University of Oxford",
    kind: LibraryItemKind.LINK,
    category: "Relato científico",
    description:
      "Biblioteca pesquisável para identificar diretrizes de relato por desenho, incluindo CONSORT, STROBE, PRISMA, SPIRIT, STARD e TRIPOD.",
    url: "https://www.equator-network.org/library/",
    tags: ["equator", "reporting guideline", "consort", "strobe", "prisma"],
    language: "en",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TOOL",
    accessNote:
      "Busca pública gratuita; cada diretriz mantém seus próprios termos de uso.",
  }),
  entry({
    title: "RIGHT statement for reporting practice guidelines",
    authors: "Chen Y; Yang K; Marušic A; et al.; RIGHT Working Group",
    year: 2017,
    kind: LibraryItemKind.GUIDE,
    category: "Relato científico",
    description:
      "Lista de verificação para melhorar o relato de diretrizes de prática clínica em saúde.",
    doi: "10.7326/M17-0856",
    url: "https://www.equator-network.org/reporting-guidelines/right-statement/",
    tags: ["right", "diretriz clínica", "relato", "checklist"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TO_READ",
    version: "RIGHT (2017)",
  }),
  entry({
    title: "EQUATOR guidance on developing reporting guidelines",
    authors: "EQUATOR Network",
    kind: LibraryItemKind.GUIDE,
    category: "Protocolos e registro",
    description:
      "Orientações metodológicas para desenvolver, validar, publicar e disseminar uma diretriz de relato em saúde.",
    url: "https://www.equator-network.org/toolkits/developing-a-reporting-guideline/",
    tags: ["equator", "desenvolvimento de guideline", "consenso", "métodos"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
  }),

  entry({
    title: "PROSPERO: International Prospective Register of Systematic Reviews",
    authors: "Centre for Reviews and Dissemination, University of York",
    kind: LibraryItemKind.LINK,
    category: "Protocolos e registro",
    description:
      "Registro prospectivo internacional para protocolos elegíveis de revisões relacionadas à saúde, reduzindo duplicação e relato seletivo.",
    url: "https://www.crd.york.ac.uk/PROSPERO/",
    tags: ["prospero", "registro", "protocolo", "revisão sistemática"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Consulta e registro sem cobrança; é necessário criar conta e cumprir critérios de elegibilidade.",
  }),
  entry({
    title: "OSF Registries and preregistration",
    authors: "Center for Open Science",
    kind: LibraryItemKind.LINK,
    category: "Ciência aberta e reprodutibilidade",
    description:
      "Plataforma para registrar protocolos e planos de análise antes dos resultados, com modelos e registros públicos.",
    url: "https://osf.io/registries/",
    tags: ["osf", "preregistro", "protocolo", "ciência aberta"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Registro e consulta públicos sem custo; recursos opcionais podem ter políticas próprias.",
  }),
  entry({
    title: "Open Science Framework (OSF)",
    authors: "Center for Open Science",
    kind: LibraryItemKind.LINK,
    category: "Ciência aberta e reprodutibilidade",
    description:
      "Infraestrutura para organizar projetos, compartilhar materiais, dados e código, e registrar etapas de pesquisa.",
    url: "https://osf.io/",
    tags: ["osf", "dados", "materiais", "reprodutibilidade"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Serviço central gratuito; armazenamento e integrações seguem os limites publicados pelo OSF.",
  }),
  entry({
    title: "TOP Guidelines: Transparency and Openness Promotion",
    authors: "Center for Open Science; TOP Factor team",
    kind: LibraryItemKind.GUIDE,
    category: "Ciência aberta e reprodutibilidade",
    description:
      "Padrões institucionais para políticas editoriais de transparência em citações, pré-registro, dados, materiais e código.",
    url: "https://www.cos.io/initiatives/top-guidelines",
    tags: ["top guidelines", "transparência", "dados", "código"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
  }),

  entry({
    title:
      "USDA Nutrition Evidence Systematic Review (NESR) Methodology Manual",
    authors: "USDA Nutrition Evidence Systematic Review Branch",
    year: 2023,
    kind: LibraryItemKind.GUIDE,
    category: "Nutrição baseada em evidências",
    description:
      "Manual protocolado para revisões sistemáticas, revisões rápidas e evidence scans de perguntas de alimentação e saúde.",
    url: "https://nesr.usda.gov/methodology-overview",
    tags: ["nesr", "usda", "nutrição", "revisão sistemática", "métodos"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version:
      "Manual de metodologia USDA NESR, fevereiro de 2023; verificar atualizações na página",
    accessNote:
      "Manual e materiais metodológicos públicos; a própria página disponibiliza o PDF.",
  }),
  entry({
    title: "USDA NESR protocols for nutrition evidence reviews",
    authors: "USDA Nutrition Evidence Systematic Review Branch",
    kind: LibraryItemKind.LINK,
    category: "Nutrição baseada em evidências",
    description:
      "Repositório de protocolos públicos de revisões, revisões rápidas e evidence scans sobre nutrição e saúde.",
    url: "https://nesr.usda.gov/protocols",
    tags: ["nesr", "protocolo", "nutrição", "transparência"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TOOL",
    accessNote:
      "Protocolos e status de projetos consultáveis gratuitamente na fonte oficial.",
  }),
  entry({
    title: "2025 Dietary Guidelines Advisory Committee systematic reviews",
    authors: "USDA Nutrition Evidence Systematic Review Branch; 2025 DGAC",
    year: 2025,
    kind: LibraryItemKind.LINK,
    category: "Nutrição baseada em evidências",
    description:
      "Coleção atual de revisões sistemáticas e evidence scans produzidos para apoiar o comitê consultivo de diretrizes alimentares dos EUA.",
    url: "https://nesr.usda.gov/",
    tags: ["nutrição", "diretriz", "revisão sistemática", "2025"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TOOL",
    accessNote:
      "Protocolos, revisões e métodos públicos; a página é atualizada pela equipe NESR.",
  }),
  entry({
    title:
      "Application of Systematic Review Methodology to the Field of Nutrition",
    authors:
      "AHRQ Evidence-based Practice Center; Tufts EPC; NIH Office of Dietary Supplements",
    year: 2009,
    kind: LibraryItemKind.PDF,
    category: "Nutrição baseada em evidências",
    description:
      "Revisão metodológica sobre desafios próprios de estudos de nutrição, como exposição basal, estado nutricional, bioequivalência e mensuração da ingestão.",
    url: "https://www.ahrq.gov/downloads/pub/evidence/pdf/nutrition/nutrtp1.pdf",
    tags: ["ahrq", "nutrição", "métodos", "revisão sistemática"],
    language: "en",
    difficulty: "ADVANCED",
    accessType: "FREE_TO_READ",
    version:
      "Nutritional Research Series, Volume 1 (2009); fonte institucional preservada",
    accessNote:
      "PDF público e gratuito da Agency for Healthcare Research and Quality.",
  }),
  entry({
    title: "NIH Office of Dietary Supplements: Evidence-Based Review Program",
    authors: "National Institutes of Health, Office of Dietary Supplements",
    kind: LibraryItemKind.LINK,
    category: "Nutrição baseada em evidências",
    description:
      "Portal de revisões sistemáticas sobre eficácia e segurança de suplementos alimentares e necessidades de pesquisa.",
    url: "https://ods.od.nih.gov/Research/Evidence-Based_Review_Program.aspx",
    tags: ["nih", "ods", "suplementos", "revisão sistemática"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "Relatórios e informações institucionais gratuitos; verificar escopo e data de cada revisão.",
  }),
  entry({
    title: "NIH ODS dietary supplement fact sheets",
    authors: "National Institutes of Health, Office of Dietary Supplements",
    kind: LibraryItemKind.LINK,
    category: "Nutrição baseada em evidências",
    description:
      "Fichas institucionais com resumo de evidência, segurança, interações e referências para suplementos alimentares.",
    url: "https://ods.od.nih.gov/factsheets/list-all/",
    tags: ["nih", "suplementos", "segurança", "fichas técnicas"],
    language: "en/es",
    difficulty: "INTRODUCTORY",
    accessType: "FREE_TOOL",
    accessNote:
      "Conteúdo informativo institucional gratuito; conferir público-alvo e data de revisão de cada ficha.",
  }),
  entry({
    title: "Cochrane Nutrition resources",
    authors: "Cochrane Nutrition",
    kind: LibraryItemKind.LINK,
    category: "Nutrição baseada em evidências",
    description:
      "Coleção temática da Cochrane sobre revisões, métodos e recursos relacionados a nutrição e saúde.",
    url: "https://nutrition.cochrane.org/resources",
    tags: ["cochrane", "nutrição", "revisão", "recursos"],
    language: "en",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    accessNote:
      "A página de recursos é gratuita; artigos e revisões vinculados podem ter condições de acesso próprias.",
  }),

  entry({
    title: "OpenEpi: Open Source Epidemiologic Statistics for Public Health",
    authors: "OpenEpi; Emory University; CDC collaborators",
    year: 2013,
    kind: LibraryItemKind.LINK,
    category: "Bioestatística e interpretação",
    description:
      "Calculadoras epidemiológicas para tabelas, medidas de associação, intervalos de confiança, tamanho amostral e poder.",
    url: "https://www.openepi.com/",
    tags: ["openepi", "calculadora", "epidemiologia", "intervalo de confiança"],
    language: "en/pt/es",
    difficulty: "INTERMEDIATE",
    accessType: "FREE_TOOL",
    version: "OpenEpi 3.01; conferir avisos e metodologia de cada calculadora",
    accessNote:
      "Software livre e gratuito; resultados exigem conferência das premissas e do método apropriado.",
  }),
];

export const libraryCatalogCategories = [
  "Fundamentos e perguntas clínicas",
  "Busca bibliográfica",
  "Epidemiologia e desenhos de estudo",
  "Bioestatística e interpretação",
  "Leitura crítica e risco de viés",
  "Revisões sistemáticas e meta-análises",
  "Certeza da evidência e GRADE",
  "Diretrizes e decisão clínica",
  "Diagnóstico e prognóstico",
  "Protocolos e registro",
  "Relato científico",
  "Nutrição baseada em evidências",
  "Ciência aberta e reprodutibilidade",
] as const;
