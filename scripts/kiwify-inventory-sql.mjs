import { manifest } from "./kiwify-manifest-data.mjs";

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const jsonValue = (value) => `${sqlString(JSON.stringify(value))}::jsonb`;
const idFor = (prefix, value) =>
  `${prefix}-${value.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;

const lines = [
  `INSERT INTO "LearningPath" ("id", "title", "slug", "status", "position", "publishedAt", "createdAt", "updatedAt") VALUES (${sqlString(idFor("kiwify-path", manifest.course.slug))}, ${sqlString("Mentoria Interprete.")}, ${sqlString("mentoria-interprete")}, 'PUBLISHED', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("slug") DO UPDATE SET "title" = EXCLUDED."title", "status" = 'PUBLISHED', "publishedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP;`,
  `INSERT INTO "Course" ("id", "title", "slug", "status", "position", "publishedAt", "learningPathId", "createdAt", "updatedAt") VALUES (${sqlString(idFor("kiwify-course", manifest.course.sourceId))}, ${sqlString(manifest.course.title)}, ${sqlString(manifest.course.slug)}, 'PUBLISHED', 0, CURRENT_TIMESTAMP, ${sqlString(idFor("kiwify-path", manifest.course.slug))}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("slug") DO UPDATE SET "title" = EXCLUDED."title", "status" = 'PUBLISHED', "publishedAt" = CURRENT_TIMESTAMP, "learningPathId" = EXCLUDED."learningPathId", "updatedAt" = CURRENT_TIMESTAMP;`,
];

for (const student of manifest.students) {
  lines.push(
    `INSERT INTO "MigrationStudent" ("id", "sourcePlatform", "sourceId", "displayName", "email", "matchStatus", "notes", "createdAt", "updatedAt") VALUES (${sqlString(idFor("kiwify-student", student.sourceId))}, 'KIWIFY', ${sqlString(student.sourceId)}, ${sqlString(student.displayName)}, ${student.email ? sqlString(student.email) : "NULL"}, 'UNMATCHED', ${student.notes ? sqlString(student.notes) : "NULL"}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("sourcePlatform", "sourceId") DO UPDATE SET "displayName" = EXCLUDED."displayName", "email" = EXCLUDED."email", "notes" = EXCLUDED."notes", "updatedAt" = CURRENT_TIMESTAMP;`
  );
  lines.push(
    `INSERT INTO "MigrationRecord" ("id", "sourcePlatform", "entityType", "sourceId", "targetId", "status", "metadata", "createdAt", "updatedAt") VALUES (${sqlString(idFor("kiwify-record-student", student.sourceId))}, 'KIWIFY', 'STUDENT', ${sqlString(student.sourceId)}, ${sqlString(idFor("kiwify-student", student.sourceId))}, 'DISCOVERED', ${jsonValue(student)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("sourcePlatform", "entityType", "sourceId") DO UPDATE SET "targetId" = EXCLUDED."targetId", "metadata" = EXCLUDED."metadata", "updatedAt" = CURRENT_TIMESTAMP;`
  );
}

lines.push(
  `INSERT INTO "MigrationRecord" ("id", "sourcePlatform", "entityType", "sourceId", "targetId", "status", "metadata", "createdAt", "updatedAt") VALUES (${sqlString(idFor("kiwify-record-course", manifest.course.sourceId))}, 'KIWIFY', 'COURSE', ${sqlString(manifest.course.sourceId)}, ${sqlString(idFor("kiwify-course", manifest.course.sourceId))}, 'IMPORTED', ${jsonValue(manifest.course)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("sourcePlatform", "entityType", "sourceId") DO UPDATE SET "targetId" = EXCLUDED."targetId", "status" = 'IMPORTED', "metadata" = EXCLUDED."metadata", "updatedAt" = CURRENT_TIMESTAMP;`
);

for (const [modulePosition, module] of manifest.modules.entries()) {
  const moduleId = idFor("kiwify-module", module.studentSourceId);
  lines.push(
    `INSERT INTO "Module" ("id", "title", "slug", "position", "status", "courseId", "createdAt", "updatedAt") VALUES (${sqlString(moduleId)}, ${sqlString(module.title)}, ${sqlString(module.slug)}, ${modulePosition}, 'PUBLISHED', ${sqlString(idFor("kiwify-course", manifest.course.sourceId))}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("courseId", "slug") DO UPDATE SET "title" = EXCLUDED."title", "position" = EXCLUDED."position", "status" = 'PUBLISHED', "updatedAt" = CURRENT_TIMESTAMP;`,
    `INSERT INTO "MigrationRecord" ("id", "sourcePlatform", "entityType", "sourceId", "targetId", "status", "metadata", "createdAt", "updatedAt") VALUES (${sqlString(idFor("kiwify-record-module", module.studentSourceId))}, 'KIWIFY', 'MODULE', ${sqlString(module.sourceId)}, ${sqlString(moduleId)}, 'IMPORTED', ${jsonValue({ title: module.title, studentSourceId: module.studentSourceId, lessonCount: module.lessons.length })}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("sourcePlatform", "entityType", "sourceId") DO UPDATE SET "targetId" = EXCLUDED."targetId", "status" = 'IMPORTED', "metadata" = EXCLUDED."metadata", "updatedAt" = CURRENT_TIMESTAMP;`
  );

  for (const lesson of module.lessons) {
    const lessonId = idFor(
      "kiwify-lesson",
      `${module.studentSourceId}-${lesson.position + 1}`
    );
    const lessonSlug = `aula-${lesson.position + 1}`;
    lines.push(
      `INSERT INTO "Lesson" ("id", "title", "slug", "content", "kind", "status", "position", "publishedAt", "moduleId", "createdAt", "updatedAt") VALUES (${sqlString(lessonId)}, ${sqlString(lesson.title)}, ${sqlString(lessonSlug)}, '{"type":"doc","content":[]}'::jsonb, 'VIDEO', 'PUBLISHED', ${lesson.position}, CURRENT_TIMESTAMP, ${sqlString(moduleId)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("moduleId", "slug") DO UPDATE SET "title" = EXCLUDED."title", "position" = EXCLUDED."position", "kind" = 'VIDEO', "status" = 'PUBLISHED', "publishedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP;`,
      `INSERT INTO "MigrationRecord" ("id", "sourcePlatform", "entityType", "sourceId", "targetId", "status", "metadata", "createdAt", "updatedAt") VALUES (${sqlString(idFor("kiwify-record-lesson", `${module.studentSourceId}-${lesson.position + 1}`))}, 'KIWIFY', 'LESSON', ${sqlString(lesson.sourceId)}, ${sqlString(lessonId)}, 'IMPORTED', ${jsonValue({ title: lesson.title, moduleSourceId: module.sourceId, assetInventory: lesson.assetInventory })}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("sourcePlatform", "entityType", "sourceId") DO UPDATE SET "targetId" = EXCLUDED."targetId", "status" = 'IMPORTED', "metadata" = EXCLUDED."metadata", "updatedAt" = CURRENT_TIMESTAMP;`
    );
  }
}

process.stdout.write(`${lines.join("\n")}\n`);
