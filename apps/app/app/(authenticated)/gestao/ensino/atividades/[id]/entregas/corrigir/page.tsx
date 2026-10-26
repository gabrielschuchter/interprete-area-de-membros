import { notFound } from "next/navigation";
import { GestaoCorrectionQueue } from "@/components/gestao/correction-queue";
import { getGestaoCorrectionQueue } from "@/lib/gestao-corrections";

interface GestaoActivitySubmissionsPageProperties {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<{
    readonly entrega?: string;
    readonly estado?: string;
    readonly pagina?: string;
    readonly q?: string;
    readonly resultado?: string;
    readonly turma?: string;
  }>;
}

const GestaoActivitySubmissionsPage = async ({
  params,
  searchParams,
}: GestaoActivitySubmissionsPageProperties) => {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getGestaoCorrectionQueue({
    activityId: id,
    selectedSubmissionId: query.entrega,
    status: query.estado,
    page: Number(query.pagina),
    query: query.q,
    cohortId: query.turma,
  });
  if (!data.activity || (query.entrega && !data.selectedSubmission)) {
    notFound();
  }
  return (
    <GestaoCorrectionQueue
      basePath={`/gestao/ensino/atividades/${id}/entregas/corrigir`}
      data={data}
      result={query.resultado}
    />
  );
};

export default GestaoActivitySubmissionsPage;
