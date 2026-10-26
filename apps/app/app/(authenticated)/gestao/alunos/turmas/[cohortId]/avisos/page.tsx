import { notFound } from "next/navigation";
import { requireGestaoCohortActor } from "@/lib/gestao-authorization";
import { getCohortNotices } from "@/lib/gestao-cohort-notices";
import { getGestaoCohortDetail } from "@/lib/gestao-cohorts";
import { GestaoIcon } from "../../../../gestao-icon";
import { GestaoCohortHeader } from "../cohort-header";
import { endCohortNotice, toggleCohortNoticePin } from "./actions";
import { CohortNoticeForm } from "./notice-form";

const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const chips = {
  ended: { icon: "archive", label: "Encerrado", tone: "neutral" },
  published: { icon: "check-circle", label: "Publicado", tone: "active" },
  scheduled: { icon: "clock", label: "Agendado", tone: "warning" },
} as const;

const period = (start: Date | null, end: Date | null) => {
  if (start && end) {
    return `${dayFormat.format(start)} a ${dayFormat.format(end)}`;
  }
  if (start) {
    return `a partir de ${dayFormat.format(start)}`;
  }
  return end ? `até ${dayFormat.format(end)}` : "Sem período";
};

const GestaoCohortNoticesPage = async ({
  params,
}: {
  readonly params: Promise<{ cohortId: string }>;
}) => {
  const { cohortId } = await params;
  await requireGestaoCohortActor(cohortId);
  const cohort = await getGestaoCohortDetail(cohortId);
  if (!cohort) {
    notFound();
  }
  const notices = await getCohortNotices(cohortId);
  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader activeTab="avisos" cohort={cohort} />
      <CohortNoticeForm
        cohortId={cohortId}
        students={cohort.activeStudentCount}
      />
      {notices.length > 0 ? (
        <div className="gk-table-card">
          <table className="gk-table">
            <thead>
              <tr>
                <th>Aviso</th>
                <th>Período</th>
                <th>Estado</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {notices.map((notice) => {
                const chip = chips[notice.state];
                return (
                  <tr key={notice.id}>
                    <td>
                      <div className="gk-person">
                        <span aria-hidden="true" className="gk-icon-tile">
                          <GestaoIcon name="bell" size={18} />
                        </span>
                        <span className="gk-row-copy">
                          <strong>{notice.title}</strong>
                          <small>
                            {notice.isPinned ? "Fixado · " : ""}
                            {notice.recipients}{" "}
                            {notice.recipients === 1 ? "aluno" : "alunos"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>{period(notice.startsAt, notice.endsAt)}</td>
                    <td>
                      <span className="gk-chip" data-tone={chip.tone}>
                        <GestaoIcon name={chip.icon} size={12} />
                        {chip.label}
                      </span>
                    </td>
                    <td className="gk-col-menu">
                      <div className="gk-row-actions">
                        <form action={toggleCohortNoticePin}>
                          <input
                            name="cohortId"
                            type="hidden"
                            value={cohortId}
                          />
                          <input name="id" type="hidden" value={notice.id} />
                          <button className="gk-text-btn" type="submit">
                            {notice.isPinned ? "Soltar" : "Fixar"}
                          </button>
                        </form>
                        {notice.state === "ended" ? null : (
                          <form action={endCohortNotice}>
                            <input
                              name="cohortId"
                              type="hidden"
                              value={cohortId}
                            />
                            <input name="id" type="hidden" value={notice.id} />
                            <button className="gk-text-btn" type="submit">
                              Encerrar
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="gk-panel">
          <h2 className="gk-panel-title">Nenhum aviso para esta turma</h2>
          <p className="gk-empty">
            O primeiro aviso aparece aqui e na Comunidade dos alunos da turma.
          </p>
        </div>
      )}
    </section>
  );
};

export default GestaoCohortNoticesPage;
