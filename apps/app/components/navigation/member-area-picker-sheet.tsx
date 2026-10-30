"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";

interface MemberAreaPickerSheetProperties {
  readonly activeLabel: string;
  readonly areas: ReadonlyArray<{
    readonly href: string;
    readonly label: string;
  }>;
  readonly label: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}

export const MemberAreaPickerSheet = ({
  activeLabel,
  areas,
  label,
  onOpenChange,
  open,
}: MemberAreaPickerSheetProperties) => (
  <Sheet onOpenChange={onOpenChange} open={open}>
    <SheetContent className="w-[min(88vw,360px)] bg-background" side="left">
      <SheetHeader className="border-b px-5 py-5 text-left">
        <SheetTitle className="font-display text-2xl">
          Trocar {label.toLowerCase()}
        </SheetTitle>
        <SheetDescription>Escolha uma área para continuar.</SheetDescription>
      </SheetHeader>
      <nav aria-label={label} className="grid gap-1 px-3 py-4">
        {areas.map((area) => (
          <IntentLink
            aria-current={area.label === activeLabel ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-sm px-3 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${area.label === activeLabel ? "bg-accent font-semibold text-foreground" : "text-muted-foreground"}`}
            href={area.href}
            key={area.href}
            onClick={() => onOpenChange(false)}
          >
            {area.label}
          </IntentLink>
        ))}
      </nav>
    </SheetContent>
  </Sheet>
);
