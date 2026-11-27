import { cn } from "@repo/design-system/lib/utils";
import Link from "next/link";
import "./tools-bancada.css";

export interface ToolsPickerItem {
  readonly description: string;
  readonly id: string;
  readonly illustration: string;
  readonly label: string;
}

/**
 * Dock de ferramentas: ícones ilustrados soltos sobre o fundo da página.
 * Cada ícone é um link para `?view=<id>` (navegação real, funciona sem
 * JavaScript e mantém o histórico). No desktop os ícones crescem perto do
 * cursor; no celular a fileira rola de lado.
 */
export const ToolsPicker = ({
  activeView,
  items,
}: {
  readonly activeView: string;
  readonly items: readonly ToolsPickerItem[];
}) => (
  <nav
    aria-label="Ferramentas"
    className="mt-6 sm:mt-10"
    data-tools-page-switcher
  >
    {/* Altura fixa no desktop: o ícone cresce para cima sem empurrar o conteúdo abaixo. */}
    <ul className="m-0 flex list-none items-end gap-3 px-1 pb-0 [scrollbar-width:none] max-sm:snap-x max-sm:overflow-x-auto sm:h-[154px] sm:justify-center sm:gap-10 [&::-webkit-scrollbar]:hidden">
      {items.map((item, index) => {
        const active = item.id === activeView;
        return (
          <li className="shrink-0 snap-center" key={item.id}>
            <Link
              aria-current={active ? "page" : undefined}
              className="group flex flex-col items-center gap-2 rounded-t-[44px] focus-visible:outline-2 focus-visible:outline-[#8C1535] focus-visible:outline-offset-2"
              href={`/ferramentas?view=${item.id}`}
              prefetch={false}
              scroll={false}
            >
              <span
                className={cn(
                  "tools-dock-item relative block overflow-hidden rounded-t-[44px] transition-opacity",
                  active ? "opacity-100" : "opacity-90 group-hover:opacity-100"
                )}
              >
                {/* biome-ignore lint/performance/noImgElement: static local artwork with a fixed aspect ratio. */}
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  decoding="async"
                  height={300}
                  loading={index < 3 ? "eager" : "lazy"}
                  src={`/tools/dock-${item.illustration}.webp`}
                  width={240}
                />
              </span>
              <span
                className={cn(
                  "font-data text-[11px] uppercase tracking-[.2em]",
                  active ? "font-medium text-[#8C1535]" : "text-[#6B4A5C]"
                )}
              >
                {item.label}
              </span>
              <span className="sr-only">{item.description}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "mb-2 size-1 rounded-full",
                  active ? "bg-[#8C1535]" : "bg-transparent"
                )}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  </nav>
);
