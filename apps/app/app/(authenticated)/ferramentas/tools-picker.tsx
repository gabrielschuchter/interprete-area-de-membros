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
 * Dock de ferramentas: uma prateleira com um ícone ilustrado por ferramenta.
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
    className="mt-6 overflow-hidden rounded-lg bg-[#410230]"
    data-tools-page-switcher
  >
    <ul className="m-0 flex list-none items-end gap-3 overflow-x-auto px-5 pt-8 pb-0 [scrollbar-width:none] max-sm:snap-x sm:justify-center sm:gap-4 sm:px-8 [&::-webkit-scrollbar]:hidden">
      {items.map((item, index) => {
        const active = item.id === activeView;
        return (
          <li className="shrink-0 snap-center" key={item.id}>
            <Link
              aria-current={active ? "page" : undefined}
              className="group flex flex-col items-center gap-2 rounded-t-[44px] focus-visible:outline-2 focus-visible:outline-[#D9A86B] focus-visible:outline-offset-2"
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
                  active ? "text-[#F0C98A]" : "text-[#E9C3C4]"
                )}
              >
                {item.label}
              </span>
              <span className="sr-only">{item.description}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "mb-2 size-1 rounded-full",
                  active ? "bg-[#D9A86B]" : "bg-transparent"
                )}
              />
            </Link>
          </li>
        );
      })}
    </ul>
    <div aria-hidden="true" className="h-0.5 bg-[#D9A86B]" />
    <div aria-hidden="true" className="h-2.5 bg-[#5A2233]" />
  </nav>
);
