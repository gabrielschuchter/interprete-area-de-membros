import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseSectionTabs } from "@/components/gestao/course-section-tabs";
import { getGestaoCourseAccessPage } from "@/lib/gestao-course-access";
import { CourseAccessManager } from "./course-access-manager";
import { CoursePublishControl } from "./course-publish-control";

type SearchParameters = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const statusLabel = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
} as const;

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
    <main className="gca-page">
      <header className="gca-course-heading">
        <div className="gca-course-title-line">
          <h1>{data.course.title}</h1>
          <span
            className={`gca-course-status is-${data.course.status.toLowerCase()}`}
          >
            {statusLabel[data.course.status]}
          </span>
        </div>
        <p className="gca-course-heading-copy">
          Controle as turmas, os acessos individuais e a disponibilidade deste
          curso.
        </p>
        <div className="gca-course-actions">
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/gestao/ensino/cursos/${encodeURIComponent(data.course.id)}/preview`}
              prefetch={false}
            >
              Pré-visualizar como aluno
            </Link>
          </Button>
          <CoursePublishControl courseId={data.course.id} />
        </div>
      </header>
      <CourseSectionTabs active="access" courseId={data.course.id} />
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
    </main>
  );
};

export default CourseAccessPage;
