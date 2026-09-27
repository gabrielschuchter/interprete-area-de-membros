import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import {
  collectionItemHref,
  collectionItemLabel,
  getPublishedCollectionForMember,
} from "@/lib/content-collections";
import { requireMemberId } from "@/lib/learning";

interface CollectionPageProperties {
  readonly params: Promise<{ slug: string }>;
}

const CollectionPage = async ({ params }: CollectionPageProperties) => {
  const memberId = await requireMemberId();
  const { slug } = await params;
  const collection = await getPublishedCollectionForMember(slug, memberId);

  if (!collection) {
    return (
      <LearningPageFrame
        description="Esta curadoria não está disponível para sua conta."
        eyebrow="Curadoria"
        title="Coleção não encontrada."
      >
        <Button asChild variant="outline">
          <Link href="/">
            Voltar para início <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </LearningPageFrame>
    );
  }

  const labelForType = (itemType: string) => {
    if (itemType === "LESSON") {
      return "Aprender";
    }
    if (itemType === "RECORDING") {
      return "Encontro gravado";
    }
    return "Biblioteca";
  };

  return (
    <LearningPageFrame
      description={
        collection.description ??
        "Uma seleção editorial para continuar uma conversa com calma."
      }
      eyebrow="Curadoria · Interprete"
      title={collection.title}
    >
      {collection.items.length === 0 ? (
        <p className="paper-surface border p-8 text-muted-foreground">
          Esta curadoria ainda não tem itens disponíveis para você.
        </p>
      ) : (
        <ol className="divide-y border-y">
          {collection.items.map((item, index) => {
            const href = collectionItemHref(item);
            return (
              <li key={item.id}>
                {href ? (
                  <Link
                    className="group flex items-start gap-5 px-1 py-6 transition-colors hover:bg-muted/30 sm:px-4"
                    href={href}
                  >
                    <span className="font-data text-brand-action text-sm">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-2xl">
                        {collectionItemLabel(item)}
                      </span>
                      <span className="mt-2 block text-muted-foreground text-sm">
                        {labelForType(item.itemType)}
                      </span>
                    </span>
                    <ArrowRightIcon
                      aria-hidden="true"
                      className="mt-1 size-5 shrink-0 text-brand-action transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                ) : (
                  <div className="px-1 py-6 text-muted-foreground text-sm sm:px-4">
                    {collectionItemLabel(item)}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </LearningPageFrame>
  );
};

export default CollectionPage;
