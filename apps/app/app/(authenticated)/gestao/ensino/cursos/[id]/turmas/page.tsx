import { notFound } from "next/navigation";
import { getGestaoCourseAccessPage } from "@/lib/gestao-course-access";
import { GestaoCourseHeader } from "../course-header";
import { CourseAccessManager } from "./course-access-manager";

type SearchParameters = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const CourseAccessPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<SearchParameters>;
}) => {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const data = await getGestaoCourseAccessPage({
    courseId: id,
    cohortPage: first(search.turma_pagina),
    cohortQuery: first(search.turma_busca),
    cohortCandidatePage: first(search.candidata_pagina),
    cohortCandidateQuery: first(search.candidata_busca),
    memberQuery: first(search.membro_busca),
    memberPage: first(search.membro_pagina),
    directSourcePage: first(search.acesso_pagina),
    directLegacyPage: first(search.legado_pagina),
  });
  if (!data) {
    notFound();
  }

  return (
    <div className="gca-page gca-page--embedded">
      <GestaoCourseHeader active="acesso" course={data.course} />
      <CourseAccessManager
        actorRole={data.actorRole}
        candidateCohortPage={data.candidateCohortPage}
        candidateCohortQuery={data.candidateCohortQuery}
        candidateCohorts={data.candidateCohorts}
        candidateCohortTotalCount={data.candidateCohortTotalCount}
        candidateCohortTotalPages={data.candidateCohortTotalPages}
        cohortAccesses={data.cohortAccesses}
        cohortPage={data.cohortPage}
        cohortQuery={data.cohortQuery}
        cohortTotalCount={data.cohortTotalCount}
        cohortTotalPages={data.cohortTotalPages}
        courseId={data.course.id}
        courseStatus={data.course.status}
        directGrantCount={data.directGrantCount}
        directGrants={data.directGrants}
        directLegacyGrantCount={data.directLegacyGrantCount}
        directLegacyGrantPage={data.directLegacyGrantPage}
        directLegacyGrantTotalPages={data.directLegacyGrantTotalPages}
        directSourceGrantCount={data.directSourceGrantCount}
        directSourceGrantPage={data.directSourceGrantPage}
        directSourceGrantTotalPages={data.directSourceGrantTotalPages}
        memberCount={data.memberCount}
        memberPage={data.memberPage}
        memberQuery={data.memberQuery}
        members={data.members}
        memberTotalPages={data.memberTotalPages}
        openAccess={data.openAccess}
      />
    </div>
  );
};

export default CourseAccessPage;
