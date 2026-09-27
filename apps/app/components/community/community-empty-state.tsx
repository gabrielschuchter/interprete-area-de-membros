import { Button } from "@repo/design-system/components/ui/button";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import type { CommunityPostKindValue } from "@/lib/community-post-types";
import { type CommunitySort, communityHref } from "@/lib/community-query";

interface CommunityEmptyStateProperties {
  readonly hasFilters: boolean;
  readonly kind?: CommunityPostKindValue;
  readonly sort: CommunitySort;
}

export const CommunityEmptyState = ({
  hasFilters,
  kind,
  sort,
}: CommunityEmptyStateProperties) => {
  let title = "A primeira ideia pode começar aqui.";
  let description =
    "Escreva uma publicação para colocar uma ideia em movimento.";

  if (sort === "unanswered") {
    title =
      kind === "QUESTION"
        ? "Nenhuma pergunta sem resposta."
        : "Nenhuma publicação sem resposta.";
    description =
      "Quando uma nova pergunta aparecer, ela ficará disponível aqui até receber uma resposta.";
  } else if (hasFilters) {
    title = "Nenhum resultado para este recorte.";
    description = "Ajuste os filtros ou volte a explorar toda a comunidade.";
  }

  return (
    <div className="paper-surface mt-6 border p-8 sm:p-12">
      <p className="brand-eyebrow">Nenhum conteúdo encontrado</p>
      <h3 className="mt-4 font-display text-3xl">{title}</h3>
      <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {hasFilters && (
          <Button asChild variant="outline">
            <Link href={communityHref()}>Limpar filtros</Link>
          </Button>
        )}
        <Button asChild>
          <Link href="/comunidade/novo">
            <PlusIcon aria-hidden="true" /> Criar conteúdo
          </Link>
        </Button>
      </div>
    </div>
  );
};
