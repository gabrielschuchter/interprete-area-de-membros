import { cn } from "@repo/design-system/lib/utils";
import Link from "next/link";

export interface ToolsPickerItem {
  readonly description: string;
  readonly iconPath: string;
  readonly id: string;
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
            "group flex min-h-[88px] flex-col gap-2 rounded-lg border p-3.5 transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#D9A86B] focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
            active
              ? "border-[#D9A86B] bg-[#410230] text-[#F1EBE8]"
              : "border-[#E2D6D1] bg-[#FBF8F5] text-[#2A0A1A] hover:border-[#8C1535]/40"
          )}
          href={`/ferramentas?view=${item.id}`}
          key={item.id}
          prefetch={false}
          scroll={false}
        >
          <span className="flex items-center justify-between">
            <svg
              aria-hidden="true"
              className={active ? "text-[#E9C48E]" : "text-[#8C1535]"}
              fill="none"
              height="24"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
              viewBox="0 0 24 24"
              width="24"
            >
              <path d={item.iconPath} />
            </svg>
            <span
              className={cn(
                "font-data text-[11px] tracking-[.1em]",
                active ? "text-[#E5CFCB]" : "text-[#7A5A69]"
              )}
            >
              0{index + 1}
            </span>
          </span>
          <span className="font-display font-semibold text-lg leading-tight">
            {item.label}
          </span>
          <span
            className={cn(
              "text-[13px] leading-snug max-sm:hidden",
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
