import type { ReactNode } from "react";
import { MemberHeader } from "../../app/(authenticated)/components/member-header";

interface LearningPageFrameProperties {
  readonly children: ReactNode;
  readonly description?: string;
  readonly eyebrow?: string;
  readonly title: string;
}

export const LearningPageFrame = ({
  children,
  description,
  eyebrow,
  title,
}: LearningPageFrameProperties) => (
  <div className="flex min-h-svh flex-1 flex-col bg-background">
    <MemberHeader section="Aprender" />
    <main className="flex flex-1 flex-col gap-12 px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-12">
        <div className="max-w-[820px] space-y-5">
          {eyebrow && <p className="brand-eyebrow">{eyebrow}</p>}
          <h1 className="max-w-[780px] font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            {title}
          </h1>
          <span aria-hidden="true" className="brand-rule mt-6" />
          {description && (
            <p className="max-w-[700px] text-base text-muted-foreground leading-7 sm:text-lg">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </main>
  </div>
);
