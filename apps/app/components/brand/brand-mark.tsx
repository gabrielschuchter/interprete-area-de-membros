import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";

type BrandTone = "amaranto" | "branco";

interface BrandWordmarkProperties {
  readonly className?: string;
  readonly tone?: BrandTone;
}

export const BrandWordmark = ({
  className,
  tone = "amaranto",
}: BrandWordmarkProperties) => (
  <Image
    alt="Interprete."
    className={cn("h-auto w-[7.5rem]", className)}
    height={896}
    priority
    src={`/brand/logo/wordmark-${tone}.svg`}
    width={4890}
  />
);
