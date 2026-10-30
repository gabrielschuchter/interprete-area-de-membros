import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";

/**
 * Tela de página não encontrada. O texto é neutro de propósito: grupos
 * privados respondem 404 para não revelar que existem.
 */
export const NotFoundState = ({
  homeHref = "/",
  homeLabel = "Voltar ao início",
}: {
  readonly homeHref?: string;
  readonly homeLabel?: string;
}) => (
  <main
    className="mx-auto grid min-h-[70svh] w-full max-w-[640px] content-center gap-5 px-6 py-16"
    id="main-content"
  >
    <p className="brand-eyebrow">Página não encontrada</p>
    <h1 className="font-display text-4xl text-[#40222F] leading-tight sm:text-5xl">
      Não encontramos esta página.
    </h1>
    <p className="text-[#7A5A69] leading-relaxed">
      O endereço pode ter mudado, o conteúdo pode ter sido removido ou ela não
      está disponível para a sua conta. Se você chegou por um link antigo,
      volte ao início e procure pelo menu.
    </p>
    <div>
      <Button asChild>
        <Link href={homeHref} prefetch={false}>
          {homeLabel}
        </Link>
      </Button>
    </div>
  </main>
);
