import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewTopicComposer } from "@/components/community/new-topic-composer";
import { getCommunitySpaces } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

interface NewPostPageProperties {
  readonly params: Promise<{ spaceSlug: string }>;
}

const NewPostPage = async ({ params }: NewPostPageProperties) => {
  const { spaceSlug } = await params;
  await requireMemberId();
  const spaces = await getCommunitySpaces();
  const space = spaces.find(({ slug }) => slug === spaceSlug);
  if (!space) {
    notFound();
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[920px] px-5 py-8 sm:px-8 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href={`/comunidade/${space.slug}`}>
            <ArrowLeftIcon aria-hidden="true" /> Voltar para {space.title}
          </Link>
        </Button>
        <header className="mt-8 max-w-3xl">
          <p className="brand-eyebrow">{space.title} · publicação editorial</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            O que você quer investigar?
          </h1>
          <p className="mt-5 text-muted-foreground leading-7">
            Dê contexto, registre o que você já observou e convide outras
            pessoas a pensar junto.
          </p>
        </header>
        <NewTopicComposer
          initialSpaceId={space.id}
          initialSpaceSlug={space.slug}
          spaces={spaces.map(({ id, slug, title }) => ({ id, slug, title }))}
        />
      </main>
    </div>
  );
};

export default NewPostPage;
