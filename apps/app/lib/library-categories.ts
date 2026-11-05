/**
 * Grandes grupos de categoria da Biblioteca. O banco guarda a categoria que a
 * equipe digitou em cada material; o aluno filtra por estes grupos, que juntam
 * sinônimos e duplicatas ("Evidence-Based Nutrition" e "Nutrição baseada em
 * evidências", "GRADE" e "Certeza da evidência e GRADE"). Categoria nova que
 * não esteja aqui aparece como grupo próprio até ser mapeada.
 */
export const LIBRARY_CATEGORY_GROUPS = [
  {
    label: "Fundamentos da PBE",
    aliases: [
      "Fundamentos da PBE",
      "Fundamentos de EBM",
      "Fundamentos e perguntas clínicas",
    ],
  },
  {
    label: "Epidemiologia e desenhos de estudo",
    aliases: [
      "Epidemiologia e desenhos de estudo",
      "Epidemiologia clínica",
      "Causalidade",
      "Diagnóstico e prognóstico",
    ],
  },
  {
    label: "Bioestatística e interpretação",
    aliases: ["Bioestatística e interpretação", "Bioestatística"],
  },
  {
    label: "Leitura crítica e certeza da evidência",
    aliases: [
      "Leitura crítica e certeza da evidência",
      "Leitura crítica e risco de viés",
      "Risco de viés",
      "Certeza da evidência e GRADE",
      "GRADE",
    ],
  },
  {
    label: "Revisões sistemáticas e busca",
    aliases: [
      "Revisões sistemáticas e busca",
      "Revisões sistemáticas",
      "Revisões sistemáticas e meta-análises",
      "Busca bibliográfica",
      "Protocolos e registro",
    ],
  },
  {
    label: "Relato e ciência aberta",
    aliases: [
      "Relato e ciência aberta",
      "Relato científico",
      "Reporting guidelines",
      "Ciência aberta e reprodutibilidade",
    ],
  },
  {
    label: "Diretrizes e decisão clínica",
    aliases: ["Diretrizes e decisão clínica"],
  },
  {
    label: "Nutrição baseada em evidências",
    aliases: ["Nutrição baseada em evidências", "Evidence-Based Nutrition"],
  },
] as const;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

const groupByAlias = new Map<string, string>(
  LIBRARY_CATEGORY_GROUPS.flatMap(({ aliases, label }) =>
    aliases.map((alias) => [normalize(alias), label] as const)
  )
);

/** O grupo de uma categoria gravada; sem mapeamento, a própria categoria. */
export const libraryCategoryGroup = (category: string) =>
  groupByAlias.get(normalize(category)) ?? category.trim();

/**
 * Grupos presentes entre as categorias publicadas, na ordem editorial e sem
 * repetição. Grupos não mapeados vêm depois, em ordem alfabética.
 */
export const libraryCategoryGroupsFor = (categories: readonly string[]) => {
  const present = new Set(categories.map(libraryCategoryGroup));
  const known = LIBRARY_CATEGORY_GROUPS.map(({ label }) => label).filter(
    (label) => present.has(label)
  );
  const knownSet = new Set<string>(known);
  const unknown = [...present]
    .filter((label) => !knownSet.has(label))
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
  return [...known, ...unknown];
};

/** Categorias gravadas que pertencem ao grupo, para o filtro `in`. */
export const libraryCategoriesInGroup = (
  group: string,
  categories: readonly string[]
) => {
  const target = libraryCategoryGroup(group);
  return categories.filter(
    (category) => libraryCategoryGroup(category) === target
  );
};

/**
 * Valores para filtrar `category in (...)` sem consultar o banco antes: os
 * apelidos do grupo, ou a própria categoria quando ela não tem grupo.
 */
export const libraryCategoryFilterValues = (selected: string) => {
  const group = libraryCategoryGroup(selected);
  const known = LIBRARY_CATEGORY_GROUPS.find(({ label }) => label === group);
  return known ? [...known.aliases] : [selected.trim()];
};
