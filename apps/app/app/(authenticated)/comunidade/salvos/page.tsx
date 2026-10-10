import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { BookmarkIcon } from "lucide-react";
import Link from "next/link";
import { MemberIdentity } from "@/components/community/member-identity";
import { ExerciseFavoritesGrid } from "@/components/exercises/exercise-favorites-grid";
import { PersonalLibraryGrid } from "@/components/library/personal-library-grid";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { communityPostHref, getSavedCommunityPosts } from "@/lib/community";
import { getMemberExerciseFavorites } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";
import { getPersonalLibraryItems } from "@/lib/library";
import { toggleBookmark } from "../actions";

const SavedCommunityPage = async () => {
  const memberId = await requireMemberId();
  const [posts, libraryItems, exerciseFavorites] = await Promise.all([
    getSavedCommunityPosts(memberId),
    getPersonalLibraryItems(memberId),
    getMemberExerciseFavorites(memberId, undefined, "after", 6),
  ]);
  const hasSavedContent =
    posts.length > 0 ||
    libraryItems.length > 0 ||
    exerciseFavorites.items.length > 0;

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <header className="mt-8 max-w-3xl">
          <p className="brand-eyebrow">Seu acervo pessoal</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            Salvos.
          </h1>
          <p className="mt-5 text-muted-foreground leading-7">
            Aulas, cursos, materiais, questões e conversas que você guardou
            ficam aqui, separados por origem e sincronizados com sua conta.
          </p>
        </header>
        {hasSavedContent ? (
          <div className="mt-10 space-y-14">
            {libraryItems.length > 0 && (
              <section aria-labelledby="saved-learning-heading">
                <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="brand-eyebrow">Aprender e Biblioteca</p>
                    <h2
                      className="mt-3 font-display text-3xl"
                      id="saved-learning-heading"
                    >
                      Aulas, cursos e materiais
                    </h2>
                  </div>
                  <span className="font-data text-muted-foreground text-xs">
                    {libraryItems.length}{" "}
                    {libraryItems.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <div className="mt-6">
                  <PersonalLibraryGrid items={libraryItems} />
                </div>
              </section>
            )}

            {exerciseFavorites.items.length > 0 && (
              <section aria-labelledby="saved-exercises-heading">
                <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="brand-eyebrow">Exercícios</p>
                    <h2
                      className="mt-3 font-display text-3xl"
                      id="saved-exercises-heading"
                    >
                      Questões favoritas
                    </h2>
                  </div>
                  <span className="font-data text-muted-foreground text-xs">
                    {exerciseFavorites.totalCount}{" "}
                    {exerciseFavorites.totalCount === 1
                      ? "questão"
                      : "questões"}
                  </span>
                </div>
                <ExerciseFavoritesGrid
                  items={exerciseFavorites.items}
                  showHeader={false}
                  totalCount={exerciseFavorites.totalCount}
                />
                {exerciseFavorites.hasNext && (
                  <div className="mt-4">
                    <Button asChild variant="outline">
                      <Link href="/exercicios/favoritas">
                        Ver todas as questões salvas
                      </Link>
                    </Button>
                  </div>
                )}
              </section>
            )}

            {posts.length > 0 && (
              <section aria-labelledby="saved-community-heading">
                <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="brand-eyebrow">Comunidade</p>
                    <h2
                      className="mt-3 font-display text-3xl"
                      id="saved-community-heading"
                    >
                      Discussões
                    </h2>
                  </div>
                  <span className="font-data text-muted-foreground text-xs">
                    {posts.length}{" "}
                    {posts.length === 1 ? "publicação" : "publicações"}
                  </span>
                </div>
                <div className="mt-4 divide-y border-border border-y">
                  {posts.map((post) => (
                    <article className="py-6" key={post.id}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                            <MemberIdentity
                              authorId={post.authorId}
                              compact
                              profile={post.profile ?? undefined}
                              showHeadline={false}
                            />
                            <span>·</span>
                            <span>{post.space?.title ?? "Feed geral"}</span>
                            <span>·</span>
                            <span>{post._count.comments} respostas</span>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-2xl">
                              <Link
                                className="hover:text-brand-structural"
                                href={communityPostHref(post)}
                              >
                                {post.title}
                              </Link>
                            </h3>
                          </div>
                          <p className="mt-2 line-clamp-2 text-muted-foreground leading-7">
                            {post.subtitle ?? post.excerpt}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {post.tags.map((tag) => (
                              <Badge key={tag} variant="outline">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <SingleFlightForm
                          action={toggleBookmark}
                          className="shrink-0"
                        >
                          <input name="postId" type="hidden" value={post.id} />
                          <input
                            name="spaceSlug"
                            type="hidden"
                            value={post.space?.slug ?? ""}
                          />
                          <input name="desired" type="hidden" value="off" />
                          <SingleFlightSubmit
                            pendingLabel="Salvando…"
                            size="sm"
                            variant="ghost"
                          >
                            <BookmarkIcon
                              aria-hidden="true"
                              fill="currentColor"
                            />{" "}
                            Remover
                          </SingleFlightSubmit>
                        </SingleFlightForm>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <section className="paper-surface mt-10 border p-8 sm:p-12">
            <BookmarkIcon
              aria-hidden="true"
              className="size-6 text-brand-action-text"
            />
            <h2 className="mt-5 font-display text-3xl">
              Seu acervo começa com um salvamento.
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
              Salve uma aula, curso, material, questão ou conversa para
              encontrá-los reunidos aqui, cada um em sua origem.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/aprender">Explorar Aprender</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/comunidade">Explorar a comunidade</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/exercicios">Explorar exercícios</Link>
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default SavedCommunityPage;
