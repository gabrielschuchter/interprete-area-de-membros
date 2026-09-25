import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { CommunityStartPanel } from "@/components/community/community-start-panel";
import { getCommunitySpaces } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

const NewCommunityContentPage = async () => {
  await requireMemberId();
  const spaces = await getCommunitySpaces();

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/comunidade">
            <ArrowLeftIcon aria-hidden="true" /> Voltar para a comunidade
          </Link>
        </Button>
        <header className="mt-8 max-w-3xl">
          <p className="brand-eyebrow">Escrita · comunidade</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            O que você quer colocar em movimento?
          </h1>
          <p className="mt-5 text-muted-foreground leading-7 sm:text-lg">
            Todo membro pode escrever. Escolha uma publicação mais elaborada ou
            abra uma discussão rápida; em ambos os casos, seu rascunho fica
            salvo enquanto você pensa.
          </p>
        </header>
        <CommunityStartPanel
          spaces={spaces.map(({ id, title }) => ({ id, title }))}
        />
      </main>
    </div>
  );
};

export default NewCommunityContentPage;
