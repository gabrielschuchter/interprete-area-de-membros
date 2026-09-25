import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

interface MemberPageProperties {
  readonly action?: { href: string; label: string };
  readonly children?: ReactNode;
  readonly description: string;
  readonly eyebrow?: string;
  readonly imageAlt?: string;
  readonly imageSrc?: string;
  readonly title: string;
}

export const MemberPage = ({
  action,
  children,
  description,
  eyebrow = "Área de membros · espaço de estudo",
  imageAlt,
  imageSrc,
  title,
}: MemberPageProperties) => (
  <div className="flex min-h-svh flex-1 flex-col bg-background">
    <main className="flex flex-1 items-start px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
      <section className="paper-surface mx-auto grid w-full max-w-[1280px] gap-10 border p-6 text-left shadow-[var(--shadow-paper)] sm:p-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,0.72fr)] lg:items-stretch lg:p-14">
        <div className="flex flex-col items-start justify-center lg:pr-8">
          <p className="brand-eyebrow">{eyebrow}</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-7 max-w-[680px] font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-[620px] text-base text-muted-foreground leading-7 sm:text-lg">
            {description}
          </p>
          {action && (
            <Button asChild className="mt-8">
              <Link href={action.href}>
                {action.label}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          )}
          {children && <div className="mt-10 w-full">{children}</div>}
        </div>
        {imageSrc && (
          <figure className="relative min-h-72 overflow-hidden border bg-brand-depth/10 lg:min-h-[32rem]">
            <Image
              alt={imageAlt ?? "Material de estudo do Interprete."}
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 36vw, 100vw"
              src={imageSrc}
            />
          </figure>
        )}
      </section>
    </main>
  </div>
);
