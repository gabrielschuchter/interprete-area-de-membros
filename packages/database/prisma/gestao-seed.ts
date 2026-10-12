import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";
import { validateGestaoSeedEnvironment } from "../gestao-seed-guard.mjs";
import { databaseSsl, normalizeRuntimeDatabaseUrl } from "../ssl";

const seedConfig = validateGestaoSeedEnvironment({
  nodeEnv: process.env.NODE_ENV,
  seedDevelopmentData: process.env.SEED_DEVELOPMENT_DATA,
  profile: process.env.GESTAO_SEED_PROFILE,
  databaseUrls: [
    { name: "DATABASE_URL", value: process.env.DATABASE_URL ?? "" },
    { name: "DIRECT_URL", value: process.env.DIRECT_URL ?? "" },
    {
      name: "POSTGRES_URL_NON_POOLING",
      value: process.env.POSTGRES_URL_NON_POOLING ?? "",
    },
  ],
});

const adapter = new PrismaPg({
  connectionString: normalizeRuntimeDatabaseUrl(seedConfig.connectionString),
  max: 1,
  ssl: databaseSsl,
});
const database = new PrismaClient({ adapter });

type Profile = "functional" | "visual";
interface CohortFixture {
  readonly courseIndexes: readonly number[];
  readonly endsAt: Date;
  readonly key: string;
  readonly lateJoinPolicy: "ALL_ACTIVE" | "FROM_JOIN";
  readonly name: string;
  readonly startsAt: Date;
  readonly studentKeys: readonly string[];
  readonly teacherKey: string;
}

interface SeededCourse {
  readonly id: string;
  readonly slug: string;
}

interface SeededLesson {
  readonly id: string;
  readonly slug: string;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly title: string;
}

interface SeededCohort {
  readonly endsAt: Date | null;
  readonly fixture: CohortFixture;
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly startsAt: Date;
}

interface ActivityFixture {
  readonly cohort: SeededCohort | undefined;
  readonly dueAt: Date | null;
  readonly key: string;
  readonly title: string;
}

interface SeededActivity {
  readonly cohort: SeededCohort;
  readonly dueAt: Date | null;
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

const localDate = (value: string) => new Date(`${value}-03:00`);
const addDays = (value: Date, days: number) =>
  new Date(value.getTime() + days * 86_400_000);
const utcAtOffset = (days: number, hour = 22, minute = 0) => {
  const date = new Date();
  date.setUTCHours(hour, minute, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};
const normalizedCohortName = (name: string) =>
  name
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("pt-BR");
const videoId = (index: number) => `qaGT${String(index).padStart(7, "0")}`;
const databaseUrlPattern = /postgres(?:ql)?:\/\/[^\s'"`]+/giu;
const safeErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(databaseUrlPattern, "[database URL]");
};

const functionalStudentNames = Array.from(
  { length: 12 },
  (_, index) => `Aluno QA Funcional ${String(index + 1).padStart(2, "0")}`
);
const visualActiveStudentNames = [
  "Marina Lopes",
  "Rafael Duarte",
  "Helena Souza",
  "Tiago Mendes",
  "Beatriz Cardoso",
  "Lucas Prado",
  ...Array.from(
    { length: 12 },
    (_, index) => `Participante Mentoria ${String(index + 7).padStart(2, "0")}`
  ),
];
const visualImmersionStudentNames = Array.from(
  { length: 24 },
  (_, index) => `Participante Imersão ${String(index + 1).padStart(2, "0")}`
);
const visualBiostatisticsStudentNames = Array.from(
  { length: 12 },
  (_, index) =>
    `Participante Bioestatística ${String(index + 1).padStart(2, "0")}`
);
const visualUnassignedStudentNames = Array.from(
  { length: 3 },
  (_, index) => `Aluno sem turma ${String(index + 1).padStart(2, "0")}`
);

const buildProfileConfig = (profile: Profile) => {
  const prefix = `gestao_qa_${profile}`;
  const admin = {
    id: `${prefix}_admin`,
    name: profile === "visual" ? "Gabriel Schuchter" : "Admin QA Gestão",
    role: "ADMIN" as const,
    username: `${prefix}_admin`,
  };
  const teachers = [
    {
      id: `${prefix}_teacher_1`,
      name: profile === "visual" ? "Docente QA 1" : "Professora QA Ana",
      role: "TEACHER" as const,
      username: `${prefix}_teacher_1`,
    },
    {
      id: `${prefix}_teacher_2`,
      name: profile === "visual" ? "Docente QA 2" : "Professor QA Bruno",
      role: "TEACHER" as const,
      username: `${prefix}_teacher_2`,
    },
  ];
  const studentNames =
    profile === "visual"
      ? [
          ...visualActiveStudentNames,
          ...visualImmersionStudentNames,
          ...visualBiostatisticsStudentNames,
          ...visualUnassignedStudentNames,
        ]
      : functionalStudentNames;
  const students = studentNames.map((name, index) => ({
    id: `${prefix}_student_${String(index + 1).padStart(2, "0")}`,
    name,
    role: "MEMBER" as const,
    username: `${prefix}_student_${String(index + 1).padStart(2, "0")}`,
  }));
  const studentKeyByName = new Map(
    students.map((student) => [student.name, student.id])
  );
  const studentKeys = (names: readonly string[]) =>
    names.map((name) => {
      const studentKey = studentKeyByName.get(name);
      if (!studentKey) {
        throw new Error(
          `Gestão fixture is missing an expected student: ${name}`
        );
      }
      return studentKey;
    });

  const cohorts: readonly CohortFixture[] =
    profile === "visual"
      ? [
          {
            key: "mentoria-pbe",
            name: "Turma Mentoria PBE",
            startsAt: localDate("2026-03-01T09:00:00"),
            endsAt: localDate("2026-11-30T23:59:00"),
            lateJoinPolicy: "ALL_ACTIVE",
            studentKeys: studentKeys(visualActiveStudentNames),
            teacherKey: admin.id,
            courseIndexes: [0, 1],
          },
          {
            key: "imersao-2026",
            name: "Turma Imersão 2026",
            startsAt: localDate("2026-10-17T09:00:00"),
            endsAt: localDate("2026-11-14T23:59:00"),
            lateJoinPolicy: "FROM_JOIN",
            studentKeys: studentKeys(visualImmersionStudentNames),
            teacherKey: admin.id,
            courseIndexes: [0],
          },
          {
            key: "bioestatistica-2025",
            name: "Turma Bioestatística (2025)",
            startsAt: localDate("2025-03-03T09:00:00"),
            endsAt: localDate("2025-11-28T23:59:00"),
            lateJoinPolicy: "ALL_ACTIVE",
            studentKeys: studentKeys(visualBiostatisticsStudentNames),
            teacherKey: admin.id,
            courseIndexes: [0],
          },
        ]
      : [
          {
            key: "functional-active",
            name: "QA Funcional — Turma ativa",
            startsAt: utcAtOffset(-28, 12),
            endsAt: utcAtOffset(60, 23, 59),
            lateJoinPolicy: "ALL_ACTIVE",
            studentKeys: students.slice(0, 4).map(({ id }) => id),
            teacherKey: teachers[0].id,
            courseIndexes: [0, 1],
          },
          {
            key: "functional-future",
            name: "QA Funcional — Turma futura",
            startsAt: utcAtOffset(14, 12),
            endsAt: utcAtOffset(42, 23, 59),
            lateJoinPolicy: "FROM_JOIN",
            studentKeys: [
              students[0].id,
              students[2].id,
              students[4].id,
              students[5].id,
            ],
            teacherKey: teachers[1].id,
            courseIndexes: [0],
          },
          {
            key: "functional-ended",
            name: "QA Funcional — Turma encerrada",
            startsAt: utcAtOffset(-180, 12),
            endsAt: utcAtOffset(-91, 23, 59),
            lateJoinPolicy: "ALL_ACTIVE",
            studentKeys: students.slice(6, 9).map(({ id }) => id),
            teacherKey: teachers[0].id,
            courseIndexes: [1],
          },
        ];

  return { admin, cohorts, prefix, students, teachers };
};

const upsertMember = async (member: {
  readonly id: string;
  readonly name: string;
  readonly role: "ADMIN" | "TEACHER" | "MEMBER";
  readonly username: string;
}) => {
  const now = new Date();
  await database.member.upsert({
    where: { id: member.id },
    create: {
      id: member.id,
      displayName: member.name,
      role: member.role,
      onboardingStatus: "COMPLETED",
      onboardingCompletedAt: now,
    },
    update: {
      displayName: member.name,
      role: member.role,
      deactivatedAt: null,
      onboardingStatus: "COMPLETED",
      onboardingCompletedAt: now,
    },
  });
  await database.profile.upsert({
    where: { clerkUserId: member.id },
    create: {
      clerkUserId: member.id,
      username: member.username,
      displayName: member.name,
      showInDirectory: false,
      interests: ["QA Gestão"],
    },
    update: {
      username: member.username,
      displayName: member.name,
      showInDirectory: false,
      interests: ["QA Gestão"],
    },
  });
};

const seedIdentities = async (
  config: ReturnType<typeof buildProfileConfig>
) => {
  for (const member of [config.admin, ...config.teachers, ...config.students]) {
    await upsertMember(member);
  }
};

const contentProfiles = {
  functional: {
    pathTitle: "QA Gestão — percurso funcional",
    courseTitles: [
      "PBE — curso funcional de QA",
      "Bioestatística — curso funcional de QA",
    ],
    moduleTitle: "Módulo funcional de QA",
    lessonTitles: [
      "Fundamentos da prática baseada em evidências",
      "Perguntas para orientar a busca",
      "Bases de dados bibliográficas",
      "Estratégias de busca",
      "Leitura crítica",
      "Vídeo privado para validar publicação",
    ],
  },
  visual: {
    pathTitle: "Percurso de prática baseada em evidências",
    courseTitles: ["Introdução à PBE", "Busca bibliográfica aplicada"],
    moduleTitle: "Fundamentos",
    lessonTitles: [
      "Introdução à prática baseada em evidências",
      "Perguntas clínicas e estratégia PICO",
      "Como buscar evidências",
      "Aula 4",
      "Aula 5",
      "Aula 6",
    ],
  },
} satisfies Record<
  Profile,
  {
    readonly pathTitle: string;
    readonly courseTitles: readonly string[];
    readonly moduleTitle: string;
    readonly lessonTitles: readonly string[];
  }
>;

const seedLearningPath = (profile: Profile) => {
  const slug = `gestao-qa-${profile}-conteudos`;
  const title = contentProfiles[profile].pathTitle;
  return database.learningPath.upsert({
    where: { slug },
    create: {
      title,
      slug,
      description: "Conteúdo isolado para validar a Gestão localmente.",
      status: "PUBLISHED",
      position: 0,
      publishedAt: new Date("2026-01-01T12:00:00.000Z"),
    },
    update: {
      title,
      description: "Conteúdo isolado para validar a Gestão localmente.",
      status: "PUBLISHED",
      position: 0,
      publishedAt: new Date("2026-01-01T12:00:00.000Z"),
    },
    select: { id: true },
  });
};

const seedCourse = (
  profile: Profile,
  title: string,
  index: number,
  creatorId: string,
  learningPathId: string
): Promise<SeededCourse> => {
  const slug = `gestao-qa-${profile}-curso-${index + 1}`;
  return database.course.upsert({
    where: { slug },
    create: {
      title,
      slug,
      subtitle: "Fixture explícita de desenvolvimento.",
      description: "Conteúdo fictício isolado para o QA local da Gestão.",
      experience: "ASYNC",
      status: "PUBLISHED",
      position: index,
      publishedAt: new Date("2026-01-01T12:00:00.000Z"),
      createdBy: creatorId,
      learningPathId,
    },
    update: {
      title,
      subtitle: "Fixture explícita de desenvolvimento.",
      description: "Conteúdo fictício isolado para o QA local da Gestão.",
      experience: "ASYNC",
      status: "PUBLISHED",
      position: index,
      publishedAt: new Date("2026-01-01T12:00:00.000Z"),
      createdBy: creatorId,
      learningPathId,
    },
    select: { id: true, slug: true },
  });
};

const seedCourseModule = (profile: Profile, courseId: string) => {
  const slug = `gestao-qa-${profile}-modulo-principal`;
  const title = contentProfiles[profile].moduleTitle;
  return database.module.upsert({
    where: { courseId_slug: { courseId, slug } },
    create: {
      title,
      slug,
      description: "Módulo da fixture de Gestão.",
      objectives: ["Validar leitura e liberação de aulas."],
      position: 0,
      status: "PUBLISHED",
      courseId,
    },
    update: {
      title,
      description: "Módulo da fixture de Gestão.",
      objectives: ["Validar leitura e liberação de aulas."],
      position: 0,
      status: "PUBLISHED",
    },
    select: { id: true },
  });
};

const seedLesson = async (
  profile: Profile,
  title: string,
  index: number,
  moduleId: string,
  teacherId: string
): Promise<SeededLesson> => {
  const slug = `gestao-qa-${profile}-aula-${index + 1}`;
  const isPrivate = profile === "functional" && index === 5;
  const publishedAt = isPrivate ? null : new Date("2026-01-01T12:00:00.000Z");
  const lesson = await database.lesson.upsert({
    where: { moduleId_slug: { moduleId, slug } },
    create: {
      title,
      slug,
      description: "Aula fictícia usada apenas no QA local da Gestão.",
      objectives: ["Testar conteúdo e acesso de turma."],
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: `Fixture local: ${title}.` }],
          },
        ],
      },
      kind: "VIDEO",
      status: isPrivate ? "DRAFT" : "PUBLISHED",
      position: index,
      publishedAt,
      createdBy: teacherId,
      updatedBy: teacherId,
      moduleId,
    },
    update: {
      title,
      description: "Aula fictícia usada apenas no QA local da Gestão.",
      objectives: ["Testar conteúdo e acesso de turma."],
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: `Fixture local: ${title}.` }],
          },
        ],
      },
      kind: "VIDEO",
      status: isPrivate ? "DRAFT" : "PUBLISHED",
      position: index,
      publishedAt,
      updatedBy: teacherId,
    },
    select: { id: true, slug: true, title: true, status: true },
  });
  const video = videoId(index + 1);
  await database.lessonAsset.upsert({
    where: {
      sourcePlatform_sourceId: { sourcePlatform: "youtube", sourceId: video },
    },
    create: {
      title,
      kind: "VIDEO",
      scope: "GENERAL",
      mediaProvider: "YOUTUBE",
      mediaExternalId: video,
      youtubeSourceUrl: `https://www.youtube.com/watch?v=${video}`,
      youtubeVideoTitle: title,
      youtubePrivacyStatus: isPrivate ? "PRIVATE" : "UNLISTED",
      youtubeEmbeddable: !isPrivate,
      youtubeCaptionsAvailable: false,
      youtubeVerificationStatus: isPrivate
        ? "PRIVATE_OR_NOT_FOUND"
        : "UNLISTED",
      youtubeCheckedAt: new Date("2026-10-12T12:00:00.000Z"),
      durationSeconds: 420,
      position: 0,
      sourcePlatform: "youtube",
      sourceId: video,
      originalTitle: title,
      ownerMemberId: teacherId,
      lessonId: lesson.id,
    },
    update: {
      title,
      kind: "VIDEO",
      scope: "GENERAL",
      mediaProvider: "YOUTUBE",
      mediaExternalId: video,
      youtubeSourceUrl: `https://www.youtube.com/watch?v=${video}`,
      youtubeVideoTitle: title,
      youtubePrivacyStatus: isPrivate ? "PRIVATE" : "UNLISTED",
      youtubeEmbeddable: !isPrivate,
      youtubeCaptionsAvailable: false,
      youtubeVerificationStatus: isPrivate
        ? "PRIVATE_OR_NOT_FOUND"
        : "UNLISTED",
      youtubeCheckedAt: new Date("2026-10-12T12:00:00.000Z"),
      durationSeconds: 420,
      position: 0,
      originalTitle: title,
      ownerMemberId: teacherId,
      lessonId: lesson.id,
    },
  });
  return lesson;
};

const seedCourses = async (
  profile: Profile,
  config: ReturnType<typeof buildProfileConfig>
) => {
  const content = contentProfiles[profile];
  const path = await seedLearningPath(profile);
  const courses = await Promise.all(
    content.courseTitles.map((title, index) =>
      seedCourse(profile, title, index, config.teachers[0].id, path.id)
    )
  );
  const module = await seedCourseModule(profile, courses[0].id);
  const lessons = await Promise.all(
    content.lessonTitles.map((title, index) =>
      seedLesson(profile, title, index, module.id, config.teachers[0].id)
    )
  );
  return { courses, lessons };
};

const seedCohorts = async (
  profile: Profile,
  config: ReturnType<typeof buildProfileConfig>,
  courses: readonly SeededCourse[]
): Promise<SeededCohort[]> => {
  const cohortRows: SeededCohort[] = [];
  for (const fixture of config.cohorts) {
    const cohort = await database.cohort.upsert({
      where: { slug: `gestao-qa-${profile}-${fixture.key}` },
      create: {
        name: fixture.name,
        normalizedName: normalizedCohortName(fixture.name),
        slug: `gestao-qa-${profile}-${fixture.key}`,
        startsAt: fixture.startsAt,
        endsAt: fixture.endsAt,
        lateJoinPolicy: fixture.lateJoinPolicy,
        readAfterEndDays: 90,
        notifyOnNews: true,
        createdByMemberId: config.admin.id,
      },
      update: {
        name: fixture.name,
        normalizedName: normalizedCohortName(fixture.name),
        startsAt: fixture.startsAt,
        endsAt: fixture.endsAt,
        lateJoinPolicy: fixture.lateJoinPolicy,
        readAfterEndDays: 90,
        notifyOnNews: true,
        archivedAt: null,
        createdByMemberId: config.admin.id,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        startsAt: true,
        endsAt: true,
      },
    });
    await database.cohortTeacher.upsert({
      where: {
        cohortId_memberId: {
          cohortId: cohort.id,
          memberId: fixture.teacherKey,
        },
      },
      create: {
        cohortId: cohort.id,
        memberId: fixture.teacherKey,
        assignedByMemberId: config.admin.id,
      },
      update: { assignedByMemberId: config.admin.id },
    });
    for (const studentId of fixture.studentKeys) {
      const isLateFutureJoin =
        profile === "functional" &&
        fixture.key === "functional-future" &&
        studentId === config.students[2].id;
      await database.cohortMembership.upsert({
        where: {
          activeKey: `${config.prefix}:${fixture.key}:${studentId}`,
        },
        create: {
          activeKey: `${config.prefix}:${fixture.key}:${studentId}`,
          cohortId: cohort.id,
          memberId: studentId,
          status: "ACTIVE",
          source: "MANUAL",
          joinedAt: isLateFutureJoin
            ? addDays(fixture.startsAt, 3)
            : fixture.startsAt,
          createdByMemberId: config.admin.id,
        },
        update: {
          cohortId: cohort.id,
          memberId: studentId,
          status: "ACTIVE",
          source: "MANUAL",
          joinedAt: isLateFutureJoin
            ? addDays(fixture.startsAt, 3)
            : fixture.startsAt,
          leftAt: null,
          createdByMemberId: config.admin.id,
        },
      });
    }
    for (const courseIndex of fixture.courseIndexes) {
      const course = courses[courseIndex];
      const activeKey = `${config.prefix}:${fixture.key}:${course.slug}`;
      await database.cohortCourseAccess.upsert({
        where: { activeKey },
        create: {
          activeKey,
          cohortId: cohort.id,
          courseId: course.id,
          releaseMode:
            profile === "visual" &&
            fixture.key === "mentoria-pbe" &&
            courseIndex === 0
              ? "SCHEDULE"
              : "ALL_AT_ONCE",
          startsAt: fixture.startsAt,
          createdByMemberId: config.admin.id,
        },
        update: {
          cohortId: cohort.id,
          courseId: course.id,
          releaseMode:
            profile === "visual" &&
            fixture.key === "mentoria-pbe" &&
            courseIndex === 0
              ? "SCHEDULE"
              : "ALL_AT_ONCE",
          startsAt: fixture.startsAt,
          revokedAt: null,
          createdByMemberId: config.admin.id,
        },
      });
    }
    cohortRows.push({ ...cohort, fixture });
  }
  return cohortRows;
};

const seedLessonReleases = async (
  profile: Profile,
  config: ReturnType<typeof buildProfileConfig>,
  cohorts: readonly SeededCohort[],
  lessons: readonly SeededLesson[]
) => {
  const mentor = cohorts.find(({ fixture }) =>
    profile === "visual"
      ? fixture.key === "mentoria-pbe"
      : fixture.key === "functional-active"
  );
  if (!mentor) {
    return 0;
  }
  const releaseDates =
    profile === "visual"
      ? [
          { lessonIndex: 3, date: localDate("2026-09-30T09:00:00") },
          { lessonIndex: 4, date: localDate("2026-10-14T09:00:00") },
          { lessonIndex: 5, date: localDate("2026-10-21T09:00:00") },
        ]
      : [
          { lessonIndex: 2, date: addDays(mentor.startsAt, 5) },
          { lessonIndex: 4, date: addDays(mentor.startsAt, 12) },
          { lessonIndex: 5, date: addDays(mentor.startsAt, 20) },
        ];
  for (const release of releaseDates) {
    const lesson = lessons[release.lessonIndex];
    if (!lesson || lesson.status !== "PUBLISHED") {
      continue;
    }
    await database.cohortLessonRelease.upsert({
      where: {
        cohortId_lessonId: { cohortId: mentor.id, lessonId: lesson.id },
      },
      create: {
        cohortId: mentor.id,
        lessonId: lesson.id,
        releaseAt: release.date,
        updatedByMemberId: config.admin.id,
      },
      update: { releaseAt: release.date, updatedByMemberId: config.admin.id },
    });
  }
  return releaseDates.length;
};

const activityFixtures = (
  profile: Profile,
  cohorts: readonly SeededCohort[]
): ActivityFixture[] => {
  if (profile === "visual") {
    const mentor = cohorts.find(
      ({ fixture }) => fixture.key === "mentoria-pbe"
    );
    const immersion = cohorts.find(
      ({ fixture }) => fixture.key === "imersao-2026"
    );
    return [
      {
        key: "leitura-critica",
        title: "Leitura crítica",
        dueAt: localDate("2026-10-06T23:59:00"),
        cohort: mentor,
      },
      {
        key: "intervalo-confianca",
        title: "Intervalo de confiança",
        dueAt: localDate("2026-10-12T23:59:00"),
        cohort: mentor,
      },
      {
        key: "risco-vies",
        title: "Avalie o risco de viés",
        dueAt: null,
        cohort: mentor,
      },
      {
        key: "revisao-diretriz",
        title: "Revisão de uma diretriz clínica",
        dueAt: null,
        cohort: mentor,
      },
      {
        key: "preparacao-imersao",
        title: "Preparação para a Imersão",
        dueAt: localDate("2026-11-07T23:59:00"),
        cohort: immersion,
      },
    ];
  }
  const active = cohorts.find(
    ({ fixture }) => fixture.key === "functional-active"
  );
  const future = cohorts.find(
    ({ fixture }) => fixture.key === "functional-future"
  );
  const now = new Date();
  return [
    {
      key: "functional-activity-1",
      title: "Atividade funcional 1",
      dueAt: addDays(now, -3),
      cohort: active,
    },
    {
      key: "functional-activity-2",
      title: "Atividade funcional 2",
      dueAt: addDays(now, 1),
      cohort: active,
    },
    {
      key: "functional-activity-3",
      title: "Atividade funcional 3",
      dueAt: addDays(now, 8),
      cohort: active,
    },
    {
      key: "functional-activity-4",
      title: "Atividade funcional 4",
      dueAt: addDays(now, 18),
      cohort: active,
    },
    {
      key: "functional-activity-5",
      title: "Atividade funcional 5 — entrada tardia",
      dueAt: addDays(now, 20),
      cohort: future,
    },
  ];
};

const seedActivity = async (
  profile: Profile,
  config: ReturnType<typeof buildProfileConfig>,
  courseId: string,
  fixture: ActivityFixture & { readonly cohort: SeededCohort },
  index: number
): Promise<SeededActivity> => {
  const { cohort } = fixture;
  const slug = `gestao-qa-${profile}-${fixture.key}`;
  const activity = await database.activity.upsert({
    where: { slug },
    create: {
      title: fixture.title,
      slug,
      prompt: `Fixture local da atividade: ${fixture.title}.`,
      instructions:
        "Dados fictícios de desenvolvimento; não enviados a alunos reais.",
      deliveryKind: "TEXT",
      status: "PUBLISHED",
      position: index,
      dueAt: fixture.dueAt,
      courseId,
      createdBy: config.teachers[0].id,
      updatedBy: config.teachers[0].id,
    },
    update: {
      title: fixture.title,
      prompt: `Fixture local da atividade: ${fixture.title}.`,
      instructions:
        "Dados fictícios de desenvolvimento; não enviados a alunos reais.",
      deliveryKind: "TEXT",
      status: "PUBLISHED",
      position: index,
      dueAt: fixture.dueAt,
      courseId,
      updatedBy: config.teachers[0].id,
    },
    select: { id: true, title: true, slug: true, dueAt: true },
  });
  const assignedAt =
    profile === "functional" && cohort.fixture.key === "functional-future"
      ? addDays(cohort.fixture.startsAt, 2)
      : cohort.fixture.startsAt;
  const activeKey = `${config.prefix}:${fixture.key}:${cohort.id}`;
  await database.activityCohortTarget.upsert({
    where: { activeKey },
    create: {
      activeKey,
      activityId: activity.id,
      cohortId: cohort.id,
      assignedAt,
      createdByMemberId: config.teachers[0].id,
    },
    update: {
      activityId: activity.id,
      cohortId: cohort.id,
      assignedAt,
      revokedAt: null,
      createdByMemberId: config.teachers[0].id,
    },
  });
  return { ...activity, cohort };
};

const seedVisualSubmissions = async (activities: readonly SeededActivity[]) => {
  const activity = activities.find(({ slug }) =>
    slug.includes("intervalo-confianca")
  );
  if (!activity) {
    return;
  }
  const submitters = activity.cohort.fixture.studentKeys.slice(0, 5);
  for (const [index, memberId] of submitters.entries()) {
    await database.activitySubmission.upsert({
      where: { activityId_memberId: { activityId: activity.id, memberId } },
      create: {
        activityId: activity.id,
        memberId,
        content: `Fixture de envio ${index + 1}; conteúdo fictício de QA.`,
        status: "SUBMITTED",
        submittedAt: localDate("2026-10-12T16:00:00"),
      },
      update: {
        content: `Fixture de envio ${index + 1}; conteúdo fictício de QA.`,
        status: "SUBMITTED",
        submittedAt: localDate("2026-10-12T16:00:00"),
      },
    });
  }
};

const seedFunctionalSubmissions = async (
  activities: readonly SeededActivity[]
) => {
  for (const [index, activity] of activities.entries()) {
    const students = activity.cohort.fixture.studentKeys;
    const memberId = students[index % students.length];
    const status = index === 4 ? "DRAFT" : "SUBMITTED";
    const submittedAt = status === "DRAFT" ? null : utcAtOffset(-1);
    await database.activitySubmission.upsert({
      where: { activityId_memberId: { activityId: activity.id, memberId } },
      create: {
        activityId: activity.id,
        memberId,
        content: `Fixture funcional ${index + 1}; resposta fictícia para QA.`,
        status,
        submittedAt,
      },
      update: {
        content: `Fixture funcional ${index + 1}; resposta fictícia para QA.`,
        status,
        submittedAt,
      },
    });
  }
};

const seedActivities = async (
  profile: Profile,
  config: ReturnType<typeof buildProfileConfig>,
  courses: readonly SeededCourse[],
  cohorts: readonly SeededCohort[]
) => {
  const activities: SeededActivity[] = [];
  for (const [index, fixture] of activityFixtures(profile, cohorts).entries()) {
    if (fixture.cohort) {
      activities.push(
        await seedActivity(
          profile,
          config,
          courses[0].id,
          {
            ...fixture,
            cohort: fixture.cohort,
          },
          index
        )
      );
    }
  }
  if (profile === "visual") {
    await seedVisualSubmissions(activities);
  } else {
    await seedFunctionalSubmissions(activities);
  }
  return activities.length;
};

const meetingFixtures = (
  profile: Profile,
  cohorts: readonly SeededCohort[]
) => {
  const first = cohorts[0];
  if (profile === "visual") {
    const immersion = cohorts.find(
      ({ fixture }) => fixture.key === "imersao-2026"
    );
    return [
      {
        key: "risco-de-vies",
        cohort: first,
        title: "Risco de viés",
        startsAt: localDate("2026-10-16T19:00:00"),
        endsAt: localDate("2026-10-16T20:30:00"),
        status: "DRAFT" as const,
        recurrenceRule: null,
        recurrenceUntil: null,
      },
      {
        key: "revisoes-sistematicas",
        cohort: first,
        title: "Revisões",
        startsAt: localDate("2026-10-21T19:00:00"),
        endsAt: localDate("2026-10-21T20:30:00"),
        status: "PUBLISHED" as const,
        recurrenceRule: null,
        recurrenceUntil: null,
      },
      {
        key: "intervalos",
        cohort: first,
        title: "Intervalos",
        startsAt: localDate("2026-10-29T19:00:00"),
        endsAt: localDate("2026-10-29T20:30:00"),
        status: "PUBLISHED" as const,
        recurrenceRule: null,
        recurrenceUntil: null,
      },
      {
        key: "imersao-boas-vindas",
        cohort: immersion,
        title: "Encontro de boas-vindas da Imersão",
        startsAt: localDate("2026-10-20T19:00:00"),
        endsAt: localDate("2026-10-20T20:00:00"),
        status: "PUBLISHED" as const,
        recurrenceRule: null,
        recurrenceUntil: null,
      },
    ];
  }
  const functionalOccurrence = utcAtOffset(10, 22);
  return [
    {
      key: "functional-recurring",
      cohort: cohorts.find(
        ({ fixture }) => fixture.key === "functional-active"
      ),
      title: "Encontro funcional recorrente",
      startsAt: utcAtOffset(3, 22),
      endsAt: utcAtOffset(3, 23),
      status: "PUBLISHED" as const,
      recurrenceRule: "WEEKLY",
      recurrenceUntil: utcAtOffset(31, 23, 59),
    },
    {
      key: "functional-occurrence-exception",
      cohort: cohorts.find(
        ({ fixture }) => fixture.key === "functional-active"
      ),
      title: "Encontro com exceção de ocorrência",
      startsAt: functionalOccurrence,
      endsAt: addDays(functionalOccurrence, 0.04),
      status: "PUBLISHED" as const,
      recurrenceRule: null,
      recurrenceUntil: null,
    },
    {
      key: "functional-future-meeting",
      cohort: cohorts.find(
        ({ fixture }) => fixture.key === "functional-future"
      ),
      title: "Encontro funcional de turma futura",
      startsAt: utcAtOffset(20, 22),
      endsAt: utcAtOffset(20, 23),
      status: "PUBLISHED" as const,
      recurrenceRule: null,
      recurrenceUntil: null,
    },
  ];
};

const seedMeetings = async (
  profile: Profile,
  config: ReturnType<typeof buildProfileConfig>,
  courses: readonly SeededCourse[],
  cohorts: readonly SeededCohort[]
) => {
  let count = 0;
  for (const fixture of meetingFixtures(profile, cohorts)) {
    if (!fixture.cohort) {
      continue;
    }
    const meetingId = `${config.prefix}_meeting_${fixture.key}`;
    const meeting = await database.meeting.upsert({
      where: { id: meetingId },
      create: {
        id: meetingId,
        title: fixture.title,
        description:
          "Fixture de encontro. O link não aponta para uma sala real.",
        startsAt: fixture.startsAt,
        endsAt: fixture.endsAt,
        timezone: "America/Sao_Paulo",
        joinUrl: `https://example.invalid/gestao-qa/${fixture.key}`,
        status: fixture.status,
        teacherId: config.teachers[0].id,
        courseId: courses[0].id,
        kind: "GROUP",
        recurrenceRule: fixture.recurrenceRule,
        recurrenceUntil: fixture.recurrenceUntil,
      },
      update: {
        title: fixture.title,
        description:
          "Fixture de encontro. O link não aponta para uma sala real.",
        startsAt: fixture.startsAt,
        endsAt: fixture.endsAt,
        timezone: "America/Sao_Paulo",
        joinUrl: `https://example.invalid/gestao-qa/${fixture.key}`,
        status: fixture.status,
        teacherId: config.teachers[0].id,
        courseId: courses[0].id,
        kind: "GROUP",
        recurrenceRule: fixture.recurrenceRule,
        recurrenceUntil: fixture.recurrenceUntil,
        demoKey: null,
      },
      select: { id: true },
    });
    await database.meetingCohortTarget.upsert({
      where: {
        meetingId_cohortId: {
          meetingId: meeting.id,
          cohortId: fixture.cohort.id,
        },
      },
      create: {
        meetingId: meeting.id,
        cohortId: fixture.cohort.id,
        assignedAt: fixture.cohort.fixture.startsAt,
        createdByMemberId: config.admin.id,
      },
      update: {
        assignedAt: fixture.cohort.fixture.startsAt,
        revokedAt: null,
        createdByMemberId: config.admin.id,
      },
    });
    count += 1;

    if (profile === "functional" && fixture.key === "functional-recurring") {
      const occurrenceStartsAt = addDays(fixture.startsAt, 7);
      await database.meetingOccurrenceException.upsert({
        where: { id: `${config.prefix}_meeting_exception_recurring` },
        create: {
          id: `${config.prefix}_meeting_exception_recurring`,
          meetingId: meeting.id,
          occurrenceStartsAt,
          startsAtOverride: addDays(occurrenceStartsAt, 1),
          endsAtOverride: addDays(occurrenceStartsAt, 1.04),
          titleOverride: "Encontro funcional — horário alterado",
          updatedByMemberId: config.admin.id,
        },
        update: {
          startsAtOverride: addDays(occurrenceStartsAt, 1),
          endsAtOverride: addDays(occurrenceStartsAt, 1.04),
          titleOverride: "Encontro funcional — horário alterado",
          cancelledAt: null,
          updatedByMemberId: config.admin.id,
        },
      });
    }
  }
  return count;
};

const seedCohortCalendarEvents = async (
  profile: Profile,
  config: ReturnType<typeof buildProfileConfig>,
  cohorts: readonly SeededCohort[]
) => {
  if (profile !== "functional") {
    return 0;
  }
  const cohort = cohorts.find(
    ({ fixture }) => fixture.key === "functional-active"
  );
  if (!cohort) {
    return 0;
  }
  const startsAt = addDays(cohort.fixture.startsAt, 6);
  const eventId = `${config.prefix}_event_recurring`;
  const event = await database.cohortEvent.upsert({
    where: { id: eventId },
    create: {
      id: eventId,
      cohortId: cohort.id,
      title: "Seminário funcional recorrente",
      description: "Evento fictício para testar recorrência e exceções.",
      startsAt,
      endsAt: addDays(startsAt, 0.04),
      allDay: false,
      color: "#8C1535",
      recurrence: "WEEKLY",
      recurrenceUntil: addDays(startsAt, 28),
      status: "PUBLISHED",
      version: 1,
      publishedAt: new Date(),
      createdByMemberId: config.admin.id,
    },
    update: {
      cohortId: cohort.id,
      title: "Seminário funcional recorrente",
      description: "Evento fictício para testar recorrência e exceções.",
      startsAt,
      endsAt: addDays(startsAt, 0.04),
      allDay: false,
      color: "#8C1535",
      recurrence: "WEEKLY",
      recurrenceUntil: addDays(startsAt, 28),
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  const occurrenceStartsAt = addDays(startsAt, 14);
  await database.cohortEventOccurrenceException.upsert({
    where: { id: `${config.prefix}_event_exception_recurring` },
    create: {
      id: `${config.prefix}_event_exception_recurring`,
      eventId: event.id,
      occurrenceStartsAt,
      cancelledAt: new Date(),
      updatedByMemberId: config.admin.id,
    },
    update: {
      cancelledAt: new Date(),
      startsAtOverride: null,
      endsAtOverride: null,
      updatedByMemberId: config.admin.id,
    },
  });
  return 1;
};

const seedBadges = async (
  profile: Profile,
  config: ReturnType<typeof buildProfileConfig>
) => {
  const badges = [
    ["STUDY_MINUTES", 60, "Uma hora de estudo"],
    ["STUDY_STREAK_DAYS", 3, "Três dias de prática"],
    ["STUDY_GOALS_MET", 1, "Meta cumprida"],
    ["EXERCISE_ANSWERS", 10, "Dez respostas"],
    ["ACTIVITIES_COMPLETED", 2, "Duas atividades"],
    ["COMMUNITY_PUBLICATIONS", 1, "Primeira publicação"],
    ["LESSONS_COMPLETED", 3, "Três aulas"],
    ["MEETINGS_ATTENDED", 1, "Primeiro encontro"],
  ] as const;
  for (const [index, [criterion, threshold, title]] of badges.entries()) {
    const slug = `gestao-qa-${profile}-medalha-${index + 1}`;
    const badge = await database.badgeDefinition.upsert({
      where: { slug },
      create: {
        slug,
        title,
        description: `Critério de teste local: ${title}.`,
        criterion,
        threshold,
        imageUrl: null,
        status: "PUBLISHED",
        version: 1,
        createdByMemberId: config.admin.id,
      },
      update: {
        title,
        description: `Critério de teste local: ${title}.`,
        criterion,
        threshold,
        status: "PUBLISHED",
        version: 1,
        createdByMemberId: config.admin.id,
      },
      select: { id: true },
    });
    await database.badgeDefinitionRevision.upsert({
      where: { badgeId_version: { badgeId: badge.id, version: 1 } },
      create: {
        badgeId: badge.id,
        version: 1,
        title,
        description: `Critério de teste local: ${title}.`,
        criterion,
        threshold,
        imageUrl: null,
        createdByMemberId: config.admin.id,
      },
      update: {
        title,
        description: `Critério de teste local: ${title}.`,
        criterion,
        threshold,
        createdByMemberId: config.admin.id,
      },
    });
  }
  return badges.length;
};

const seedVisualProgress = async (
  profile: Profile,
  cohorts: readonly SeededCohort[],
  lessons: readonly SeededLesson[]
) => {
  if (profile !== "visual") {
    return 0;
  }
  const active = cohorts.find(({ fixture }) => fixture.key === "mentoria-pbe");
  const ended = cohorts.find(
    ({ fixture }) => fixture.key === "bioestatistica-2025"
  );
  if (!(active && ended)) {
    return 0;
  }
  let count = 0;
  const activeProgressCount = Math.round(
    active.fixture.studentKeys.length * lessons.length * 0.54
  );
  for (const [index, memberId] of active.fixture.studentKeys.entries()) {
    for (const [lessonIndex, lesson] of lessons.entries()) {
      const ordinal = index * lessons.length + lessonIndex;
      if (ordinal >= activeProgressCount) {
        continue;
      }
      await database.lessonProgress.upsert({
        where: { memberId_lessonId: { memberId, lessonId: lesson.id } },
        create: {
          memberId,
          lessonId: lesson.id,
          status: "COMPLETED",
          startedAt: active.fixture.startsAt,
          completedAt: addDays(active.fixture.startsAt, ordinal % 45),
        },
        update: {
          status: "COMPLETED",
          completedAt: addDays(active.fixture.startsAt, ordinal % 45),
        },
      });
      count += 1;
    }
  }
  for (const memberId of ended.fixture.studentKeys) {
    for (const lesson of lessons) {
      await database.lessonProgress.upsert({
        where: { memberId_lessonId: { memberId, lessonId: lesson.id } },
        create: {
          memberId,
          lessonId: lesson.id,
          status: "COMPLETED",
          startedAt: ended.fixture.startsAt,
          completedAt: addDays(ended.fixture.startsAt, 30),
        },
        update: {
          status: "COMPLETED",
          completedAt: addDays(ended.fixture.startsAt, 30),
        },
      });
      count += 1;
    }
  }
  return count;
};

const run = async () => {
  const profile = seedConfig.profile as Profile;
  const config = buildProfileConfig(profile);
  await seedIdentities(config);
  const { courses, lessons } = await seedCourses(profile, config);
  const cohorts = await seedCohorts(profile, config, courses);
  const releaseCount = await seedLessonReleases(
    profile,
    config,
    cohorts,
    lessons
  );
  const activityCount = await seedActivities(profile, config, courses, cohorts);
  const meetingCount = await seedMeetings(profile, config, courses, cohorts);
  const cohortEventCount = await seedCohortCalendarEvents(
    profile,
    config,
    cohorts
  );
  const badgeCount = await seedBadges(profile, config);
  const progressCount = await seedVisualProgress(profile, cohorts, lessons);
  const studentCount = config.students.length;
  const unassignedCount =
    profile === "visual" ? visualUnassignedStudentNames.length : 3;

  console.log(
    JSON.stringify(
      {
        status: "Gestão QA seed applied",
        profile,
        database: seedConfig.databaseName,
        cohorts: cohorts.length,
        students: studentCount,
        unassignedStudents: unassignedCount,
        teachers: config.teachers.length,
        administrators: 1,
        courses: courses.length,
        lessons: lessons.length,
        activities: activityCount,
        meetings: meetingCount,
        cohortCalendarEvents: cohortEventCount,
        lessonReleases: releaseCount,
        badgeDefinitions: badgeCount,
        lessonProgressRows: progressCount,
      },
      null,
      2
    )
  );
};

run()
  .catch((error: unknown) => {
    console.error(`Gestão QA seed failed: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
