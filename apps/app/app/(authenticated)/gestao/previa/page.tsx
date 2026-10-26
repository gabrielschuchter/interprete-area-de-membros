import { database } from "@repo/database";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import { getGestaoCorrectionCohortScope } from "@/lib/gestao-correction-scope";
import { isPreviewAvailable } from "@/lib/preview-session";
import { PreviewChooser } from "./preview-chooser";

const GestaoPreviewPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const [params, actor] = await Promise.all([
    searchParams,
    requireGestaoActor(),
  ]);
  const cohorts = await database.cohort.findMany({
    where: {
      ...getGestaoCorrectionCohortScope(actor),
      memberships: {
        some: {
          leftAt: null,
          member: { is: { deactivatedAt: null, role: "MEMBER" } },
          status: "ACTIVE",
        },
      },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
    take: 200,
  });
  return (
    <section className="gt-page">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Ver como aluno</h1>
          <p>
            Abra a área de membros como um aluno a veria, sem poder alterar
            nada.
          </p>
        </div>
      </header>
      <div className="gk-person-main gk-narrow">
        {isPreviewAvailable() ? (
          <PreviewChooser cohorts={cohorts} from={params.from ?? ""} />
        ) : (
          <p className="gk-info-box">
            A prévia ainda não está configurada neste ambiente: falta o segredo
            que assina a sessão de prévia.
          </p>
        )}
      </div>
    </section>
  );
};

export default GestaoPreviewPage;
