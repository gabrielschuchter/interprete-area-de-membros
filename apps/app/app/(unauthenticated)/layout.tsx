import type { ReactNode } from "react";
import { BrandWordmark } from "@/components/brand/brand-mark";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => (
  <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.72fr)]">
    <div className="relative hidden min-h-dvh overflow-hidden bg-brand-depth p-10 text-primary-foreground lg:flex lg:flex-col">
      <div className="relative z-10">
        <BrandWordmark tone="branco" />
      </div>
      <div className="relative z-10 mt-auto max-w-lg space-y-5">
        <p className="brand-eyebrow text-primary-foreground/70">
          Escola de prática baseada em evidências
        </p>
        <p className="font-display text-4xl text-primary-foreground leading-tight xl:text-5xl">
          Não aceite a evidência. Interprete.
        </p>
        <p className="max-w-md text-primary-foreground/75 leading-7">
          Um espaço para estudar, discutir e construir decisões com mais
          autonomia.
        </p>
      </div>
      <span className="absolute right-12 bottom-12 size-32 rounded-full border border-brand-action/60" />
      <span className="absolute right-24 bottom-24 size-16 rounded-full border border-brand-action/70" />
    </div>
    <div className="flex items-center p-6 lg:p-12">
      <div className="mx-auto flex w-full max-w-[420px] flex-col justify-center space-y-6">
        {children}
      </div>
    </div>
  </div>
);

export default AuthLayout;
