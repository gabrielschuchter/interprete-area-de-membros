"use client";

import type { getGestaoCourseAccessPage } from "@/lib/gestao-course-access";
import { CohortCourseAccessPanel } from "./cohort-course-access-panel";
import { DirectCourseAccessPanel } from "./direct-course-access-panel";
import { OpenCourseAccessPanel } from "./open-course-access-panel";

type CourseAccessPage = NonNullable<
  Awaited<ReturnType<typeof getGestaoCourseAccessPage>>
>;

export const CourseAccessManager = ({
  actorRole,
  candidateCohorts,
  candidateCohortPage,
  candidateCohortQuery,
  candidateCohortTotalCount,
  candidateCohortTotalPages,
  cohortAccesses,
  cohortPage,
  cohortQuery,
  cohortTotalCount,
  cohortTotalPages,
  courseId,
  courseStatus,
  directGrantCount,
  directLegacyGrantCount,
  directGrants,
  directLegacyGrantPage,
  directLegacyGrantTotalPages,
  directSourceGrantCount,
  directSourceGrantPage,
  directSourceGrantTotalPages,
  memberCount,
  memberPage,
  memberQuery,
  memberTotalPages,
  members,
  openAccess,
}: Pick<
  CourseAccessPage,
  | "actorRole"
  | "candidateCohorts"
  | "candidateCohortPage"
  | "candidateCohortQuery"
  | "candidateCohortTotalCount"
  | "candidateCohortTotalPages"
  | "cohortAccesses"
  | "cohortPage"
  | "cohortQuery"
  | "cohortTotalCount"
  | "cohortTotalPages"
  | "directGrantCount"
  | "directLegacyGrantCount"
  | "directGrants"
  | "directLegacyGrantPage"
  | "directLegacyGrantTotalPages"
  | "directSourceGrantCount"
  | "directSourceGrantPage"
  | "directSourceGrantTotalPages"
  | "memberCount"
  | "memberPage"
  | "memberQuery"
  | "memberTotalPages"
  | "members"
  | "openAccess"
> & { readonly courseId: string; readonly courseStatus: string }) => (
  <div className="gca-content">
    <CohortCourseAccessPanel
      candidateCohortPage={candidateCohortPage}
      candidateCohortQuery={candidateCohortQuery}
      candidateCohorts={candidateCohorts}
      candidateCohortTotalCount={candidateCohortTotalCount}
      candidateCohortTotalPages={candidateCohortTotalPages}
      cohortAccesses={cohortAccesses}
      cohortPage={cohortPage}
      cohortQuery={cohortQuery}
      cohortTotalCount={cohortTotalCount}
      cohortTotalPages={cohortTotalPages}
      courseId={courseId}
      courseStatus={courseStatus}
    />
    {actorRole === "ADMIN" ? (
      <DirectCourseAccessPanel
        courseId={courseId}
        directGrantCount={directGrantCount}
        directGrants={directGrants}
        directLegacyGrantCount={directLegacyGrantCount}
        directLegacyGrantPage={directLegacyGrantPage}
        directLegacyGrantTotalPages={directLegacyGrantTotalPages}
        directSourceGrantCount={directSourceGrantCount}
        directSourceGrantPage={directSourceGrantPage}
        directSourceGrantTotalPages={directSourceGrantTotalPages}
        memberCount={memberCount}
        memberPage={memberPage}
        memberQuery={memberQuery}
        members={members}
        memberTotalPages={memberTotalPages}
      />
    ) : null}
    <OpenCourseAccessPanel
      actorRole={actorRole}
      courseId={courseId}
      courseStatus={courseStatus}
      openAccess={openAccess}
    />
  </div>
);
