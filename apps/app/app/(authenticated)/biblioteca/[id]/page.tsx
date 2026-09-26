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
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { requireMemberId } from "@/lib/learning";
import { getPublishedLibraryItem } from "@/lib/library";
import { memberAssetUrl } from "@/lib/member-storage";
import { toggleLibraryBookmark } from "../actions";

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
          </div>
          <h1 className="mt-6 font-display text-5xl leading-tight sm:text-6xl">
            {item.title}
          </h1>
          {item.description && (
            <p className="mt-6 max-w-2xl whitespace-pre-wrap text-lg text-muted-foreground leading-8">
              {item.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
            {item.year ? <span>{item.year}</span> : null}
            {item.authors ? <span>{item.authors}</span> : null}
            {item.doi ? <span>DOI: {item.doi}</span> : null}
            {item.pmid ? <span>PMID: {item.pmid}</span> : null}
            <SingleFlightForm action={toggleLibraryBookmark}>
              <input name="itemId" type="hidden" value={item.id} />
              <input
                name="desired"
                type="hidden"
                value={item.bookmarks.length > 0 ? "off" : "on"}
              />
              <SingleFlightSubmit size="sm" variant="outline">
                {item.bookmarks.length > 0 ? "Remover dos salvos" : "Salvar"}
              </SingleFlightSubmit>
            </SingleFlightForm>
          </div>
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
            <Button asChild size="lg">
              <a
                href={
                  item.storagePath ? memberAssetUrl(item.storagePath) : item.url
                }
                rel="noreferrer"
                target="_blank"
              >
                Abrir material <ArrowUpRightIcon aria-hidden="true" />
              </a>
            </Button>
          </div>
        </article>
      </main>
    </div>
  );
};

export default LibraryItemPage;
