/**
 * Grupos de categoria da Biblioteca, na ordem em que aparecem para o aluno. O
 * banco guarda a categoria que a equipe digitou em cada material; o aluno
 * filtra por estes grupos, que juntam sinônimos antigos ("Evidence-Based
 * Nutrition" e "Nutrição baseada em evidências"). Categoria nova que não
 * esteja aqui aparece como grupo próprio até ser mapeada.
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
    label: "Busca da evidência",
    aliases: ["Busca da evidência", "Busca bibliográfica"],
  },
  {
    label: "Registros de protocolo",
    aliases: ["Registros de protocolo", "Protocolos e registro"],
  },
  {
    label: "Revisões sistemáticas",
    aliases: ["Revisões sistemáticas", "Revisões sistemáticas e meta-análises"],
  },
  {
    label: "Leitura crítica e certeza da evidência",
    aliases: [
      "Leitura crítica e certeza da evidência",
      "Leitura crítica e risco de viés",
      "Certeza da evidência e GRADE",
      "GRADE",
    ],
  },
  {
    label: "Risco de viés",
    aliases: ["Risco de viés"],
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
    label: "Epidemiologia e desenhos de estudo",
    aliases: [
      "Epidemiologia e desenhos de estudo",
      "Epidemiologia clínica",
      "Causalidade",
      "Diagnóstico e prognóstico",
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
  {
    label: "Bioestatística e interpretação",
    aliases: ["Bioestatística e interpretação", "Bioestatística"],
  },
] as const;

/**
 * Categorias gravadas que valem para mais de um grupo: o material aparece no
 * filtro de cada grupo listado, na ordem dada (o primeiro é o principal).
 */
export const LIBRARY_COMBINED_CATEGORIES = [
  {
    label: "Revisões sistemáticas e busca",
    members: ["Revisões sistemáticas", "Busca da evidência"],
  },
  {
    label: "Fundamentos da PBE e busca",
    members: ["Fundamentos da PBE", "Busca da evidência"],
  },
  {
    label: "Leitura crítica e certeza da evidência e risco de viés",
    members: ["Leitura crítica e certeza da evidência", "Risco de viés"],
  },
  {
    label: "Leitura crítica e certeza da evidência e revisão sistemática",
    members: [
      "Leitura crítica e certeza da evidência",
      "Revisões sistemáticas",
    ],
  },
  {
    label:
      "Leitura crítica e certeza da evidência e risco de viés e revisão sistemática",
    members: [
      "Leitura crítica e certeza da evidência",
      "Risco de viés",
      "Revisões sistemáticas",
    ],
  },
  {
    label: "Revisões sistemáticas e risco de viés",
    members: ["Revisões sistemáticas", "Risco de viés"],
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

const membersByCombined = new Map<string, readonly string[]>(
  LIBRARY_COMBINED_CATEGORIES.map(
    ({ label, members }) => [normalize(label), members] as const
  )
);

/** Todos os grupos de uma categoria gravada (vários, se for combinada). */
export const libraryCategoryGroups = (category: string): readonly string[] =>
  membersByCombined.get(normalize(category)) ?? [
    groupByAlias.get(normalize(category)) ?? category.trim(),
  ];

/** O grupo principal de uma categoria gravada; sem mapeamento, ela mesma. */
export const libraryCategoryGroup = (category: string) =>
  libraryCategoryGroups(category)[0] ?? category.trim();

/**
 * Grupos presentes entre as categorias publicadas, na ordem editorial e sem
 * repetição. Grupos não mapeados vêm depois, em ordem alfabética.
 */
export const libraryCategoryGroupsFor = (categories: readonly string[]) => {
  const present = new Set(categories.flatMap(libraryCategoryGroups));
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
  return categories.filter((category) =>
    libraryCategoryGroups(category).includes(target)
  );
};

/**
 * Valores para filtrar `category in (...)` sem consultar o banco antes: os
 * apelidos do grupo e as categorias combinadas que o incluem, ou a própria
 * categoria quando ela não tem grupo.
 */
export const libraryCategoryFilterValues = (selected: string) => {
  const group = libraryCategoryGroup(selected);
  const known = LIBRARY_CATEGORY_GROUPS.find(({ label }) => label === group);
  if (!known) {
    return [selected.trim()];
  }
  const combined = LIBRARY_COMBINED_CATEGORIES.filter(({ members }) =>
    (members as readonly string[]).includes(group)
  ).map(({ label }) => label);
  return [...known.aliases, ...combined];
};
