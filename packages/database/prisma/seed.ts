import { PrismaPg } from "@prisma/adapter-pg";
import {
  ActivityDeliveryKind,
  ActivitySubmissionStatus,
  ContentStatus,
  LessonKind,
  LibraryItemKind,
  MeetingKind,
  MemberRole,
  PrismaClient,
  ResourceKind,
} from "../generated/client";
import { databaseSsl, normalizeRuntimeDatabaseUrl } from "../ssl";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DIRECT_URL or DATABASE_URL is required to run the development seed."
  );
}

const adapter = new PrismaPg({
  connectionString: normalizeRuntimeDatabaseUrl(connectionString),
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this idempotent fixture seeder deliberately coordinates the related learning, community, activity, library, and meeting records in one transaction flow.
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
      description:
        "Uma sequência para transformar dúvidas em perguntas investigáveis.",
      objectives: [
        "Delimitar uma pergunta de prática baseada em evidências.",
        "Reconhecer os elementos de uma pergunta clínica.",
      ],
      position: 0,
      status: ContentStatus.PUBLISHED,
    },
    create: {
      title: "Primeiros conceitos",
      slug: "primeiros-conceitos",
      description:
        "Uma sequência para transformar dúvidas em perguntas investigáveis.",
      objectives: [
        "Delimitar uma pergunta de prática baseada em evidências.",
        "Reconhecer os elementos de uma pergunta clínica.",
      ],
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
        objectives: [
          "Identificar a decisão que precisa ser esclarecida.",
          "Relacionar contexto, evidência e aplicabilidade.",
        ],
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
        objectives: [
          "Identificar a decisão que precisa ser esclarecida.",
          "Relacionar contexto, evidência e aplicabilidade.",
        ],
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
    const demoMember = await database.member.findFirst({
      where: {
        OR: [
          {
            email: {
              equals: "schuchtergabriel@gmail.com",
              mode: "insensitive",
            },
          },
          ...(staffId ? [{ id: staffId }] : []),
        ],
      },
      select: { id: true },
    });
    const actorId = demoMember?.id ?? staffId ?? "seed:development";
    const teacherId = staffId ?? actorId;

    const libraryReferences = [
      {
        title: "Evidence based medicine: what it is and what it isn't",
        authors:
          "Sackett DL; Rosenberg WMC; Gray JAM; Haynes RB; Richardson WS",
        year: 1996,
        kind: LibraryItemKind.ARTICLE,
        category: "Fundamentos de EBM",
        description:
          "Texto clássico que apresenta a ideia de integrar melhor evidência disponível, experiência clínica e valores da pessoa atendida.",
        doi: "10.1136/bmj.312.7023.71",
        url: "https://www.bmj.com/content/312/7023/71",
        tags: ["ebm", "fundamentos", "sackett"],
      },
      {
        title: "Cochrane Handbook for Systematic Reviews of Interventions",
        authors:
          "Higgins JPT; Thomas J; Chandler J; Cumpston M; Li T; Page MJ; Welch VA",
        year: 2024,
        kind: LibraryItemKind.GUIDE,
        category: "Revisões sistemáticas",
        description:
          "Manual oficial para planejamento, condução e interpretação de revisões sistemáticas de intervenções.",
        url: "https://training.cochrane.org/handbook/current",
        tags: ["cochrane", "revisão sistemática", "meta-análise"],
      },
      {
        title:
          "GRADE: an emerging consensus on rating quality of evidence and strength of recommendations",
        authors:
          "Atkins D; Best D; Briss PA; Eccles M; Falck-Ytter Y; Flottorp S; et al.",
        year: 2004,
        kind: LibraryItemKind.ARTICLE,
        category: "GRADE",
        description:
          "Artigo fundador do grupo GRADE sobre avaliação da certeza da evidência e força das recomendações.",
        doi: "10.1136/bmj.328.7454.1490",
        url: "https://www.bmj.com/content/328/7454/1490",
        tags: ["grade", "certeza", "recomendação"],
      },
      {
        title:
          "CONSORT 2010 Statement: updated guidelines for reporting parallel group randomised trials",
        authors: "Schulz KF; Altman DG; Moher D; CONSORT Group",
        year: 2010,
        kind: LibraryItemKind.GUIDE,
        category: "Reporting guidelines",
        description:
          "Checklist e fluxograma para relato transparente de ensaios clínicos randomizados em grupos paralelos.",
        doi: "10.1136/bmj.c332",
        url: "https://www.bmj.com/content/340/bmj.c332",
        tags: ["consort", "ensaio clínico", "relato"],
      },
      {
        title:
          "The PRISMA 2020 statement: an updated guideline for reporting systematic reviews",
        authors:
          "Page MJ; McKenzie JE; Bossuyt PM; Boutron I; Hoffmann TC; Mulrow CD; et al.",
        year: 2021,
        kind: LibraryItemKind.GUIDE,
        category: "Reporting guidelines",
        description:
          "Diretriz atualizada para relato de revisões sistemáticas e meta-análises.",
        doi: "10.1136/bmj.n71",
        url: "https://www.bmj.com/content/372/bmj.n71",
        tags: ["prisma", "revisão sistemática", "relato"],
      },
      {
        title:
          "The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) statement",
        authors:
          "von Elm E; Altman DG; Egger M; Pocock SJ; Gøtzsche PC; Vandenbroucke JP; STROBE Initiative",
        year: 2007,
        kind: LibraryItemKind.GUIDE,
        category: "Epidemiologia clínica",
        description:
          "Recomendação para melhorar o relato de estudos observacionais de coorte, caso-controle e transversais.",
        doi: "10.1016/S0140-6736(07)61602-X",
        url: "https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(07)61602-X/fulltext",
        tags: ["strobe", "observacional", "epidemiologia"],
      },
      {
        title:
          "RoB 2: a revised tool for assessing risk of bias in randomised trials",
        authors:
          "Sterne JAC; Savović J; Page MJ; Elbers RG; Blencowe NS; Boutron I; et al.",
        year: 2019,
        kind: LibraryItemKind.GUIDE,
        category: "Risco de viés",
        description:
          "Ferramenta revisada para avaliar risco de viés em ensaios clínicos randomizados.",
        doi: "10.1136/bmj.l4898",
        url: "https://www.bmj.com/content/366/bmj.l4898",
        tags: ["rob2", "risco de viés", "ensaio clínico"],
      },
      {
        title:
          "Evidence-based nutrition: the importance of the evidence hierarchy",
        authors: "Dinu M; Pagliai G; Casini A; Sofi F",
        year: 2022,
        kind: LibraryItemKind.ARTICLE,
        category: "Evidence-Based Nutrition",
        description:
          "Discussão sobre hierarquia da evidência e sua aplicação à avaliação de intervenções nutricionais.",
        doi: "10.1093/advances/nmab147",
        url: "https://pubmed.ncbi.nlm.nih.gov/34918032/",
        tags: ["nutrição", "ebn", "hierarquia"],
      },
      {
        title: "Causal Inference: What If",
        authors: "Hernán MA; Robins JM",
        year: 2020,
        kind: LibraryItemKind.GUIDE,
        category: "Causalidade",
        description:
          "Livro aberto dos autores sobre inferência causal, diagramas e desenho de estudos.",
        url: "https://www.hsph.harvard.edu/miguel-hernan/causal-inference-book/",
        tags: ["causalidade", "epidemiologia", "livro aberto"],
      },
      {
        title: "Evidence-Based Medicine Tools",
        authors: "Centre for Evidence-Based Medicine, University of Oxford",
        kind: LibraryItemKind.GUIDE,
        category: "Fundamentos de EBM",
        description:
          "Coleção institucional de ferramentas para formular perguntas, buscar evidências e praticar EBM.",
        url: "https://www.cebm.ox.ac.uk/resources/ebm-tools",
        tags: ["ebm", "ferramentas", "oxford"],
      },
    ];

    const libraryItems = new Map<string, { id: string }>();
    for (const reference of libraryReferences) {
      const current = await database.libraryItem.findFirst({
        where: { url: reference.url },
        select: { id: true },
      });
      const item = current
        ? await database.libraryItem.update({
            where: { id: current.id },
            data: {
              ...reference,
              status: ContentStatus.PUBLISHED,
              updatedBy: actorId,
            },
            select: { id: true },
          })
        : await database.libraryItem.create({
            data: {
              ...reference,
              status: ContentStatus.PUBLISHED,
              createdBy: actorId,
              updatedBy: actorId,
            },
            select: { id: true },
          });
      libraryItems.set(reference.title, item);
    }

    const activityDefinitions = [
      {
        slug: "formule-uma-pergunta-clinica-estruturada",
        title: "Formule uma pergunta clínica estruturada",
        prompt:
          "Escolha uma dúvida da sua prática ou área de interesse e transforme-a em uma pergunta estruturada utilizando PICO ou outro framework adequado.",
        instructions:
          "Indique população, intervenção ou exposição, comparação e desfecho. Explique por que essa pergunta importa.",
        deliveryKind: ActivityDeliveryKind.TEXT,
        libraryTitle: "Evidence-Based Medicine Tools",
        dueDays: 5,
      },
      {
        slug: "leitura-critica-de-um-ensaio-clinico",
        title: "Leitura crítica de um ensaio clínico",
        prompt:
          "Leia o artigo indicado e registre três pontos que podem alterar sua confiança nos resultados.",
        instructions:
          "Observe desenho, perdas, análise e aplicabilidade. Você pode escrever ou anexar uma anotação.",
        deliveryKind: ActivityDeliveryKind.TEXT_AND_FILE,
        libraryTitle:
          "CONSORT 2010 Statement: updated guidelines for reporting parallel group randomised trials",
        dueDays: 14,
      },
      {
        slug: "interprete-o-intervalo-de-confianca",
        title: "Interprete o intervalo de confiança",
        prompt:
          "Uma intervenção produziu diferença média de -2,4 pontos (IC 95% -4,8 a 0,1). Como você interpreta esse intervalo para uma decisão clínica?",
        instructions:
          "Escreva uma interpretação curta distinguindo precisão, compatibilidade dos efeitos e relevância clínica.",
        deliveryKind: ActivityDeliveryKind.TEXT,
        libraryTitle: undefined,
        dueDays: -2,
      },
      {
        slug: "mapa-da-duvida",
        title: "Mapa da dúvida",
        prompt:
          "Escolha uma decisão da sua prática e escreva o que você ainda não consegue responder com segurança.",
        instructions:
          "Nomeie o contexto, a população envolvida e a evidência que você gostaria de encontrar.",
        // Deliberately overdue and without a submission so the member area
        // exercises the overdue state in the development/demo fixture.
        deliveryKind: ActivityDeliveryKind.TEXT,
        libraryTitle: "Causal Inference: What If",
        dueDays: -4,
      },
      {
        slug: "tres-pontos-de-risco-de-vies",
        title: "Três pontos de risco de viés",
        prompt:
          "Escolha um estudo que você conhece e identifique três pontos que podem reduzir a confiança nos seus resultados.",
        instructions:
          "Relacione cada ponto ao tipo de viés e ao efeito que ele pode produzir na interpretação.",
        deliveryKind: ActivityDeliveryKind.TEXT_AND_FILE,
        libraryTitle:
          "RoB 2: a revised tool for assessing risk of bias in randomised trials",
        dueDays: -7,
      },
    ];
    const demoActivities: Array<{
      id: string;
      slug: string;
      dueAt: Date | null;
    }> = [];
    for (const [position, definition] of activityDefinitions.entries()) {
      const dueAt = new Date(Date.now() + definition.dueDays * 86_400_000);
      const activity = await database.activity.upsert({
        where: { slug: definition.slug },
        update: {
          title: definition.title,
          prompt: definition.prompt,
          instructions: definition.instructions,
          dueAt,
          position,
          deliveryKind: definition.deliveryKind,
          relatedLibraryItemId: definition.libraryTitle
            ? (libraryItems.get(definition.libraryTitle)?.id ?? null)
            : null,
          status: ContentStatus.PUBLISHED,
          updatedBy: actorId,
        },
        create: {
          title: definition.title,
          slug: definition.slug,
          prompt: definition.prompt,
          instructions: definition.instructions,
          dueAt,
          position,
          deliveryKind: definition.deliveryKind,
          relatedLibraryItemId: definition.libraryTitle
            ? (libraryItems.get(definition.libraryTitle)?.id ?? null)
            : null,
          status: ContentStatus.PUBLISHED,
          createdBy: actorId,
          updatedBy: actorId,
        },
        select: { id: true, slug: true, dueAt: true },
      });
      demoActivities.push(activity);
      if (demoMember) {
        await database.activityAssignment.upsert({
          where: {
            activityId_memberId: {
              activityId: activity.id,
              memberId: demoMember.id,
            },
          },
          update: { dueAt },
          create: { activityId: activity.id, memberId: demoMember.id, dueAt },
        });
      }
    }

    if (demoMember) {
      const submitted = demoActivities.find(
        ({ slug }) => slug === "interprete-o-intervalo-de-confianca"
      );
      const reviewed = demoActivities.find(
        ({ slug }) => slug === "tres-pontos-de-risco-de-vies"
      );
      if (submitted) {
        await database.activitySubmission.upsert({
          where: {
            activityId_memberId: {
              activityId: submitted.id,
              memberId: demoMember.id,
            },
          },
          update: {
            content:
              "O intervalo é compatível com uma redução pequena e também com ausência de efeito. Eu evitaria afirmar benefício definitivo sem considerar a importância clínica do limiar.",
            status: ActivitySubmissionStatus.SUBMITTED,
            submittedAt: new Date(Date.now() - 86_400_000),
          },
          create: {
            activityId: submitted.id,
            memberId: demoMember.id,
            content:
              "O intervalo é compatível com uma redução pequena e também com ausência de efeito. Eu evitaria afirmar benefício definitivo sem considerar a importância clínica do limiar.",
            status: ActivitySubmissionStatus.SUBMITTED,
            submittedAt: new Date(Date.now() - 86_400_000),
          },
        });
      }
      if (reviewed) {
        const submission = await database.activitySubmission.upsert({
          where: {
            activityId_memberId: {
              activityId: reviewed.id,
              memberId: demoMember.id,
            },
          },
          update: {
            content:
              "Identifiquei perdas no seguimento, ausência de cegamento e relato incompleto do desfecho.",
            status: ActivitySubmissionStatus.REVIEWED,
            submittedAt: new Date(Date.now() - 3 * 86_400_000),
          },
          create: {
            activityId: reviewed.id,
            memberId: demoMember.id,
            content:
              "Identifiquei perdas no seguimento, ausência de cegamento e relato incompleto do desfecho.",
            status: ActivitySubmissionStatus.REVIEWED,
            submittedAt: new Date(Date.now() - 3 * 86_400_000),
          },
          select: { id: true },
        });
        await database.feedback.upsert({
          where: { submissionId: submission.id },
          update: {
            teacherId,
            content:
              "Boa leitura inicial. Na próxima rodada, tente conectar cada risco ao sentido e à magnitude do possível viés.",
          },
          create: {
            submissionId: submission.id,
            teacherId,
            content:
              "Boa leitura inicial. Na próxima rodada, tente conectar cada risco ao sentido e à magnitude do possível viés.",
          },
        });
      }
    }

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
      },
    });

    const existingPost = await database.communityPost.findFirst({
      where: {
        spaceId: space.id,
        authorId: actorId,
        title: "Como começar uma pergunta clínica?",
      },
      select: { id: true },
    });
    if (!existingPost) {
      await database.communityPost.create({
        data: {
          spaceId: space.id,
          authorId: actorId,
          kind: "PUBLICATION",
          title: "Como começar uma pergunta clínica?",
          subtitle: "Uma nota breve sobre transformar dúvida em investigação.",
          content:
            "Tenho uma dúvida ampla e quero transformá-la em uma pergunta investigável. Que parte vocês costumam delimitar primeiro?",
          excerpt:
            "Tenho uma dúvida ampla e quero transformá-la em uma pergunta investigável.",
          contentJson: richText("Da dúvida à pergunta", [
            "Uma boa pergunta torna explícito o que queremos compreender.",
          ]),
          status: ContentStatus.PUBLISHED,
          publishedAt: new Date(),
          slug: `como-comecar-uma-pergunta-clinica-${actorId.slice(-6).toLowerCase()}`,
        },
      });
    }

    const now = Date.now();
    const nextActivity = demoActivities.find(
      ({ slug }) => slug === "interprete-o-intervalo-de-confianca"
    );
    const cochrane = libraryItems.get(
      "Cochrane Handbook for Systematic Reviews of Interventions"
    );
    const meetingDefinitions = [
      {
        demoKey: "demo-past-critical-reading",
        title: "Mentoria — Introdução à leitura crítica",
        days: -14,
        duration: 60,
        kind: MeetingKind.INDIVIDUAL,
        recordingUrl:
          "https://interprete-area-de-membros.vercel.app/aprender/cursos/introducao-a-pratica-baseada-em-evidencias",
        relatedActivityId: undefined,
        relatedLibraryItemId: undefined,
      },
      {
        demoKey: "demo-next-confidence-interval",
        title: "Mentoria — Intervalos de confiança",
        days: 3,
        duration: 60,
        kind: MeetingKind.INDIVIDUAL,
        recordingUrl: undefined,
        relatedActivityId: nextActivity?.id,
        relatedLibraryItemId: cochrane?.id,
      },
      {
        demoKey: "demo-future-risk-of-bias",
        title: "Mentoria — Risco de viés",
        days: 10,
        duration: 60,
        kind: MeetingKind.FEEDBACK,
        recordingUrl: undefined,
        relatedActivityId: undefined,
        relatedLibraryItemId: undefined,
      },
      {
        demoKey: "demo-future-group-article",
        title: "Encontro em grupo — Discussão de artigo",
        days: 17,
        duration: 90,
        kind: MeetingKind.GROUP,
        recordingUrl: undefined,
        relatedActivityId: undefined,
        relatedLibraryItemId: undefined,
      },
      {
        demoKey: "demo-future-systematic-reviews",
        title: "Aula — Revisões sistemáticas e meta-análises",
        days: 25,
        duration: 90,
        kind: MeetingKind.LESSON,
        recordingUrl: undefined,
        relatedActivityId: undefined,
        relatedLibraryItemId: undefined,
      },
    ];
    for (const [position, meeting] of meetingDefinitions.entries()) {
      const startsAt = new Date(now + meeting.days * 86_400_000);
      startsAt.setHours(19, 0, 0, 0);
      const endsAt = new Date(startsAt.getTime() + meeting.duration * 60_000);
      const savedMeeting = await database.meeting.upsert({
        where: { demoKey: meeting.demoKey },
        update: {
          title: meeting.title,
          startsAt,
          endsAt,
          kind: meeting.kind,
          status: ContentStatus.PUBLISHED,
          teacherId,
          relatedActivityId: meeting.relatedActivityId ?? null,
          relatedLibraryItemId: meeting.relatedLibraryItemId ?? null,
          recordingUrl: meeting.recordingUrl ?? null,
          joinUrl: "https://meet.google.com/new",
          position,
        },
        create: {
          demoKey: meeting.demoKey,
          title: meeting.title,
          description:
            "Encontro demonstrativo do percurso Interprete. Substitua o link e os detalhes pelos dados reais da turma.",
          startsAt,
          endsAt,
          timezone: "America/Sao_Paulo",
          joinUrl: "https://meet.google.com/new",
          recordingUrl: meeting.recordingUrl ?? null,
          status: ContentStatus.PUBLISHED,
          teacherId,
          kind: meeting.kind,
          relatedActivityId: meeting.relatedActivityId ?? null,
          relatedLibraryItemId: meeting.relatedLibraryItemId ?? null,
          position,
        },
      });
      if (demoMember) {
        await database.meetingParticipant.deleteMany({
          where: { meetingId: savedMeeting.id },
        });
        await database.meetingParticipant.create({
          data: { meetingId: savedMeeting.id, memberId: demoMember.id },
        });
      }
    }

    console.log(
      `Development product fixtures ready: ${demoActivities.length} activities / ${meetingDefinitions.length} meetings / ${libraryReferences.length} references`
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
