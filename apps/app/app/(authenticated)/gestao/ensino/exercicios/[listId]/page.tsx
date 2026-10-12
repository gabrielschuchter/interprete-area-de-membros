import { requireGestaoAction } from "@/lib/gestao-authorization";
import { AdminExerciseListPage } from "../../../../admin/exercicios/[listId]/editor";

interface GestaoExerciseListPageProperties {
  readonly params: Promise<{ readonly listId: string }>;
  readonly searchParams: Promise<{ readonly resultado?: string }>;
}

const GestaoExerciseListPage = async ({
  params,
  searchParams,
}: GestaoExerciseListPageProperties) => {
  await requireGestaoAction("content.manage");
  return (
    <AdminExerciseListPage gestao params={params} searchParams={searchParams} />
  );
};

export default GestaoExerciseListPage;
