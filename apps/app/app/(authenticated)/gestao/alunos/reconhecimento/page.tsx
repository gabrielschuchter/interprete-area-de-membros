import Link from "next/link";
import { forbidden } from "next/navigation";
import { listGestaoRecognition } from "@/lib/gestao-recognition";
import { GestaoFilterBar } from "../../gestao-filter-bar";
import { GestaoIcon } from "../../gestao-icon";

const visibleAwardees = 6;
const whitespace = /\s+/;

const periods = [
  ["7", "Últimos 7 dias"],
  ["30", "Últimos 30 dias"],
  ["90", "Últimos 90 dias"],
] as const;

const initials = (name: string) =>
  name
    .split(whitespace)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const single = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

const Medal = ({
  imageUrl,
  title,
}: {
  readonly imageUrl: string | null;
  readonly title: string;
}) =>
  imageUrl ? (
    // biome-ignore lint/performance/noImgElement: símbolo vindo de armazenamento externo, tamanho fixo
    <img alt="" className="gk-medal" height={60} src={imageUrl} width={60} />
  ) : (
    <span
      aria-hidden="true"
      className="gk-medal gk-medal--default"
      title={title}
    >
      <GestaoIcon name="star" size={26} />
    </span>
  );

const GestaoRecognitionPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  if (Object.values(params).some(Array.isArray)) {
    forbidden();
  }
  const cohortId = single(params.turma);
  const badgeId = single(params.medalha);
  const query = single(params.q)?.slice(0, 120) ?? "";
  const period = periods.find(([value]) => value === params.periodo)?.[0];
  const { actor, badges, cohorts, allBadges } = await listGestaoRecognition({
    badgeId,
    cohortId,
    periodDays: period ? Number(period) : null,
    query,
  });
  const filtered = Boolean(badgeId || cohortId || query || period);

  return (
    <section className="gt-page gk-recognition">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Reconhecimento</h1>
          <p>
            Quem conquistou cada medalha. Os critérios são configurados pela
            administração.
          </p>
        </div>
        {actor.role === "ADMIN" ? (
          <div className="gk-head-actions">
            <Link
              className="gk-link-btn gk-link-btn--accent"
              href="/gestao/administracao/medalhas"
              prefetch={false}
            >
              Configurar medalhas (administração) →
            </Link>
          </div>
        ) : null}
      </header>

      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar aluno ou medalha"
          query={query}
          selects={[
            {
              label: "Medalha",
              options: allBadges.map((badge) => [badge.id, badge.title]),
              param: "medalha",
              value: badgeId ?? "",
            },
            {
              label: "Turma",
              options: cohorts.map((cohort) => [cohort.id, cohort.name]),
              param: "turma",
              value: cohortId ?? "",
            },
            {
              label: "Período",
              options: periods.map(([value, label]) => [value, label]),
              param: "periodo",
              value: period ?? "",
            },
          ]}
        />
      </div>

      {badges.length === 0 ? (
        <p className="gk-hint gk-empty-block">
          {filtered
            ? "Nenhuma medalha com esses filtros."
            : "As medalhas publicadas aparecem aqui com quem as conquistou."}
        </p>
      ) : (
        <div className="gk-medalgrid">
          {badges.map((badge) => (
            <article className="gk-medalcard" key={badge.id}>
              <header>
                <Medal imageUrl={badge.imageUrl} title={badge.title} />
                <div>
                  <h2>{badge.title}</h2>
                  <p>{badge.description}</p>
                </div>
              </header>
              <div className="gk-medalcount">
                <strong>{badge.awards.length}</strong>
                <span>
                  {badge.awards.length === 1 ? "conquista" : "conquistas"}
                </span>
              </div>
              {badge.awards.length === 0 ? (
                <small>Ninguém conquistou ainda.</small>
              ) : (
                <div className="gk-avatarstack">
                  {badge.awards.slice(0, visibleAwardees).map((award) => (
                    <Link
                      aria-label={`${award.member.displayName ?? "Aluno"}, perfil`}
                      className="gk-avatar gk-avatar--lg"
                      href={`/gestao/alunos/perfil/${award.member.id}`}
                      key={award.id}
                      prefetch={false}
                      title={award.member.displayName ?? "Aluno"}
                    >
                      {initials(award.member.displayName ?? "Aluno")}
                    </Link>
                  ))}
                  {badge.awards.length > visibleAwardees ? (
                    <span className="gk-avatarstack-more">
                      +{badge.awards.length - visibleAwardees}
                    </span>
                  ) : null}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default GestaoRecognitionPage;
