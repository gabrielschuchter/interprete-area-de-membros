import { Button } from "@repo/design-system/components/ui/button";
import {
  InboxIcon,
  MessageCircleIcon,
  PencilLineIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { type CommunitySort, communityHref } from "@/lib/community-query";
import { CommunityDraftStarter } from "./community-draft-starter";

interface CommunityEmptyStateProperties {
  readonly hasFilters: boolean;
  readonly query?: string;
  readonly sort: CommunitySort;
}

export const CommunityEmptyState = ({
  hasFilters,
  query,
  sort,
}: CommunityEmptyStateProperties) => {
  const normalizedQuery = query?.trim();
  const isNoResults = hasFilters && sort !== "unanswered";
  let title = "Ainda não há publicações por aqui";
  let description =
    "Comece uma conversa: faça uma pergunta ou compartilhe um artigo que valha a leitura.";

  if (sort === "unanswered") {
    title = "Nenhuma publicação sem resposta.";
    description =
      "Quando uma nova pergunta aparecer, ela ficará disponível aqui até receber uma resposta.";
  } else if (hasFilters) {
    title = normalizedQuery
      ? `Nada encontrado para “${normalizedQuery}”`
      : "Nada encontrado para este recorte.";
    description =
      "Tente outras palavras, ou limpe os filtros para voltar a ver todo o feed.";
  }

  return (
    <section className="paper-surface mt-6 flex flex-col items-center rounded-md border p-8 text-center sm:p-12">
      <div
        aria-hidden="true"
        className="relative mb-5 grid size-16 place-items-center text-[#B9395A]"
      >
        {isNoResults ? (
          <>
            <MessageCircleIcon className="size-12 stroke-[1.5]" />
            <SearchIcon className="absolute right-0 bottom-0 size-6 bg-white stroke-[1.5]" />
          </>
        ) : (
          <InboxIcon className="size-14 stroke-[1.5]" />
        )}
      </div>
      <p className="brand-eyebrow">
        {isNoResults
          ? "Busca ou filtro sem resultado"
          : "Comunidade sem publicações"}
      </p>
      <h3 className="mt-3 font-display text-xl">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground leading-7">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hasFilters && (
          <Button asChild variant="outline">
            <Link href={communityHref()}>Limpar filtros</Link>
          </Button>
        )}
        {!hasFilters && (
          <>
            <CommunityDraftStarter>
              <PencilLineIcon aria-hidden="true" /> Nova publicação
            </CommunityDraftStarter>
            <Button asChild variant="outline">
              <Link href="/comunidade/grupos">Ver grupos</Link>
            </Button>
          </>
        )}
      </div>
    </section>
  );
};
