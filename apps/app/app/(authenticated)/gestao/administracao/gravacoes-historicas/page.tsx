import Link from "next/link";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  getGestaoRecordingGroups,
  getGestaoRecordingHistory,
} from "@/lib/gestao-recordings";
import {
  recordingActionLabels,
  recordingTabParam,
} from "@/lib/gestao-recordings-domain";
import { RecordingThumbnailUploader } from "../../../admin/gravacoes/recording-thumbnail-uploader";
import { GestaoCrumbTail } from "../../gestao-crumbs";
import { GestaoIcon } from "../../gestao-icon";
import { revokeGestaoRecordingGroup } from "./actions";
import { LinkPanel } from "./link-panel";

const base = "/gestao/administracao/gravacoes-historicas";

const messages: Record<string, string> = {
  invalido: "Grupo inválido.",
  revogado: "Vínculo revogado. A conta deixou de ler este grupo.",
  vinculado: "Grupo vinculado e registrado no histórico.",
};

const hrefFor = (
  tab: string,
  group: string | null,
  query: string | undefined
) => {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (group) {
    params.set("grupo", group);
  }
  if (query) {
    params.set("q", query);
  }
  return `${base}?${params.toString()}`;
};

const StatusChip = ({ linked }: { readonly linked: boolean }) => (
  <span className="gk-chip" data-tone={linked ? "active" : "danger"}>
    <GestaoIcon name={linked ? "check-circle" : "alert-circle"} size={13} />
    {linked ? "Vinculado" : "Sem vínculo"}
  </span>
);

type History = Awaited<ReturnType<typeof getGestaoRecordingHistory>>;

const HistoryCard = ({ history }: { readonly history: History }) => (
  <article className="gk-card">
    <h3 className="gk-card-title">Histórico deste grupo</h3>
    {history.length === 0 ? (
      <p className="gk-hint">Ainda sem decisões registradas.</p>
    ) : (
      <ul className="gk-history">
        {history.map((entry) => (
          <li key={entry.id}>
            {entry.createdAt.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}{" "}
            · {recordingActionLabels[entry.action] ?? entry.action}
            {entry.member?.displayName ? ` · ${entry.member.displayName}` : ""}
            {entry.note ? <small>Evidência: {entry.note}</small> : null}
          </li>
        ))}
      </ul>
    )}
  </article>
);

const CoversCard = ({
  recordings,
}: {
  readonly recordings: readonly {
    readonly asset: { readonly title: string };
    readonly id: string;
    readonly originalTitle: string | null;
    readonly thumbnailPath: string | null;
  }[];
}) => (
  <details className="gk-card gk-rec-covers">
    <summary>Capas das gravações · {recordings.length} itens</summary>
    <div className="gk-rec-cover-grid">
      {recordings.map((recording) => (
        <div key={recording.id}>
          <p>{recording.originalTitle ?? recording.asset.title}</p>
          <RecordingThumbnailUploader
            recordingId={recording.id}
            thumbnailPath={recording.thumbnailPath}
          />
        </div>
      ))}
    </div>
  </details>
);

const GestaoHistoricalRecordingsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const params = await searchParams;
  await requireGestaoAction("recordings.manage");
  const data = await getGestaoRecordingGroups({
    query: params.q,
    tab: params.tab,
  });
  const selected =
    data.visible.find((group) => group.id === params.grupo) ??
    data.visible[0] ??
    null;
  const history = selected ? await getGestaoRecordingHistory(selected.id) : [];
  const tabKey = recordingTabParam[data.tab];
  const selectedIndex = selected
    ? data.visible.findIndex((group) => group.id === selected.id)
    : -1;
  const next =
    selectedIndex >= 0 && data.visible.length > 1
      ? data.visible[(selectedIndex + 1) % data.visible.length]
      : null;
  const message = params.resultado ? messages[params.resultado] : null;

  return (
    <section className="gt-page">
      {selected ? (
        <GestaoCrumbTail items={[{ label: selected.legacyStudentName }]} />
      ) : null}
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Gravações históricas</h1>
          <p>
            {data.total} grupos preservados, um de cada vez. Diferente de
            “Minhas gravações”, que é a experiência do aluno.
          </p>
        </div>
        <div className="gk-head-actions">
          <Link
            className="gk-link-btn gk-link-btn--accent"
            href="/encontros/gravacoes"
            prefetch={false}
          >
            Abrir arquivo
          </Link>
        </div>
      </header>

      {message ? <output className="gk-result">{message}</output> : null}

      <div className="gk-access-grid gk-rec-grid">
        <aside className="gk-access-list">
          <form action={base} method="get">
            <input name="tab" type="hidden" value={tabKey} />
            <label className="gk-field">
              <GestaoIcon name="search" size={16} />
              <input
                aria-label="Buscar grupo"
                className="gk-input"
                defaultValue={data.query}
                name="q"
                placeholder="Buscar grupo"
              />
            </label>
          </form>
          <nav
            aria-label="Situação"
            className="gk-segmented gk-segmented--full"
          >
            {(
              [
                ["pending", `Sem vínculo · ${data.pending}`],
                ["linked", "Vinculados"],
                ["all", "Todos"],
              ] as const
            ).map(([key, label]) => (
              <Link
                aria-current={data.tab === key ? "page" : undefined}
                className="gk-segmented-item"
                href={hrefFor(recordingTabParam[key], null, data.query)}
                key={key}
                prefetch={false}
              >
                {label}
              </Link>
            ))}
          </nav>
          <ul>
            {data.visible.map((group) => (
              <li
                aria-current={group.id === selected?.id ? "true" : undefined}
                key={group.id}
              >
                <Link
                  href={hrefFor(tabKey, group.id, data.query)}
                  prefetch={false}
                >
                  <span>
                    <strong>{group.legacyStudentName}</strong>
                    <small>{group.videos} gravações</small>
                  </span>
                  <StatusChip linked={group.linked} />
                </Link>
              </li>
            ))}
            {data.visible.length === 0 ? (
              <li className="gk-pickmenu-empty">
                {data.tab === "pending"
                  ? "Nenhum grupo aguardando vínculo."
                  : "Nenhum grupo encontrado."}
              </li>
            ) : null}
          </ul>
        </aside>

        {selected ? (
          <div className="gk-rec-detail">
            <article className="gk-card">
              <div className="gk-rec-title">
                <h2>{selected.legacyStudentName}</h2>
                <StatusChip linked={selected.linked} />
              </div>
              <p className="gk-hint">
                {selected.legacyModule.title} · Origem:{" "}
                {selected.sourcePlatform} · identificador preservado:{" "}
                {selected.sourceId}
              </p>
              <p className="gk-rec-counts">
                <strong>{selected.videos}</strong> gravações{" "}
                <strong>{selected.attachments}</strong> anexos{" "}
                <span>
                  {selected.member?.displayName
                    ? `vinculado a ${selected.member.displayName}`
                    : "nenhum membro vinculado"}
                </span>
              </p>
              <div className="gk-info-box">
                <GestaoIcon name="check-circle" size={20} />
                <div>
                  <strong>
                    A associação altera apenas a autorização de leitura.
                  </strong>
                  <span>
                    Os arquivos e os caminhos do armazenamento não são movidos.
                  </span>
                </div>
              </div>
            </article>

            <LinkPanel
              attachments={selected.attachments}
              currentName={selected.member?.displayName ?? null}
              groupId={selected.id}
              key={selected.id}
              linked={selected.linked}
              skipHref={next ? hrefFor(tabKey, next.id, data.query) : null}
              videos={selected.videos}
            />

            {selected.linked ? (
              <form action={revokeGestaoRecordingGroup} className="gk-card">
                <input name="groupId" type="hidden" value={selected.id} />
                <h3 className="gk-card-title">Revogar vínculo</h3>
                <p className="gk-hint">
                  A conta atual deixa de ler este grupo. O histórico fica
                  registrado.
                </p>
                <button className="gk-btn" type="submit">
                  Revogar acesso
                </button>
              </form>
            ) : null}

            <HistoryCard history={history} />

            <CoversCard recordings={selected.recordings} />
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default GestaoHistoricalRecordingsPage;
