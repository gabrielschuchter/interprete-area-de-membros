import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

type MotionStyle = CSSProperties & {
  "--motion-delay"?: string;
};

interface RevealProperties {
  readonly children: ReactNode;
  readonly className?: string;
  readonly delay?: number | string;
  readonly variant?: "fast" | "normal" | "editorial";
}

const revealClassByVariant = {
  fast: "motion-reveal-fast",
  normal: "motion-reveal-normal",
  editorial: "motion-reveal-editorial",
} as const;

export const Reveal = ({
  children,
  className,
  delay,
  variant = "editorial",
}: RevealProperties) => {
  const resolvedDelay = typeof delay === "number" ? `${delay}ms` : delay;

  return (
    <div
      className={cn(revealClassByVariant[variant], className)}
      style={
        resolvedDelay
          ? ({ "--motion-delay": resolvedDelay } as MotionStyle)
          : undefined
      }
    >
      {children}
    </div>
  );
};

interface StaggerProperties extends Omit<ComponentProps<"div">, "children"> {
  readonly children: ReactNode;
}

export const Stagger = ({
  children,
  className,
  ...props
}: StaggerProperties) => (
  <div className={cn("motion-stagger", className)} {...props}>
    {children}
  </div>
);

interface DrawAnnotationProperties {
  readonly className?: string;
}

export const DrawAnnotation = ({ className }: DrawAnnotationProperties) => (
  <span aria-hidden="true" className={cn("motion-annotation", className)} />
);
