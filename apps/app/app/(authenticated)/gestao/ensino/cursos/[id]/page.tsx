import { requireGestaoAction } from "@/lib/gestao-authorization";
import { AdminCourseEditor } from "../../../../admin/learning/courses/[id]/editor";

const GestaoCourseEditorPage = async ({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) => {
  await requireGestaoAction("content.manage");
  return <AdminCourseEditor gestao params={params} />;
};

export default GestaoCourseEditorPage;
