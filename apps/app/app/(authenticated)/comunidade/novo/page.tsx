import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { NewTopicComposer } from "@/components/community/new-topic-composer";
import { getCommunitySpaces } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

const NewCommunityTopicPage = async () => {
  await requireMemberId();
  const spaces = await getCommunitySpaces();
  const firstSpace = spaces[0];

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[920px] px-5 py-8 sm:px-8 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/comunidade">
            <ArrowLeftIcon aria-hidden="true" /> Voltar para a comunidade
          </Link>
        </Button>
        <header className="mt-8 max-w-3xl">
          <p className="brand-eyebrow">Publicação editorial · comunidade</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            Coloque uma pergunta em movimento.
          </h1>
          <p className="mt-5 text-muted-foreground leading-7">
            Dê contexto, registre o que você já observou e convide outras
            pessoas a pensar junto.
          </p>
        </header>
        {firstSpace ? (
          <NewTopicComposer
            initialSpaceId={firstSpace.id}
            initialSpaceSlug={firstSpace.slug}
            spaces={spaces.map(({ id, slug, title }) => ({ id, slug, title }))}
          />
        ) : (
          <div className="paper-surface mt-10 border p-8 text-muted-foreground">
            Ainda não há um espaço publicado para receber tópicos.
          </div>
        )}
      </main>
    </div>
  );
};

export default NewCommunityTopicPage;
