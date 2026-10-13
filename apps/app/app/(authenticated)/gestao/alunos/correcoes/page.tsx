import { forbidden, notFound } from "next/navigation";
import { GestaoCorrectionQueue } from "@/components/gestao/correction-queue";
import { getGestaoCorrectionQueue } from "@/lib/gestao-corrections";

interface GestaoCorrectionsPageProperties {
  readonly searchParams: Promise<{
    readonly entrega?: string;
    readonly estado?: string;
    readonly pagina?: string;
    readonly q?: string;
    readonly resultado?: string;
    readonly turma?: string;
  }>;
}

const GestaoCorrectionsPage = async ({
  searchParams,
}: GestaoCorrectionsPageProperties) => {
  const params = await searchParams;
  if (Array.isArray(params.turma)) {
    forbidden();
  }
  const data = await getGestaoCorrectionQueue({
    selectedSubmissionId: params.entrega,
    status: params.estado,
    page: Number(params.pagina),
    query: params.q,
    cohortId: params.turma,
  });
  if (params.entrega && !data.selectedSubmission) {
    notFound();
  }
  return (
    <GestaoCorrectionQueue
      basePath="/gestao/alunos/correcoes"
      data={data}
      result={params.resultado}
    />
  );
};

export default GestaoCorrectionsPage;
