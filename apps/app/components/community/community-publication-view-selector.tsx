"use client";

import { useRouter } from "next/navigation";

interface CommunityPublicationViewSelectorProperties {
  readonly activeView: "published" | "drafts" | "archived";
  readonly counts: {
    readonly archived: number;
    readonly drafts: number;
    readonly published: number;
  };
  readonly query: string;
  readonly sort: string;
}

const views = [
  { label: "Publicadas", value: "published", count: "published" },
  { label: "Rascunhos", value: "drafts", count: "drafts" },
  { label: "Arquivadas", value: "archived", count: "archived" },
] as const;

export function CommunityPublicationViewSelector({
  activeView,
  counts,
  query,
  sort,
}: CommunityPublicationViewSelectorProperties) {
  const router = useRouter();

  return (
    <label className="community-publications-mobile-status">
      <span className="sr-only">Situação</span>
      <select
        aria-label="Situação das publicações em dispositivos móveis"
        onChange={(event) => {
          const params = new URLSearchParams({ status: event.target.value });
          if (query) {
            params.set("q", query);
          }
          if (sort !== "recent") {
            params.set("sort", sort);
          }
          router.push(`/comunidade/minhas-publicacoes?${params.toString()}`);
        }}
        value={activeView}
      >
        {views.map((view) => (
          <option key={view.value} value={view.value}>
            {view.label} · {counts[view.count]}
          </option>
        ))}
      </select>
    </label>
  );
}
