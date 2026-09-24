import { Badge } from "@repo/design-system/components/ui/badge";
import { ArrowRightIcon, MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { getCommunitySpaces } from "@/lib/community";
import { MemberHeader } from "../components/member-header";

const CommunityPage = async () => {
  const spaces = await getCommunitySpaces();

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Comunidade" />
      <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <header className="max-w-3xl">
          <p className="brand-eyebrow">
            Sala de discussão · pensamento em público
          </p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
            Perguntas melhores começam em companhia.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-7 sm:text-lg">
            Um espaço para compartilhar dúvidas, ler outras perspectivas e
            construir raciocínios sem transformar conversa em ruído.
          </p>
        </header>
        <section aria-labelledby="spaces-heading" className="mt-14">
          <div className="flex items-end justify-between border-border border-b pb-4">
            <div>
              <p className="brand-eyebrow">Salas abertas</p>
              <h2 className="mt-2 font-display text-3xl" id="spaces-heading">
                Escolha uma conversa
              </h2>
            </div>
            <span className="font-data text-muted-foreground text-xs">
              {spaces.length.toString().padStart(2, "0")} espaços
            </span>
          </div>
          {spaces.length === 0 ? (
            <div className="paper-surface mt-6 border p-8 sm:p-12">
              <p className="brand-eyebrow">Ainda sem salas</p>
              <h3 className="mt-4 font-display text-3xl">
                A comunidade está preparando a primeira mesa.
              </h3>
              <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
                Quando houver uma sala publicada, ela aparecerá aqui com suas
                perguntas e discussões.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {spaces.map((space) => (
                <article
                  className="paper-surface border p-6 sm:p-8"
                  key={space.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="brand-eyebrow">/{space.slug}</p>
                      <h3 className="mt-2 font-display text-3xl">
                        {space.title}
                      </h3>
                    </div>
                    <Badge variant="outline">
                      <MessageCircleIcon aria-hidden="true" />{" "}
                      {space._count.posts}
                    </Badge>
                  </div>
                  <p className="mt-4 text-muted-foreground leading-7">
                    {space.description ??
                      "Uma sala para trocar perguntas e perspectivas."}
                  </p>
                  <div className="mt-6 border-border border-t pt-4">
                    {space.posts.length > 0 ? (
                      <div className="space-y-3">
                        {space.posts.map((post) => (
                          <Link
                            className="group flex items-start justify-between gap-4"
                            href={`/comunidade/${space.slug}/${post.id}`}
                            key={post.id}
                          >
                            <span>
                              <span className="block font-medium group-hover:text-brand-structural">
                                {post.title}
                              </span>
                              <span className="mt-1 block text-muted-foreground text-xs">
                                {post._count.comments} respostas ·{" "}
                                {post._count.votes} apoios
                              </span>
                            </span>
                            <ArrowRightIcon
                              aria-hidden="true"
                              className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
                            />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        A primeira pergunta pode começar aqui.
                      </p>
                    )}
                    <Link
                      className="mt-5 inline-flex items-center gap-2 font-medium text-brand-structural text-sm underline underline-offset-4"
                      href={`/comunidade/${space.slug}`}
                    >
                      Abrir sala{" "}
                      <ArrowRightIcon aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default CommunityPage;
