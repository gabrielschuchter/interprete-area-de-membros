import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommunitySpace } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { createPost } from "../../actions";

interface NewPostPageProperties {
  readonly params: Promise<{ spaceSlug: string }>;
}

const NewPostPage = async ({ params }: NewPostPageProperties) => {
  const { spaceSlug } = await params;
  const memberId = await requireMemberId();
  const space = await getCommunitySpace(spaceSlug, memberId);

  if (!space) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:py-16">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        href={`/comunidade/${space.slug}`}
      >
        ← Voltar para {space.title}
      </Link>
      <p className="brand-eyebrow mt-10">{space.title} · nova pergunta</p>
      <h1 className="mt-4 font-display text-5xl leading-none">
        O que você quer investigar?
      </h1>
      <p className="mt-5 max-w-2xl text-muted-foreground leading-7">
        Uma boa pergunta dá contexto, mostra onde está a dúvida e convida outras
        pessoas a pensar junto.
      </p>
      <form
        action={createPost}
        className="paper-surface mt-10 space-y-6 border p-6 sm:p-10"
      >
        <input name="spaceId" type="hidden" value={space.id} />
        <input name="spaceSlug" type="hidden" value={space.slug} />
        <label className="block" htmlFor="post-title">
          <span className="brand-eyebrow">Título da pergunta</span>
          <Input
            className="mt-2"
            id="post-title"
            name="title"
            placeholder="Como vocês interpretam este resultado?"
            required
          />
        </label>
        <label className="block" htmlFor="post-content">
          <span className="brand-eyebrow">Contexto</span>
          <Textarea
            className="mt-2 min-h-56"
            id="post-content"
            name="content"
            placeholder="Compartilhe o que você já observou, leu ou tentou..."
            required
          />
        </label>
        <div className="flex justify-end gap-3 border-border border-t pt-6">
          <Button asChild variant="ghost">
            <Link href={`/comunidade/${space.slug}`}>Cancelar</Link>
          </Button>
          <Button type="submit">Publicar pergunta</Button>
        </div>
      </form>
    </main>
  );
};

export default NewPostPage;
