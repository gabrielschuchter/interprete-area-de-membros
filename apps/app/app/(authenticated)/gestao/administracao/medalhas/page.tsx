import Image from "next/image";
import Link from "next/link";
import { badgeArtworkByCriterion } from "@/lib/badge-artwork";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { listGestaoMedals } from "@/lib/gestao-medals";
import {
  conquestLabel,
  medalCriterionLabels,
  medalStatusLabel,
  medalStatusTone,
  parseMedalView,
} from "@/lib/gestao-medals-domain";
import { GestaoFilterBar } from "../../gestao-filter-bar";

const base = "/gestao/administracao/medalhas";

const messages: Record<string, string> = {
  indisponivel: "Essa medalha não está mais disponível.",
  invalido: "Revise os campos e tente novamente.",
};

const viewHref = (view: string, params: Record<string, string | undefined>) => {
  const next = new URLSearchParams();
  for (const key of ["q", "estado"]) {
    const value = params[key];
    if (value) {
      next.set(key, value);
    }
  }
  next.set("vista", view);
  return `${base}?${next.toString()}`;
};

const GestaoMedalsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const params = await searchParams;
  await requireGestaoAction("badges.manage");
  const view = parseMedalView(params.vista);
  const medals = await listGestaoMedals({
    query: params.q,
    status: params.estado,
  });
  const message = params.resultado ? messages[params.resultado] : null;

  return (
    <section className="gt-page">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Medalhas</h1>
          <p>
            O museu da escola. Cada medalha tem um símbolo, um critério e uma
            história. Clique para editar.
          </p>
        </div>
        <div className="gk-head-actions">
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href={`${base}/nova`}
            prefetch={false}
          >
            Nova medalha
          </Link>
        </div>
      </header>

      {message ? <output className="gk-result">{message}</output> : null}

      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar medalhas"
          query={params.q ?? ""}
          selects={[
            {
              label: "Estado",
              options: [
                ["publicado", "Publicado"],
                ["rascunho", "Rascunho"],
                ["arquivado", "Arquivado"],
              ],
              param: "estado",
              value: params.estado ?? "",
            },
          ]}
        />
        <nav aria-label="Vista" className="gk-segmented">
          <Link
            aria-current={view === "museu" ? "page" : undefined}
            href={viewHref("museu", params)}
            prefetch={false}
          >
            Museu
          </Link>
          <Link
            aria-current={view === "lista" ? "page" : undefined}
            href={viewHref("lista", params)}
            prefetch={false}
          >
            Lista
          </Link>
        </nav>
      </div>

      {medals.length === 0 ? (
        <p className="gk-hint">Nenhuma medalha encontrada.</p>
      ) : null}

      {view === "museu" && medals.length > 0 ? (
        <>
          <ul className="gk-museum">
            {medals.map((medal) => (
              <li key={medal.id}>
                <Link
                  className="gk-museum-card"
                  href={`${base}/${medal.id}`}
                  prefetch={false}
                >
                  <span className="gk-museum-art">
                    <Image
                      alt=""
                      height={124}
                      src={badgeArtworkByCriterion[medal.criterion]}
                      width={124}
                    />
                    <span aria-hidden="true" className="gk-museum-plinth" />
                  </span>
                  <strong>{medal.title}</strong>
                  <small>
                    {medalCriterionLabels[medal.criterion]} · {medal.threshold}
                  </small>
                  <span>{conquestLabel(medal._count.awards)}</span>
                  <span
                    className="gk-chip"
                    data-tone={medalStatusTone(medal.status)}
                  >
                    {medalStatusLabel(medal.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="gk-hint">
            Os símbolos mostrados são a arte padrão de cada critério, a mesma
            que o aluno vê no perfil.
          </p>
        </>
      ) : null}

      {view === "lista" && medals.length > 0 ? (
        <div className="gk-table-card">
          <table className="gk-table gk-qtable">
            <thead>
              <tr>
                <th>Medalha</th>
                <th>Critério</th>
                <th>Conquistas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {medals.map((medal) => (
                <tr key={medal.id}>
                  <td>
                    <Link
                      className="gk-person"
                      href={`${base}/${medal.id}`}
                      prefetch={false}
                    >
                      <Image
                        alt=""
                        height={36}
                        src={badgeArtworkByCriterion[medal.criterion]}
                        width={36}
                      />
                      <span className="gk-qtitle">{medal.title}</span>
                    </Link>
                  </td>
                  <td>
                    {medalCriterionLabels[medal.criterion]} · {medal.threshold}
                  </td>
                  <td>{medal._count.awards}</td>
                  <td>
                    <span
                      className="gk-chip"
                      data-tone={medalStatusTone(medal.status)}
                    >
                      {medalStatusLabel(medal.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
};

export default GestaoMedalsPage;
