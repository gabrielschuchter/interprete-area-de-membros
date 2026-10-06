import Link from "next/link";
import type { PersonalLibraryCard } from "@/lib/library";

interface PersonalLibraryGridProperties {
  readonly items: readonly PersonalLibraryCard[];
}

export const PersonalLibraryGrid = ({
  items,
}: PersonalLibraryGridProperties) => (
  <ul
    aria-label="Conteúdos salvos"
    className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
  >
    {items.map((item) => (
      <li key={item.id}>
        <article className="paper-surface h-full overflow-hidden border">
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
            <h3 className="mt-3 font-display text-2xl leading-tight">
              <Link className="hover:text-brand-structural" href={item.href}>
                {item.title}
              </Link>
            </h3>
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
      </li>
    ))}
  </ul>
);
