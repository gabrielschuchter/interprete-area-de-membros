"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface MemberViewOption {
  readonly id: string;
  readonly label: string;
}

export const MemberViewSwitcher = ({
  activeView,
  label = "Visão",
  views,
}: {
  readonly activeView: string;
  readonly label?: string;
  readonly views: readonly MemberViewOption[];
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const changeView = (view: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", view);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <>
      <fieldset className="m-0 hidden min-w-0 items-center overflow-hidden rounded-md border border-[#E2D6D1] bg-white p-0 md:inline-flex">
        <legend className="sr-only">{label}</legend>
        {views.map((view) => (
          <Button
            aria-pressed={view.id === activeView}
            className={
              view.id === activeView
                ? "h-10 rounded-none bg-[#8C1535] px-4 font-semibold text-white hover:bg-[#6d102a]"
                : "h-10 rounded-none bg-white px-4 font-medium text-[#40222F] hover:bg-[#F8F3F1]"
            }
            key={view.id}
            onClick={() => changeView(view.id)}
            type="button"
            variant="ghost"
          >
            {view.label}
          </Button>
        ))}
      </fieldset>
      <label className="flex w-full flex-col gap-1 text-sm md:hidden">
        <span className="font-medium text-[#7A5A69]">{label}</span>
        <select
          className="h-11 rounded-md border border-[#E2D6D1] bg-white px-3 text-[#40222F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1535]"
          onChange={(event) => changeView(event.target.value)}
          value={activeView}
        >
          {views.map((view) => (
            <option key={view.id} value={view.id}>
              {view.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
};
