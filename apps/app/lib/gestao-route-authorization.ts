import "server-only";
import { database } from "@repo/database";

const cohortPathPattern = /^\/gestao\/alunos\/turmas\/([^/]+)/u;

// Request-only boundary check before HTML can stream. Page/action guards remain
// authoritative and reauthorize; no role or responsibility is cached here.
export const canEnterGestaoRoute = async (
  userId: string,
  pathname: string,
  selectedCohortId?: string
) => {
  const member = await database.member.findUnique({
    where: { id: userId },
    select: { role: true, deactivatedAt: true },
  });
  if (
    !member ||
    member.deactivatedAt ||
    (member.role !== "ADMIN" && member.role !== "TEACHER")
  ) {
    return false;
  }
  if (
    pathname === "/gestao/administracao" ||
    pathname.startsWith("/gestao/administracao/")
  ) {
    return member.role === "ADMIN";
  }
  const pathCohortId = cohortPathPattern.exec(pathname)?.[1];
  const cohortId =
    pathCohortId === "nova"
      ? selectedCohortId
      : (pathCohortId ?? selectedCohortId);
  if (!cohortId || member.role === "ADMIN") {
    return true;
  }
  return Boolean(
    await database.cohort.findFirst({
      where: {
        id: cohortId,
        ...(pathCohortId ? {} : { archivedAt: null }),
        teachers: { some: { memberId: userId } },
      },
      select: { id: true },
    })
  );
};
