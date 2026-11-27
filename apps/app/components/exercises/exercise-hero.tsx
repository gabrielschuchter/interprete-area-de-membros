import { BookmarkIcon, HistoryIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";

interface HeroSession {
  readonly id: string;
  readonly list: { readonly title: string };
  readonly questions: readonly { readonly answer: unknown }[];
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const heroLinkClass =
  "inline-flex min-h-11 items-center gap-1.5 text-[#E9C3C4] text-[13px] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C873] md:min-h-9";

const primaryClass =
  "inline-flex h-11 items-center rounded-[4px] bg-[#F1EBE8] px-5 font-semibold text-[#410230] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C873] max-md:w-full max-md:justify-center";

const secondaryClass =
  "inline-flex h-11 items-center rounded-[4px] border-2 border-[#BFA9A3] px-5 font-semibold text-[#F1EBE8] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C873] max-md:w-full max-md:justify-center";

/**
 * Abertura da aba: mesma estrutura das aberturas de Biblioteca e Ferramentas
 * (painel em degradê, rótulo mono com ornamento, título serif, texto, arte
 * ancorada à direita e, no celular, faixa de arte embaixo).
 */
export const ExercisesHero = ({
  favoritesCount,
  firstSession,
  sessionCount,
}: {
  readonly favoritesCount: number;
  readonly firstSession?: HeroSession;
  readonly sessionCount: number;
}) => {
  const total = firstSession?.questions.length ?? 0;
  const answered =
    firstSession?.questions.filter(({ answer }) => answer !== null).length ?? 0;
  const remaining = Math.max(total - answered, 1);
  const next = Math.min(answered + 1, Math.max(total, 1));

  return (
    <section
      aria-labelledby="exercises-hero-title"
      className="relative isolate overflow-hidden rounded-lg bg-[linear-gradient(120deg,#410230_0%,#560A2A_55%,#7A1230_100%)] text-[#F1EBE8] max-md:bg-[linear-gradient(150deg,#410230_0%,#5E0E2B_60%,#7A1230_100%)] md:min-h-[300px]"
    >
      <div className="relative z-10 max-w-[62%] px-8 pt-12 pb-8 max-md:flex max-md:max-w-none max-md:flex-col max-md:gap-3 max-md:px-[22px] max-md:pt-6 max-md:pb-2 md:px-14 md:pt-14 md:pb-10">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-data text-[#F1EBE8]/80 text-[10px] uppercase tracking-[.14em] max-md:tracking-[.1em] md:text-[11px]">
          Prática · Revisão
          <span aria-hidden="true" className="inline-flex items-center gap-1.5">
            <span className="h-px w-6 bg-[#E9C48E]/60" />
            <span className="size-1 rotate-45 bg-[#E9C48E]/80" />
            <span className="h-px w-4 bg-[#E9C48E]/60" />
          </span>
        </p>
        <h1
          className="mt-4 max-w-full font-display font-semibold text-[#F1EBE8] text-[36px] leading-[1.05] tracking-[-.02em] max-md:mt-0 max-[359px]:text-[30px] md:text-[54px] md:leading-[1.04]"
          id="exercises-hero-title"
        >
          Sala de prática.
        </h1>
        <p className="mt-3 max-w-[400px] text-[#F1EBE8]/90 text-sm leading-[1.6] max-md:mt-0 md:text-base">
          {firstSession ? (
            <>
              {sessionCount === 1
                ? "Uma folha em andamento."
                : `${sessionCount} folhas em andamento.`}{" "}
              {remaining === 1 ? "Falta" : "Faltam"}{" "}
              <strong className="font-data font-medium">
                {plural(remaining, "questão", "questões")}
              </strong>{" "}
              para fechar {firstSession.list.title}. Vamos?
            </>
          ) : (
            "Nenhuma folha aberta ainda. Escolha um caderno abaixo e comece pela primeira questão."
          )}
        </p>
        <div className="mt-5 flex flex-wrap gap-3 max-md:mt-1 max-md:flex-col">
          {firstSession ? (
            <>
              <IntentLink
                className={primaryClass}
                href={`/exercicios/sessoes/${firstSession.id}`}
              >
                Continuar na questão {next} →
              </IntentLink>
              <a className={secondaryClass} href="#listas">
                Ver listas
              </a>
            </>
          ) : (
            <a className={primaryClass} href="#listas">
              Ver listas
            </a>
          )}
        </div>
        <nav
          aria-label="Atalhos de exercícios"
          className="mt-3 flex flex-wrap gap-x-5 gap-y-0 max-md:mt-0"
        >
          <Link className={heroLinkClass} href="/exercicios/historico">
            <HistoryIcon aria-hidden="true" className="size-3.5" />
            Histórico
          </Link>
          <Link className={heroLinkClass} href="/exercicios/favoritas">
            <BookmarkIcon aria-hidden="true" className="size-3.5" />
            Questões salvas
            {favoritesCount > 0 && (
              <span className="text-[#E9C48E]">{favoritesCount}</span>
            )}
          </Link>
          <Link className={heroLinkClass} href="/salvos">
            Todos os salvos
          </Link>
        </nav>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-10 bottom-0 hidden h-[calc(100%-1rem)] md:block lg:right-14"
      >
        <Image
          alt=""
          className="h-full w-auto"
          height={560}
          src="/exercises/hero-lousa.svg"
          unoptimized
          width={520}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none relative mt-2 h-[120px] w-full overflow-hidden max-[359px]:h-[80px] md:hidden"
      >
        <Image
          alt=""
          className="size-full object-contain object-right-bottom"
          height={560}
          src="/exercises/hero-lousa.svg"
          unoptimized
          width={520}
        />
      </div>
    </section>
  );
};
