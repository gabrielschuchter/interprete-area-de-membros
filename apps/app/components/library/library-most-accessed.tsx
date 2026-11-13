import { TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { LibraryCover } from "@/components/library/library-cover";
import { LibraryMarqueeFrame } from "@/components/library/library-marquee-frame";
import { getMostAccessedLibraryItems } from "@/lib/library";

const minLaneSlots = 10;

type MostAccessedItem = Awaited<
  ReturnType<typeof getMostAccessedLibraryItems>
>["items"][number];

const sourceCaption = {
  clicks: "Pelos cliques da comunidade",
  picks: "Seleção inicial da curadoria",
} as const;

const Card = ({
  hidden = false,
  item,
}: {
  readonly hidden?: boolean;
  readonly item: MostAccessedItem;
}) => (
  <li aria-hidden={hidden || undefined} className="library-marquee__item">
    <Link
      className="library-marquee__link"
      href={`/biblioteca/${item.id}`}
      prefetch={false}
      tabIndex={hidden ? -1 : undefined}
    >
      <LibraryCover
        category={item.category}
        className="library-marquee__cover"
        compact
        coverUrl={item.coverUrl}
        loading="eager"
      />
      <span className="library-marquee__title">{item.title}</span>
    </Link>
  </li>
);

/**
 * Esteira contínua dos materiais mais abertos. A segunda cópia da faixa só
 * existe para o laço visual: fica fora da leitura de tela e do Tab.
 */
export const LibraryMostAccessed = async ({
  memberId,
}: {
  readonly memberId: string;
}) => {
  const { items, source } = await getMostAccessedLibraryItems(memberId);
  if (items.length === 0) {
    return null;
  }
  // Cada faixa precisa ser mais larga que a tela para o laço não ter vão.
  const rounds = Math.ceil(minLaneSlots / items.length);
  const lane = Array.from({ length: rounds }, (_, round) =>
    items.map((item) => ({ item, round }))
  ).flat();
  return (
    <section
      aria-labelledby="library-most-accessed-heading"
      className="library-marquee mt-10 md:mt-12"
    >
      <LibraryMarqueeFrame
        caption={sourceCaption[source]}
        heading={
          <h2
            className="flex items-center gap-2 font-display font-semibold text-[#40222F] text-[22px] leading-tight md:text-2xl"
            id="library-most-accessed-heading"
          >
            <TrendingUpIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-[#8C1535]"
            />
            Materiais mais acessados
          </h2>
        }
      >
        <div
          className="library-marquee__track"
          style={{ "--marquee-items": lane.length } as CSSProperties}
        >
          <ol className="library-marquee__lane">
            {lane.map(({ item, round }) => (
              <Card
                hidden={round > 0}
                item={item}
                key={`${item.id}:${round}`}
              />
            ))}
          </ol>
          <ol aria-hidden="true" className="library-marquee__lane">
            {lane.map(({ item, round }) => (
              <Card hidden item={item} key={`${item.id}:${round}`} />
            ))}
          </ol>
        </div>
      </LibraryMarqueeFrame>
    </section>
  );
};
