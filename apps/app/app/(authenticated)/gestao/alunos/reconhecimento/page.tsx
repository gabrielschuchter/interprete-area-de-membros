import Link from "next/link";
import { forbidden } from "next/navigation";
import { listGestaoRecognition } from "@/lib/gestao-recognition";
import { GestaoPageHeading } from "../../gestao-shell";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const visibleAwardees = 8;

const GestaoRecognitionPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  if (Object.values(params).some(Array.isArray)) {
    forbidden();
  }
  const cohortId = typeof params.turma === "string" ? params.turma : undefined;
  const badgeId =
    typeof params.medalha === "string" ? params.medalha : undefined;
  const { actor, badges, cohorts, allBadges } = await listGestaoRecognition({
    cohortId,
    badgeId,
  });
  return (
    <section className="gx-page">
      <GestaoPageHeading
        description="Quem conquistou cada medalha. As conquistas vêm do critério avaliado no servidor."
        eyebrow="Gestão · Alunos"
        title="Reconhecimento"
      >
        {actor.role === "ADMIN" ? (
          <Link
            className="gx-button-outline"
            href="/gestao/administracao/medalhas"
          >
            Configurar medalhas
          </Link>
        ) : null}
      </GestaoPageHeading>
      <form
        action="/gestao/alunos/reconhecimento"
        className="gx-filters"
        method="get"
      >
        <select
          aria-label="Medalha"
          defaultValue={badgeId ?? ""}
          name="medalha"
        >
          <option value="">Todas as medalhas</option>
          {allBadges.map((badge) => (
            <option key={badge.id} value={badge.id}>
              {badge.title}
            </option>
          ))}
        </select>
        <select aria-label="Turma" defaultValue={cohortId ?? ""} name="turma">
          <option value="">Todas as turmas</option>
          {cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.name}
            </option>
          ))}
        </select>
        <button className="gx-button" type="submit">
          Filtrar
        </button>
        {badgeId || cohortId ? (
          <Link className="gx-link" href="/gestao/alunos/reconhecimento">
            Limpar filtros
          </Link>
        ) : null}
      </form>
      {badges.length === 0 ? (
        <div className="gestao-empty-state">
          <h2>Nenhuma medalha publicada</h2>
          <p>As medalhas publicadas aparecem aqui com quem as conquistou.</p>
        </div>
      ) : (
        <div className="gx-grid">
          {badges.map((badge) => (
            <article className="gx-card" key={badge.id}>
              <div className="gx-card-heading">
                <h2>{badge.title}</h2>
                <span className="gx-muted">
                  {badge.awards.length}{" "}
                  {badge.awards.length === 1 ? "conquista" : "conquistas"}
                </span>
              </div>
              <p className="gx-muted">{badge.description}</p>
              {badge.awards.length === 0 ? (
                <p className="gx-muted">Ninguém conquistou ainda.</p>
              ) : (
                <ul className="gx-list">
                  {badge.awards.slice(0, visibleAwardees).map((award) => (
                    <li key={award.id}>
                      <Link href={`/gestao/alunos/perfil/${award.member.id}`}>
                        <strong>{award.member.displayName ?? "Aluno"}</strong>
                        <span>{dateFormat.format(award.awardedAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {badge.awards.length > visibleAwardees ? (
                <p className="gx-muted">
                  e mais {badge.awards.length - visibleAwardees}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default GestaoRecognitionPage;
