import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { ArrowLeftIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopicEditor } from "@/components/community/topic-editor";
import { getCommunitySpaces } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";
import { MemberHeader } from "../../components/member-header";
import { createPost } from "../actions";

const NewCommunityTopicPage = async () => {
  await requireMemberId();
  const spaces = await getCommunitySpaces();
  const firstSpace = spaces[0];

  if (!firstSpace) {
    notFound();
  }

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Comunidade" />
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
        <form
          action={createPost}
          className="paper-surface mt-10 space-y-7 border p-5 sm:p-9"
        >
          <label className="block" htmlFor="topic-space">
            <span className="brand-eyebrow">Espaço</span>
            <select
              className="mt-2 h-10 w-full rounded-sm border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
              defaultValue={firstSpace.id}
              id="topic-space"
              name="spaceId"
            >
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block" htmlFor="topic-title">
            <span className="brand-eyebrow">Título</span>
            <Input
              className="mt-2 h-12 font-display text-xl"
              id="topic-title"
              name="title"
              placeholder="O que você quer investigar?"
              required
            />
          </label>
          <div className="block">
            <span className="brand-eyebrow">Texto</span>
            <span className="mt-2 block text-muted-foreground text-sm">
              Use títulos, listas, citações e links para dar forma ao
              raciocínio.
            </span>
            <div className="mt-3">
              <TopicEditor />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 border-border border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button asChild variant="ghost">
              <Link href="/comunidade">Cancelar</Link>
            </Button>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                name="status"
                type="submit"
                value="DRAFT"
                variant="outline"
              >
                <SaveIcon aria-hidden="true" /> Salvar rascunho
              </Button>
              <Button name="status" type="submit" value="PUBLISHED">
                Publicar tópico
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

export default NewCommunityTopicPage;
