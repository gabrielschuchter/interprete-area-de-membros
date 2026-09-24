import { Separator } from "@repo/design-system/components/ui/separator";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { BrandWordmark } from "@/components/brand/brand-mark";

interface MemberHeaderProperties {
  readonly section: string;
}

export const MemberHeader = ({ section }: MemberHeaderProperties) => (
  <header className="sticky top-0 z-20 flex min-h-16 shrink-0 items-center gap-3 border-border/80 border-b bg-background/95 px-4 backdrop-blur-sm md:px-8">
    <SidebarTrigger className="-ml-2" />
    <Separator className="mr-1 h-4" orientation="vertical" />
    <BrandWordmark className="w-24 md:hidden" />
    <div className="hidden min-w-0 items-center gap-3 md:flex">
      <p className="brand-eyebrow truncate text-foreground/75">
        Interprete. · {section}
      </p>
    </div>
  </header>
);
