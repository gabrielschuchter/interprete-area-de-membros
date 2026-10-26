import { notFound } from "next/navigation";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { getGestaoMedal } from "@/lib/gestao-medals";
import {
  conquestLabel,
  medalCriterionLabels,
  medalStatusLabel,
  medalStatusTone,
} from "@/lib/gestao-medals-domain";
import { GestaoCrumbTail } from "../../../gestao-crumbs";
import { GestaoIcon } from "../../../gestao-icon";
import { setGestaoMedalStatus } from "../actions";
import { MedalForm } from "../medal-form";
import { MedalStage } from "../medal-stage";

const messages: Record<string, string> = {
  arquivado: "Medalha arquivada. Quem já conquistou continua com ela.",
  criada: "Medalha criada como rascunho. Publique quando estiver pronta.",
  draft: "Medalha despublicada. Ela deixa de aparecer para os alunos.",
  igual: "Nada mudou, então nenhuma versão nova foi criada.",
  published: "Medalha publicada. A regra já vale para todos os alunos.",
  salva: "Alterações salvas em uma nova versão.",
};

const GestaoMedalPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await requireGestaoAction("badges.manage");
  const medal = await getGestaoMedal(id);
  if (!medal) {
    notFound();
  }
  const archived = medal.status === "ARCHIVED";
  const message = query.resultado ? messages[query.resultado] : null;

  return (
    <section className="gt-page">
      <GestaoCrumbTail items={[{ label: medal.title }]} />
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>
            {medal.title}{" "}
            <span className="gk-chip" data-tone={medalStatusTone(medal.status)}>
              <GestaoIcon name="check-circle" size={13} />
              {medalStatusLabel(medal.status)}
            </span>
          </h1>
          <p>
            Medalha · {conquestLabel(medal._count.awards)} · versão{" "}
            {medal.version}
          </p>
        </div>
        <div className="gk-head-actions">
          {archived ? null : (
            <form action={setGestaoMedalStatus}>
              <input name="id" type="hidden" value={medal.id} />
              <input
                name="status"
                type="hidden"
                value={medal.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}
              />
              <button
                className="gk-btn gk-btn--primary gk-btn--wide"
                type="submit"
              >
                {medal.status === "PUBLISHED" ? "Despublicar" : "Publicar"}
              </button>
            </form>
          )}
          {archived ? (
            <form action={setGestaoMedalStatus}>
              <input name="id" type="hidden" value={medal.id} />
              <input name="status" type="hidden" value="DRAFT" />
              <button className="gk-btn" type="submit">
                Restaurar como rascunho
              </button>
            </form>
          ) : (
            <form action={setGestaoMedalStatus}>
              <input name="id" type="hidden" value={medal.id} />
              <input name="status" type="hidden" value="ARCHIVED" />
              <button className="gk-btn" type="submit">
                Arquivar
              </button>
            </form>
          )}
        </div>
      </header>

      {message ? <output className="gk-result">{message}</output> : null}

      <div className="gk-stage-grid">
        <MedalStage
          criterion={medal.criterion}
          threshold={medal.threshold}
          title={medal.title}
        />
        <div className="gk-person-main">
          <section className="gk-card">
            <h2 className="gk-card-title">Símbolo</h2>
            <p className="gk-hint">
              O aluno vê a arte padrão do critério “
              {medalCriterionLabels[medal.criterion]}”. O envio de um símbolo
              próprio (SVG, PNG ou WebP) ainda não está ligado: depende de um
              espaço de armazenamento para símbolos e de a área do aluno passar
              a exibi-lo.
            </p>
          </section>
          {archived ? null : (
            <MedalForm
              awards={medal._count.awards}
              initial={{
                criterion: medal.criterion,
                description: medal.description,
                id: medal.id,
                threshold: medal.threshold,
                title: medal.title,
              }}
            />
          )}
          <section className="gk-card">
            <h2 className="gk-card-title">Histórico de versões</h2>
            <ul className="gk-history">
              {medal.revisions.map((revision) => (
                <li key={revision.version}>
                  v{revision.version} ·{" "}
                  {revision.createdAt.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}{" "}
                  · {medalCriterionLabels[revision.criterion]} ·{" "}
                  {revision.threshold}
                  {revision.version === medal.version ? " · atual" : ""}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
};

export default GestaoMedalPage;
