import Link from "next/link";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  type GestaoGroupRow,
  gestaoGroupTabFromParam,
  gestaoGroupTabs,
  getGestaoGroups,
} from "@/lib/gestao-groups";
import { GestaoIcon } from "../../gestao-icon";
import { setGestaoGroupState } from "./actions";
import { ManageGroupButton, NewGroupButton } from "./group-dialogs";

const base = "/gestao/comunidade/grupos";

const statusChips = {
  ARCHIVED: ["archive", "muted", "Arquivado"],
  DRAFT: ["pencil", "neutral", "Rascunho"],
  PUBLISHED: ["check-circle", "active", "Publicado"],
} as const;

const StateButton = ({
  className = "gk-btn",
  id,
  label,
  operation,
}: {
  readonly className?: string;
  readonly id: string;
  readonly label: React.ReactNode;
  readonly operation: string;
}) => (
  <form action={setGestaoGroupState}>
    <input name="id" type="hidden" value={id} />
    <input name="operation" type="hidden" value={operation} />
    <button className={className} type="submit">
      {label}
    </button>
  </form>
);

const GroupCard = ({
  covers,
  group,
}: {
  readonly covers: Awaited<ReturnType<typeof getGestaoGroups>>["covers"];
  readonly group: GestaoGroupRow;
}) => {
  const [icon, tone, label] = statusChips[group.status];
  const live = group.status === "PUBLISHED";
  return (
    <section className="gk-card gk-groupcard">
      <div className="gk-groupcard-head">
        <div className="gk-person">
          <span aria-hidden="true" className="gk-kindtile gk-kindtile--lg">
            <GestaoIcon
              name={group.kind === "institutional" ? "star" : "users"}
              size={20}
            />
          </span>
          <div>
            <h2 className="gk-groupcard-name">{group.title}</h2>
            <span className="gk-mono gk-groupcard-slug">/{group.slug}</span>
          </div>
        </div>
        <span className="gk-chip" data-tone={tone}>
          <GestaoIcon name={icon} size={12} />
          {label}
        </span>
      </div>
      <div className="gk-groupcard-counts">
        <span>
          <b>{group.members}</b> {group.members === 1 ? "membro" : "membros"}
        </span>
        <span>
          <b>{group.posts}</b>{" "}
          {group.posts === 1 ? "publicação" : "publicações"}
        </span>
      </div>
      <div className="gk-groupcard-actions">
        <ManageGroupButton
          covers={covers}
          group={{
            coverUrl: group.coverUrl,
            description: group.description,
            id: group.id,
            kind: group.kind,
            slug: group.slug,
            title: group.title,
          }}
        />
        {live ? (
          <StateButton
            id={group.id}
            label={
              group.commentsClosed
                ? "Reabrir comentários"
                : "Fechar comentários"
            }
            operation={group.commentsClosed ? "open" : "close"}
          />
        ) : (
          <StateButton
            id={group.id}
            label="Publicar grupo"
            operation="publish"
          />
        )}
        {group.status === "ARCHIVED" ? null : (
          <StateButton
            className="gk-link-btn gk-link-btn--muted"
            id={group.id}
            label={
              <>
                <GestaoIcon name="archive" size={16} /> Arquivar
              </>
            }
            operation="archive"
          />
        )}
      </div>
    </section>
  );
};

const GestaoGroupsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  await requireGestaoAction("community.moderate");
  const tab = gestaoGroupTabFromParam(
    typeof params.aba === "string" ? params.aba : undefined
  );
  const { covers, rows } = await getGestaoGroups(tab);

  return (
    <section className="gt-page gk-assignments">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Grupos</h1>
          <p>Grupos de estudo e grupos institucionais.</p>
        </div>
        <div className="gk-head-actions">
          <NewGroupButton covers={covers} />
        </div>
      </header>

      <nav aria-label="Tipo de grupo" className="gk-tabs">
        {gestaoGroupTabs.map(([key, label]) => (
          <Link
            aria-current={tab === key ? "page" : undefined}
            className="gk-tab"
            href={key === "all" ? base : `${base}?aba=${key}`}
            key={key}
            prefetch={false}
          >
            {label}
          </Link>
        ))}
      </nav>

      {rows.length ? (
        <div className="gk-groupgrid">
          {rows.map((group) => (
            <GroupCard covers={covers} group={group} key={group.id} />
          ))}
        </div>
      ) : (
        <p className="gk-hint gk-empty-block">
          Nenhum grupo aqui ainda. Use “Novo grupo” para criar o primeiro.
        </p>
      )}
    </section>
  );
};

export default GestaoGroupsPage;
