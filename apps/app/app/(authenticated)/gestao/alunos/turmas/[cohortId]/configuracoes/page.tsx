import { notFound } from "next/navigation";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import {
  getGestaoCohortDetail,
  getGestaoTeacherOptions,
} from "@/lib/gestao-cohorts";
import { GestaoCohortHeader } from "../cohort-header";
import { CohortSettingsForm, settingsFormId } from "../cohort-settings-form";

const GestaoCohortSettingsPage = async ({
  params,
}: {
  readonly params: Promise<{ cohortId: string }>;
}) => {
  const [{ cohortId }, actor] = await Promise.all([
    params,
    requireGestaoActor(),
  ]);
  const [cohort, teachers] = await Promise.all([
    getGestaoCohortDetail(cohortId),
    actor.role === "ADMIN" ? getGestaoTeacherOptions() : Promise.resolve([]),
  ]);
  if (!cohort) {
    notFound();
  }
  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader
        action={
          <button
            className="gk-btn gk-btn--primary"
            disabled={cohort.archivedAt !== null}
            form={settingsFormId}
            type="submit"
          >
            Salvar alterações
          </button>
        }
        activeTab="configuracoes"
        cohort={cohort}
      />
      <CohortSettingsForm
        cohort={cohort}
        isAdmin={actor.role === "ADMIN"}
        teachers={teachers}
      />
    </section>
  );
};
export default GestaoCohortSettingsPage;
