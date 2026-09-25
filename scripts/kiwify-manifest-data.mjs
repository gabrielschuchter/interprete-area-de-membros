export const course = {
  sourcePlatform: "KIWIFY",
  sourceId: "7ad00734-231d-40a2-b512-c61b18f2e0a8",
  title: "Mentoria Interprete.",
  slug: "mentoria-interprete",
};

const module = (title, lessons, studentSourceId) => ({
  sourceId: `module:${studentSourceId}`,
  title,
  slug: `gravacoes-${studentSourceId}`,
  studentSourceId,
  lessons: lessons.map((title, position) => ({
    sourceId: `lesson:${studentSourceId}:${position + 1}`,
    title,
    position,
    assetInventory: { video: "UNVERIFIED", attachments: "UNVERIFIED" },
  })),
});

export const modules = [
  module(
    "Gravações de Mentoria - Júlia",
    [
      "Mentoria 29/10",
      "Mentoria 05/11",
      "Mentoria 12/11",
      "Mentoria 20/11",
      "Mentoria 03/12",
      "Mentoria 09/12",
      "Mentoria 15/12",
      "Mentoria 19/12",
      "Mentoria 06/01",
      "Mentoria 13/01",
      "Artigo/Mentoria 15/01",
      "Mentoria 26/01",
      "Mentoria 03/02",
      "Mentoria 12/02",
      "Mentoria 03/03",
      "Mentoria 10/03",
      "Mentoria 24/03",
      "Mentoria 02/04",
      "Mentoria 14/04",
      "Mentoria 23/04",
    ],
    "julia-vitoria"
  ),
  module(
    "Gravações de Mentoria - Poliana",
    [
      "Mentoria 08/11",
      "Mentoria 15/11",
      "Mentoria 11/12",
      "Mentoria 19/12",
      "Mentoria 23/01",
      "Mentoria 30/01",
      "Mentoria 05/02",
      "Mentoria 15/02",
      "Mentoria 28/02",
      "Mentoria 08/03",
      "Mentoria 18/03",
      "Mentoria 15/04",
      "Mentoria 24/04",
      "Mentoria 07/05",
      "Mentoria 15/05",
      "Mentoria 03/06",
    ],
    "poliana-paes"
  ),
  module(
    "Gravações de Mentoria - Katia",
    [
      "Mentoria 09/01",
      "Mentoria 16/01",
      "Mentoria 24/01",
      "Mentoria 31/01",
      "Mentoria 14/02",
      "Mentoria 21/02",
      "Mentoria 07/03",
      "Mentoria 14/03",
      "Atendimento 15/03",
      "Mentoria 21/03",
      "Atendimento 29/03",
      "Mentoria 30/03",
      "Mentoria 03/04",
      "Mentoria 12/04",
      "Mentoria 31/05",
      "Mentoria 07/06",
    ],
    "katia-paschoalino"
  ),
  module(
    "Gravações de Mentoria - Camila",
    [
      "Mentoria 13/01",
      "Mentoria 20/01",
      "Mentoria 27/01",
      "Mentoria 05/02",
      "Mentoria 19/02",
      "Mentoria 02/03",
      "Mentoria 10/03",
      "Mentoria 16/03",
      "Mentoria 27/03",
      "Atendimento 02/04",
      "Mentoria 07/04",
      "Mentoria 24/04",
      "Mentoria 08/05",
      "Mentoria 14/05",
      "Mentoria 28/05",
    ],
    "camila-ramos"
  ),
  module(
    "Gravações de Mentoria - Manuela",
    [
      "Mentoria 19/01",
      "Mentoria 20/01",
      "Mentoria 30/01",
      "Mentoria 06/02",
      "Mentoria 12/02",
      "Mentoria 23/02",
      "Mentoria 03/03",
      "Mentoria 16/03",
      "Mentoria 13/04",
      "Mentoria 08/05",
      "Mentoria 14/05",
      "Mentoria 25/05",
      "Mentoria 01/06",
    ],
    "manuela-morgado"
  ),
  module(
    "Gravações de Mentoria - Ana Paula",
    [
      "Mentoria 26/02",
      "Mentoria 12/03",
      "Mentoria 19/03",
      "Mentoria 01/04",
      "Mentoria 02/04",
      "Mentoria 09/04",
      "Mentoria 16/04",
      "Mentoria 23/04",
      "Mentoria 12/05",
    ],
    "ana-paula"
  ),
  module(
    "Gravações de Mentoria - André",
    [
      "Mentoria 23/03",
      "Mentoria 02/04",
      "Mentoria 11/04",
      "Mentoria 22/04",
      "Mentoria 13/05",
      "Mentoria 05/06",
    ],
    "andre-fonseca"
  ),
  module(
    "Gravações de Mentoria - Marcella",
    ["Mentoria 04/06"],
    "marcella-costa"
  ),
  module("Gravações de Mentoria - Lara", ["Mentoria 03/06"], "lara-vitoria"),
  module("Gravações de Mentoria - Yorika", ["Mentoria 07/08"], "yorika"),
  module("Gravações de Mentoria - Gláucia", [], "glaucia-goncalves"),
  module("Gravações de Mentoria - Francisco", [], "francisco"),
  module("Gravações de Mentoria - Leonardo", [], "leonardo-iabrudi"),
  module(
    "Gravações de Mentoria - Vitória",
    ["Mentoria 03/06"],
    "vitoria-quintanilha"
  ),
];

export const students = [
  {
    sourceId: "andre-fonseca",
    displayName: "André Fonseca Garcia",
    email: null,
    notes:
      "O endereço apareceu truncado na interface administrativa da Kiwify; não associar automaticamente.",
  },
  {
    sourceId: "manuela-morgado",
    displayName: "Manuela Morgado Melloni",
    email: "manuela19092005@gmail.com",
  },
  {
    sourceId: "glaucia-goncalves",
    displayName: "Glaucia Gonçalves",
    email: "glau2078@gmail.com",
  },
  {
    sourceId: "lara-vitoria",
    displayName: "Lara Vitória de Sousa Alves Guimarães",
    email: "laravitguimma@gmail.com",
  },
  {
    sourceId: "leonardo-iabrudi",
    displayName: "Leonardo Iabrudi Juste",
    email: "lijuste@gmail.com",
  },
  {
    sourceId: "vitoria-quintanilha",
    displayName: "Vitória Quintanilha",
    email: "vitoriaquintanilha03@gmail.com",
  },
  {
    sourceId: "camila-ramos",
    displayName: "Camila Ramos Borges",
    email: "ramosborgescamila@gmail.com",
  },
  {
    sourceId: "marcella-costa",
    displayName: "Marcella Costa Naves",
    email: "marcellanavesc@gmail.com",
  },
  {
    sourceId: "poliana-paes",
    displayName: "Poliana Paes de Souza",
    email: "polly-paes08@hotmail.com",
  },
  {
    sourceId: "ana-paula",
    displayName: "Ana Paula",
    email: null,
    notes:
      "A linha apareceu sem nome na exportação visual; o e-mail foi mantido fora do matching automático.",
  },
  {
    sourceId: "lucas-raphael",
    displayName: "Lucas Raphael Carvalho Lopes",
    email: "lucas.rc.lopes27@gmail.com",
  },
  {
    sourceId: "katia-paschoalino",
    displayName: "Katia Paschoalino Lucas do Nascimento",
    email: "paschoalinokatia70@gmail.com",
  },
  {
    sourceId: "gabriel-schuchter",
    displayName: "Gabriel Schuchter",
    email: "schuchtergabriel@gmail.com",
  },
  {
    sourceId: "julia-vitoria",
    displayName: "Julia Vitoria",
    email: "contatojuliavitoria.g@gmail.com",
  },
  {
    sourceId: "yorika",
    displayName: "Yorika",
    email: null,
    notes:
      "Módulo encontrado na árvore de conteúdo, mas a pessoa não apareceu na lista de alunos observada.",
  },
  {
    sourceId: "francisco",
    displayName: "Francisco",
    email: null,
    notes:
      "Módulo vazio encontrado na árvore de conteúdo; aluno não confirmado.",
  },
];

export const manifest = {
  version: 1,
  capturedAt: "2026-09-25",
  source: {
    platform: "KIWIFY",
    clubId: "fcfa85f4-ee5b-4659-87d2-c6a9abf33350",
    courseId: course.sourceId,
    courseTitle: course.title,
  },
  course,
  modules,
  students,
  inventory: {
    courses: 1,
    modules: modules.length,
    lessons: modules.reduce((total, item) => total + item.lessons.length, 0),
    videos: null,
    attachments: null,
  },
};
