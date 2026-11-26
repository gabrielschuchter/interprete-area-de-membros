import { cn } from "@repo/design-system/lib/utils";
import Link from "next/link";

export interface ToolsPickerItem {
  readonly description: string;
  readonly id: string;
  readonly illustration: string;
  readonly label: string;
}

/**
 * Seletor de ferramentas em cartões. Cada cartão é um link para
 * `?view=<id>`: navegação real, funciona sem JavaScript e mantém o histórico.
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
    className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
    data-tools-page-switcher
  >
    {items.map((item, index) => {
      const active = item.id === activeView;
      return (
        <Link
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex flex-col overflow-hidden rounded-lg border transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#D9A86B] focus-visible:outline-offset-2",
            active
              ? "border-[#D9A86B] bg-[#410230] text-[#F1EBE8]"
              : "border-[#E2D6D1] bg-[#FBF8F5] text-[#2A0A1A] hover:border-[#8C1535]/40"
          )}
          href={`/ferramentas?view=${item.id}`}
          key={item.id}
          prefetch={false}
          scroll={false}
        >
          <span className="relative block aspect-[12/5] overflow-hidden border-[#E9C48E]/20 border-b bg-[#560A2A]">
            {/* biome-ignore lint/performance/noImgElement: static local SVG artwork with a fixed aspect ratio. */}
            <img
              alt=""
              className="h-full w-full object-cover"
              decoding="async"
              height={200}
              loading="lazy"
              src={`/tools/card-${item.illustration}.svg`}
              width={480}
            />
            <span className="absolute top-2 right-2.5 font-data text-[#E9C48E] text-[11px] tracking-[.1em]">
              0{index + 1}
            </span>
          </span>
          <span className="px-3.5 pt-3 pb-3 font-display font-semibold text-lg leading-tight sm:pb-0">
            {item.label}
          </span>
          <span
            className={cn(
              "px-3.5 pt-1 pb-3.5 text-[13px] leading-snug max-sm:hidden",
              active ? "text-[#E5CFCB]" : "text-[#7A5A69]"
            )}
          >
            {item.description}
          </span>
        </Link>
      );
    })}
  </nav>
);
