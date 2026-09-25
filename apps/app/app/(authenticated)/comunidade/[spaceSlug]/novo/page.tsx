import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityStartPanel } from "@/components/community/community-start-panel";
import { getCommunitySpaces } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

interface NewCommunitySpacePageProperties {
  readonly params: Promise<{ spaceSlug: string }>;
}

const NewCommunitySpacePage = async ({
  params,
}: NewCommunitySpacePageProperties) => {
  const { spaceSlug } = await params;
  await requireMemberId();
  const spaces = await getCommunitySpaces();
  const space = spaces.find(({ slug }) => slug === spaceSlug);
  if (!space) {
    notFound();
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href={`/comunidade/${space.slug}`}>
            <ArrowLeftIcon aria-hidden="true" /> Voltar para {space.title}
          </Link>
        </Button>
        <header className="mt-8 max-w-3xl">
          <p className="brand-eyebrow">{space.title} · escrita</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            Compartilhe algo que vale uma conversa.
          </h1>
          <p className="mt-5 text-muted-foreground leading-7 sm:text-lg">
            Escolha o formato. O conteúdo continuará sendo seu, e você poderá
            editar ou apagar a publicação quando quiser.
          </p>
        </header>
        <CommunityStartPanel
          initialSpaceId={space.id}
          spaces={spaces.map(({ id, title }) => ({ id, title }))}
        />
      </main>
    </div>
  );
};

export default NewCommunitySpacePage;
