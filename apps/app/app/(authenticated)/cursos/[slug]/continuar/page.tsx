import { forbidden, notFound, redirect } from "next/navigation";
import { requireMemberId } from "@/lib/learning";
import { resolveContinueLessonHref } from "@/lib/room";

interface ContinueCourseProperties {
  readonly params: Promise<{ slug: string }>;
}

// "Continuar": the lesson studied last that is still open and not done, else
// the first open lesson not done, else the first open one. "continuar" is
// therefore a reserved lesson slug.
const ContinueCourse = async ({ params }: ContinueCourseProperties) => {
  const [{ slug }, memberId] = await Promise.all([params, requireMemberId()]);
  const result = await resolveContinueLessonHref(slug, memberId);
  if (result.status === "not_found") {
    notFound();
  }
  if (result.status === "forbidden") {
    forbidden();
  }
  redirect(result.href);
};

export default ContinueCourse;
