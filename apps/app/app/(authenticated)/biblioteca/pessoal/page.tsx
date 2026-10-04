import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon, BookmarkIcon } from "lucide-react";
import Link from "next/link";
import { requireMemberId } from "@/lib/learning";
import { getPersonalLibraryItems } from "@/lib/library";

const PersonalLibraryPage = async () => {
  const memberId = await requireMemberId();
  const items = await getPersonalLibraryItems(memberId);

  return (
    <main className="mx-auto min-h-svh w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
      <Button asChild className="-ml-3" variant="ghost">
        <Link href="/biblioteca">
          <ArrowLeftIcon aria-hidden="true" /> Voltar para a biblioteca
        </Link>
      </Button>
      <header className="mt-8 max-w-3xl">
        <p className="brand-eyebrow">Seu acervo de estudo</p>
        <span aria-hidden="true" className="brand-rule mt-4" />
        <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
          Biblioteca pessoal.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Aulas, materiais e cursos que você salvou ficam reunidos aqui e
          sincronizados com sua conta.
        </p>
      </header>
      {items.length === 0 ? (
        <section className="paper-surface mt-10 border p-8 sm:p-12">
          <BookmarkIcon
            aria-hidden="true"
            className="size-6 text-brand-action-text"
          />
          <h2 className="mt-5 font-display text-3xl">
            Seu acervo começa com um salvamento.
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground leading-7">
            Use o marcador nos cards de Aprender ou nos materiais da biblioteca
            para guardar algo para depois.
          </p>
          <Button asChild className="mt-6">
            <Link href="/aprender">Explorar Aprender</Link>
          </Button>
        </section>
      ) : (
        <section
          aria-label="Conteúdos salvos"
          className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {items.map((item) => (
            <article
              className="paper-surface overflow-hidden border"
              key={item.id}
            >
              {item.coverUrl ? (
                // User-visible editorial covers are stored as HTTPS URLs.
                // biome-ignore lint/performance/noImgElement: covers can be hosted outside configured image domains.
                <img
                  alt={`Capa: ${item.title}`}
                  className="aspect-[16/10] w-full object-cover"
                  decoding="async"
                  height={420}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={item.coverUrl}
                  width={672}
                />
              ) : (
                <div className="aspect-[16/10] bg-[radial-gradient(ellipse_at_70%_15%,rgba(241,215,181,.38),transparent_43%),linear-gradient(135deg,rgba(57,39,48,.96),rgba(117,65,79,.88))]" />
              )}
              <div className="p-5 sm:p-6">
                <p className="brand-eyebrow">{item.label}</p>
                <h2 className="mt-3 font-display text-2xl leading-tight">
                  <Link
                    className="hover:text-brand-structural"
                    href={item.href}
                  >
                    {item.title}
                  </Link>
                </h2>
                {item.description && (
                  <p className="mt-2 line-clamp-3 text-muted-foreground text-sm leading-6">
                    {item.description}
                  </p>
                )}
                <time
                  className="mt-4 block text-muted-foreground text-xs"
                  dateTime={item.savedAt.toISOString()}
                >
                  Salvo em {item.savedAt.toLocaleDateString("pt-BR")}
                </time>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

export default PersonalLibraryPage;
