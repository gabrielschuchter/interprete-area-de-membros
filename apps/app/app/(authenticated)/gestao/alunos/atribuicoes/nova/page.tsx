import { database } from "@repo/database";
import { getGestaoAssignmentOptions } from "@/lib/gestao-assignments";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { AssignmentWizard } from "./assignment-wizard";

const GestaoNewAssignmentPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const params = await searchParams;
  const { actor } = await requireGestaoAction("assignments.manage");
  const options = await getGestaoAssignmentOptions(actor);
  const source = params.de
    ? await database.learningAssignmentBatch.findFirst({
        where: {
          id: params.de,
          ...(actor.role === "ADMIN"
            ? {}
            : { createdByMemberId: actor.userId }),
        },
        select: { message: true, targetId: true, targetType: true },
      })
    : null;
  const initialKey =
    source &&
    options.content.some(
      (option) =>
        option.id === source.targetId && option.type === source.targetType
    )
      ? `${source.targetType}:${source.targetId}`
      : "";
  return (
    <AssignmentWizard
      cohorts={options.cohorts}
      content={options.content}
      initialKey={initialKey}
      initialMessage={initialKey ? (source?.message ?? "") : ""}
    />
  );
};

export default GestaoNewAssignmentPage;
