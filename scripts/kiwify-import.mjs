import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  databaseSsl,
  normalizeRuntimeDatabaseUrl,
} from "../packages/database/ssl.ts";
import { manifest } from "./kiwify-manifest-data.mjs";

const ENV_LINE_SPLIT = /\r?\n/;
const ENV_LINE_PATTERN = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/;
const PLACEHOLDER_PASSWORD =
  /replace-with|your-password|change[-_]?me|password/i;

const parseEnvironment = (contents) => {
  const values = {};

  for (const line of contents.split(ENV_LINE_SPLIT)) {
    const match = line.match(ENV_LINE_PATTERN);
    if (!match) {
      continue;
    }

    let value = match[2] ?? "";
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }

  return values;
};

const loadLocalEnvironment = async () => {
  const files = [
    ".env.local",
    "apps/app/.env.local",
    "apps/api/.env.local",
    "packages/database/.env",
  ];

  for (const file of files) {
    try {
      const contents = await readFile(path.resolve(file), "utf8");
      for (const [key, value] of Object.entries(parseEnvironment(contents))) {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // Optional env locations are intentionally ignored.
    }
  }
};

await loadLocalEnvironment();

const { PrismaPg } = await import(
  "../packages/database/node_modules/@prisma/adapter-pg/dist/index.mjs"
);
const {
  AccessPermission,
  AccessResourceType,
  ContentStatus,
  LessonKind,
  MigrationEntityType,
  MigrationStatus,
  MigrationStudentMatchStatus,
  PrismaClient,
} = await import("../packages/database/generated/client.ts");

const connectionString = process.env.DATABASE_URL;
if (
  !connectionString ||
  PLACEHOLDER_PASSWORD.test(new URL(connectionString).password)
) {
  throw new Error(
    "DATABASE_URL is unavailable or still a placeholder; Kiwify import was not started."
  );
}

const database = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: normalizeRuntimeDatabaseUrl(connectionString),
    max: 1,
    ssl: databaseSsl,
  }),
});

const sourcePlatform = manifest.source.platform;

const normalizeEmail = (value) => value?.trim().toLowerCase() || null;

const sourceRecord = async (entityType, sourceId, data) =>
  database.migrationRecord.upsert({
    where: {
      sourcePlatform_entityType_sourceId: {
        sourcePlatform,
        entityType,
        sourceId,
      },
    },
    update: {
      status: MigrationStatus.IMPORTED,
      metadata: data,
      lastError: null,
    },
    create: {
      sourcePlatform,
      entityType,
      sourceId,
      status: MigrationStatus.IMPORTED,
      metadata: data,
    },
  });

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This importer coordinates idempotent course, student, and lesson writes in one resumable operation.
const run = async () => {
  const learningPath = await database.learningPath.upsert({
    where: { slug: "mentoria-interprete" },
    update: {
      title: "Mentoria Interprete.",
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
    create: {
      title: "Mentoria Interprete.",
      slug: "mentoria-interprete",
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
      position: 0,
    },
  });

  const course = await database.course.upsert({
    where: { slug: manifest.course.slug },
    update: {
      title: manifest.course.title,
      learningPathId: learningPath.id,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
    create: {
      title: manifest.course.title,
      slug: manifest.course.slug,
      learningPathId: learningPath.id,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
      position: 0,
    },
  });

  await sourceRecord(MigrationEntityType.COURSE, manifest.course.sourceId, {
    targetId: course.id,
    title: manifest.course.title,
  });
  await database.migrationRecord.update({
    where: {
      sourcePlatform_entityType_sourceId: {
        sourcePlatform,
        entityType: MigrationEntityType.COURSE,
        sourceId: manifest.course.sourceId,
      },
    },
    data: { targetId: course.id },
  });

  const memberRows = await database.member.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true },
  });
  const membersByEmail = new Map();
  for (const member of memberRows) {
    const email = normalizeEmail(member.email);
    if (!email) {
      continue;
    }
    membersByEmail.set(email, [
      ...(membersByEmail.get(email) ?? []),
      member.id,
    ]);
  }

  const matchedStudentMembers = new Map();
  let exactMatches = 0;
  let ambiguousMatches = 0;

  for (const student of manifest.students) {
    const email = normalizeEmail(student.email);
    const candidates = email ? (membersByEmail.get(email) ?? []) : [];
    const exact = candidates.length === 1 ? candidates[0] : null;
    let matchStatus = MigrationStudentMatchStatus.UNMATCHED;
    if (exact) {
      matchStatus = MigrationStudentMatchStatus.EXACT;
    } else if (candidates.length > 1) {
      matchStatus = MigrationStudentMatchStatus.AMBIGUOUS;
    }

    if (exact) {
      exactMatches += 1;
      matchedStudentMembers.set(student.sourceId, exact);
    } else if (matchStatus === MigrationStudentMatchStatus.AMBIGUOUS) {
      ambiguousMatches += 1;
    }

    await database.migrationStudent.upsert({
      where: {
        sourcePlatform_sourceId: {
          sourcePlatform,
          sourceId: student.sourceId,
        },
      },
      update: {
        displayName: student.displayName,
        email,
        memberId: exact,
        matchStatus,
        notes: student.notes ?? null,
      },
      create: {
        sourcePlatform,
        sourceId: student.sourceId,
        displayName: student.displayName,
        email,
        memberId: exact,
        matchStatus,
        notes: student.notes ?? null,
      },
    });

    await sourceRecord(MigrationEntityType.STUDENT, student.sourceId, {
      displayName: student.displayName,
      email,
      matchStatus,
    });
  }

  let importedLessons = 0;
  let grantedModules = 0;

  for (const [modulePosition, module] of manifest.modules.entries()) {
    const savedModule = await database.module.upsert({
      where: {
        courseId_slug: { courseId: course.id, slug: module.slug },
      },
      update: {
        title: module.title,
        position: modulePosition,
        status: ContentStatus.PUBLISHED,
      },
      create: {
        title: module.title,
        slug: module.slug,
        position: modulePosition,
        status: ContentStatus.PUBLISHED,
        courseId: course.id,
      },
    });

    await sourceRecord(MigrationEntityType.MODULE, module.sourceId, {
      targetId: savedModule.id,
      title: module.title,
      studentSourceId: module.studentSourceId,
      lessonCount: module.lessons.length,
    });
    await database.migrationRecord.update({
      where: {
        sourcePlatform_entityType_sourceId: {
          sourcePlatform,
          entityType: MigrationEntityType.MODULE,
          sourceId: module.sourceId,
        },
      },
      data: { targetId: savedModule.id },
    });

    const memberId = matchedStudentMembers.get(module.studentSourceId);
    if (memberId) {
      await database.accessGrant.upsert({
        where: {
          memberId_resourceType_resourceId: {
            memberId,
            resourceType: AccessResourceType.MODULE,
            resourceId: savedModule.id,
          },
        },
        update: {
          permission: AccessPermission.VIEW,
          sourcePlatform,
          sourceId: module.sourceId,
        },
        create: {
          memberId,
          resourceType: AccessResourceType.MODULE,
          resourceId: savedModule.id,
          permission: AccessPermission.VIEW,
          sourcePlatform,
          sourceId: module.sourceId,
        },
      });
      grantedModules += 1;
    }

    for (const lesson of module.lessons) {
      const savedLesson = await database.lesson.upsert({
        where: {
          moduleId_slug: {
            moduleId: savedModule.id,
            slug: `aula-${lesson.position + 1}`,
          },
        },
        update: {
          title: lesson.title,
          position: lesson.position,
          kind: LessonKind.VIDEO,
          status: ContentStatus.PUBLISHED,
          publishedAt: new Date(),
        },
        create: {
          title: lesson.title,
          slug: `aula-${lesson.position + 1}`,
          position: lesson.position,
          content: { type: "doc", content: [] },
          kind: LessonKind.VIDEO,
          status: ContentStatus.PUBLISHED,
          publishedAt: new Date(),
          moduleId: savedModule.id,
        },
      });

      await sourceRecord(MigrationEntityType.LESSON, lesson.sourceId, {
        targetId: savedLesson.id,
        title: lesson.title,
        moduleSourceId: module.sourceId,
        assetInventory: lesson.assetInventory,
      });
      await database.migrationRecord.update({
        where: {
          sourcePlatform_entityType_sourceId: {
            sourcePlatform,
            entityType: MigrationEntityType.LESSON,
            sourceId: lesson.sourceId,
          },
        },
        data: { targetId: savedLesson.id },
      });
      importedLessons += 1;
    }
  }

  return {
    course: course.id,
    modules: manifest.modules.length,
    lessons: importedLessons,
    grantedModules,
    exactMatches,
    ambiguousMatches,
    unmatchedStudents:
      manifest.students.length - exactMatches - ambiguousMatches,
  };
};

try {
  console.log(JSON.stringify(await run(), null, 2));
} finally {
  await database.$disconnect();
}
