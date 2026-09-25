import { PrismaPg } from "@prisma/adapter-pg";
import {
  ContentStatus,
  LessonKind,
  LibraryItemKind,
  MemberRole,
  PrismaClient,
  ResourceKind,
} from "../generated/client";
import { databaseSsl } from "../ssl";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DIRECT_URL or DATABASE_URL is required to run the development seed."
  );
}

const adapter = new PrismaPg({
  connectionString,
  max: 1,
  ssl: databaseSsl,
});

const database = new PrismaClient({ adapter });

const richText = (heading: string, paragraphs: string[]) => ({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: heading }],
    },
    ...paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  ],
});

const seed = async () => {
  const staffId = process.env.SEED_STAFF_CLERK_USER_ID?.trim();
  const requestedRole = process.env.SEED_STAFF_ROLE?.trim();

  if (staffId) {
    const role = Object.values(MemberRole).includes(requestedRole as MemberRole)
      ? (requestedRole as MemberRole)
      : MemberRole.TEACHER;

    await database.member.upsert({
      where: { id: staffId },
      update: { role },
      create: { id: staffId, role },
    });

    await database.profile.upsert({
      where: { clerkUserId: staffId },
      update: { displayName: process.env.SEED_STAFF_DISPLAY_NAME ?? null },
      create: {
        clerkUserId: staffId,
        username:
          process.env.SEED_STAFF_USERNAME?.trim().toLowerCase() || "professor",
        displayName: process.env.SEED_STAFF_DISPLAY_NAME ?? null,
        interests: [],
      },
    });
  }

  const learningPath = await database.learningPath.upsert({
    where: { slug: "fundamentos-da-pbe" },
    update: {
      description:
        "Uma introdução estruturada à prática baseada em evidências.",
      position: 0,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
    create: {
      title: "Fundamentos da PBE",
      slug: "fundamentos-da-pbe",
      description:
        "Uma introdução estruturada à prática baseada em evidências.",
      position: 0,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  const course = await database.course.upsert({
    where: { slug: "introducao-a-pratica-baseada-em-evidencias" },
    update: {
      description:
        "Conheça os fundamentos para buscar, avaliar e aplicar evidências.",
      learningPathId: learningPath.id,
      position: 0,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
    create: {
      title: "Introdução à prática baseada em evidências",
      slug: "introducao-a-pratica-baseada-em-evidencias",
      description:
        "Conheça os fundamentos para buscar, avaliar e aplicar evidências.",
      learningPathId: learningPath.id,
      position: 0,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
      createdBy: "seed:development",
    },
  });

  const module = await database.module.upsert({
    where: {
      courseId_slug: {
        courseId: course.id,
        slug: "primeiros-conceitos",
      },
    },
    update: {
      position: 0,
      status: ContentStatus.PUBLISHED,
    },
    create: {
      title: "Primeiros conceitos",
      slug: "primeiros-conceitos",
      position: 0,
      status: ContentStatus.PUBLISHED,
      courseId: course.id,
    },
  });

  const lessons = [
    {
      slug: "o-que-e-pratica-baseada-em-evidencias",
      title: "O que é prática baseada em evidências?",
      description:
        "Uma visão inicial sobre a integração entre evidência, experiência e contexto.",
      position: 0,
      content: richText("Uma definição para começar", [
        "Prática baseada em evidências combina a melhor evidência disponível com a experiência profissional e os valores da pessoa atendida.",
        "O objetivo não é seguir uma receita pronta, mas tomar decisões mais conscientes, transparentes e justificáveis.",
      ]),
    },
    {
      slug: "perguntas-que-orientam-a-busca",
      title: "Perguntas que orientam a busca",
      description:
        "Como transformar uma dúvida ampla em uma pergunta que possa ser investigada.",
      position: 1,
      content: richText("Da dúvida à pergunta", [
        "Uma boa pergunta delimita a população, a intervenção ou exposição, a comparação e o desfecho que queremos compreender.",
        "Começar pela pergunta ajuda a evitar buscas dispersas e torna explícito o raciocínio por trás da decisão.",
      ]),
    },
  ];

  for (const lesson of lessons) {
    const savedLesson = await database.lesson.upsert({
      where: {
        moduleId_slug: {
          moduleId: module.id,
          slug: lesson.slug,
        },
      },
      update: {
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        kind: LessonKind.TEXT,
        position: lesson.position,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      create: {
        title: lesson.title,
        slug: lesson.slug,
        description: lesson.description,
        content: lesson.content,
        kind: LessonKind.TEXT,
        position: lesson.position,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        moduleId: module.id,
        createdBy: "seed:development",
      },
    });

    await database.lessonResource.upsert({
      where: {
        lessonId_position: {
          lessonId: savedLesson.id,
          position: 0,
        },
      },
      update: {
        title: "Guia de leitura complementar",
        kind: ResourceKind.RECOMMENDED_READING,
        url: "https://www.cebm.ox.ac.uk/resources/ebm-tools",
      },
      create: {
        title: "Guia de leitura complementar",
        kind: ResourceKind.RECOMMENDED_READING,
        url: "https://www.cebm.ox.ac.uk/resources/ebm-tools",
        position: 0,
        lessonId: savedLesson.id,
      },
    });
  }

  if (process.env.SEED_DEVELOPMENT_DATA === "true") {
    const activity = await database.activity.upsert({
      where: { slug: "mapa-da-duvida" },
      update: {
        title: "Mapa da dúvida",
        prompt:
          "Escolha uma decisão da sua prática e escreva o que você ainda não consegue responder com segurança.",
        instructions:
          "Nomeie o contexto, a população envolvida e a evidência que você gostaria de encontrar.",
        status: ContentStatus.PUBLISHED,
      },
      create: {
        title: "Mapa da dúvida",
        slug: "mapa-da-duvida",
        prompt:
          "Escolha uma decisão da sua prática e escreva o que você ainda não consegue responder com segurança.",
        instructions:
          "Nomeie o contexto, a população envolvida e a evidência que você gostaria de encontrar.",
        status: ContentStatus.PUBLISHED,
        createdBy: "seed:development",
      },
    });

    const space = await database.communitySpace.upsert({
      where: { slug: "perguntas-de-metodo" },
      update: {
        title: "Perguntas de método",
        description:
          "Uma mesa para tornar dúvidas metodológicas mais nítidas, sem pressa de encerrá-las.",
        status: ContentStatus.PUBLISHED,
      },
      create: {
        title: "Perguntas de método",
        slug: "perguntas-de-metodo",
        description:
          "Uma mesa para tornar dúvidas metodológicas mais nítidas, sem pressa de encerrá-las.",
        status: ContentStatus.PUBLISHED,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const existingPost = await database.communityPost.findFirst({
      where: {
        spaceId: space.id,
        authorId: "seed:development",
        title: "Como começar uma pergunta clínica?",
      },
      select: { id: true },
    });

    if (!existingPost) {
      await database.communityPost.create({
        data: {
          spaceId: space.id,
          authorId: "seed:development",
          title: "Como começar uma pergunta clínica?",
          content:
            "Tenho uma dúvida ampla e quero transformá-la em uma pergunta investigável. Que parte vocês costumam delimitar primeiro?",
          status: ContentStatus.PUBLISHED,
        },
      });
    }

    const existingMeeting = await database.meeting.findFirst({
      where: { title: "Roda de perguntas sobre evidência" },
      select: { id: true },
    });

    if (!existingMeeting) {
      await database.meeting.create({
        data: {
          title: "Roda de perguntas sobre evidência",
          description:
            "Um encontro de estudo para trazer uma dúvida, testar uma pergunta e ouvir outras leituras.",
          startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          timezone: "America/Sao_Paulo",
          joinUrl: "https://example.com/interprete-development-meeting",
          status: ContentStatus.PUBLISHED,
          teacherId: "seed:development",
        },
      });
    }

    const existingLibraryItem = await database.libraryItem.findFirst({
      where: { title: "Ferramentas para prática baseada em evidências" },
      select: { id: true },
    });

    if (!existingLibraryItem) {
      await database.libraryItem.create({
        data: {
          title: "Ferramentas para prática baseada em evidências",
          description:
            "Uma referência introdutória para organizar perguntas, buscas e leituras.",
          kind: LibraryItemKind.GUIDE,
          category: "Fundamentos",
          tags: ["pbe", "método", "leitura"],
          url: "https://www.cebm.ox.ac.uk/resources/ebm-tools",
          status: ContentStatus.PUBLISHED,
          createdBy: "seed:development",
          updatedBy: "seed:development",
        },
      });
    }

    console.log(
      `Development product fixtures ready: ${activity.slug} / ${space.slug}`
    );
  }

  console.log(
    `Development learning seed ready: ${learningPath.slug} / ${course.slug}`
  );
};

try {
  await seed();
} finally {
  await database.$disconnect();
}
