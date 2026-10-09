import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  FileTextIcon,
  LinkIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StudyHeartbeat } from "@/components/learning/study-heartbeat";
import { LibraryBookmarkButton } from "@/components/library/library-bookmark-button";
import { requireMemberId } from "@/lib/learning";
import { getPublishedLibraryItem } from "@/lib/library";
import {
  libraryAccessLabel,
  libraryDifficultyLabel,
  libraryLanguageLabel,
} from "@/lib/library-presentation";

interface LibraryItemPageProperties {
  readonly params: Promise<{ id: string }>;
}

const labelFor = (kind: string) => {
  if (kind === "PDF") {
    return "PDF";
  }
  if (kind === "ARTICLE") {
    return "Artigo";
  }
  if (kind === "GUIDE") {
    return "Guia";
  }
  if (kind === "VIDEO") {
    return "Vídeo";
  }
  return "Link";
};

const iconFor = (kind: string) => {
  if (kind === "PDF") {
    return FileTextIcon;
  }
  if (kind === "ARTICLE" || kind === "GUIDE") {
    return BookOpenIcon;
  }
  return LinkIcon;
};

const LibraryItemPage = async ({ params }: LibraryItemPageProperties) => {
  const { id } = await params;
  const memberId = await requireMemberId();
  const item = await getPublishedLibraryItem(id, memberId);

  if (!item) {
    notFound();
  }

  const Icon = iconFor(item.kind);

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[960px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <StudyHeartbeat activityKind="LIBRARY_ITEM" resourceId={item.id} />
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/biblioteca">
            <ArrowLeftIcon aria-hidden="true" /> Voltar para a biblioteca
          </Link>
        </Button>
        <article className="paper-surface mt-8 border p-6 shadow-[var(--shadow-paper)] sm:p-10 lg:p-14">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">
              <Icon aria-hidden="true" /> {labelFor(item.kind)}
            </Badge>
            {item.category && (
              <span className="brand-eyebrow">{item.category}</span>
            )}
            <Badge variant="secondary">
              {libraryAccessLabel(item.accessType)}
            </Badge>
          </div>
          <h1 className="mt-6 text-balance break-words font-display text-5xl leading-tight sm:text-6xl">
            {item.title}
          </h1>
          {item.description && (
            <p className="mt-6 max-w-2xl whitespace-pre-wrap text-lg text-muted-foreground leading-8">
              {item.description}
            </p>
          )}
          {item.coverUrl && (
            // Cover URLs are staff-provided HTTPS assets and may use approved external hosts.
            // biome-ignore lint/performance/noImgElement: editorial cover may be hosted outside configured image domains.
            <img
              alt={`Capa: ${item.title}`}
              className="mt-7 max-h-[32rem] w-full rounded-sm border object-cover"
              decoding="async"
              height={640}
              loading="lazy"
              referrerPolicy="no-referrer"
              src={item.coverUrl}
              width={1200}
            />
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
            {item.year ? <span>{item.year}</span> : null}
            {item.authors ? <span>{item.authors}</span> : null}
            <span>{libraryLanguageLabel(item.language)}</span>
            {item.difficulty ? (
              <span>{libraryDifficultyLabel(item.difficulty)}</span>
            ) : null}
            {item.version ? <span>{item.version}</span> : null}
            {item.doi ? <span>DOI: {item.doi}</span> : null}
            {item.pmid ? <span>PMID: {item.pmid}</span> : null}
            <LibraryBookmarkButton
              initialSaved={item.bookmarks.length > 0}
              targetId={item.id}
              targetType="LIBRARY_ITEM"
            />
          </div>
          {item.accessNote && (
            <p className="mt-5 max-w-2xl border-brand-action/50 border-l-2 pl-4 text-muted-foreground text-sm leading-6">
              {item.accessNote}
            </p>
          )}
          {item.linkCheckedAt && (
            <p className="mt-3 text-muted-foreground text-xs">
              Link conferido em{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(item.linkCheckedAt)}
            </p>
          )}
          {item.tags.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="mt-10 border-border border-t pt-7">
            <a
              aria-label={`Abrir material: ${item.title}, em nova aba`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border-2 border-[#8C1535] bg-[#8C1535] px-6 font-semibold text-sm text-white transition-colors hover:bg-[#6f102b] focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2"
              href={`/biblioteca/abrir/${item.id}`}
              rel="noopener noreferrer"
              target="_blank"
              title="Abre em nova aba"
            >
              Abrir material <ArrowUpRightIcon aria-hidden="true" />
            </a>
          </div>
        </article>
      </main>
    </div>
  );
};

export default LibraryItemPage;
