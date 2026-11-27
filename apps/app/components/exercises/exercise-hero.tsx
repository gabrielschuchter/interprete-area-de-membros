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
  "inline-flex min-h-8 items-center gap-1.5 text-[#E9C3C4] text-[13px] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C873]";

export const ExercisesHero = ({
  compact,
  favoritesCount,
  firstSession,
  sessionCount,
}: {
  readonly compact: boolean;
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
    <header
      className={`flex flex-wrap items-end gap-x-6 gap-y-4 overflow-hidden rounded-lg bg-[linear-gradient(120deg,#410230,#560A2A_55%,#7A1230)] text-[#F1EBE8] ${compact ? "px-5 pt-5 md:px-8 md:pt-8" : "px-6 pt-8 md:px-12 md:pt-12"}`}
    >
      <div
        className={`flex min-w-0 flex-[1_1_360px] flex-col gap-4 ${compact ? "pb-6 md:pb-8" : "pb-8 md:pb-12"}`}
      >
        <div className="flex items-center gap-3 font-data text-[11px] uppercase tracking-[.2em]">
          Prática e revisão
          <span aria-hidden="true" className="text-[#D9A86B]">
            ——◆——
          </span>
        </div>
        <h1
          className={`m-0 font-display font-semibold leading-[1.05] tracking-[-0.02em] ${compact ? "text-4xl md:text-5xl" : "text-[40px] md:text-[60px]"}`}
        >
          Sala de prática.
        </h1>
        <p className="m-0 max-w-[44ch] text-[#F1EBE8] text-base leading-[1.5] md:text-[17px]">
          {firstSession
            ? `${sessionCount === 1 ? "Uma folha em andamento." : `${sessionCount} folhas em andamento.`} ${remaining === 1 ? "Falta" : "Faltam"} `
            : "Nenhuma folha aberta ainda. Escolha um caderno abaixo e comece pela primeira questão."}
          {firstSession && (
            <>
              <strong className="font-data font-medium">
                {plural(remaining, "questão", "questões")}
              </strong>{" "}
              para fechar {firstSession.list.title}. Vamos?
            </>
          )}
        </p>
        <div className="mt-1 flex flex-wrap gap-3">
          {firstSession && (
            <IntentLink
              className="inline-flex min-h-11 items-center rounded-[4px] bg-[#F1EBE8] px-5 font-semibold text-primary hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C873]"
              href={`/exercicios/sessoes/${firstSession.id}`}
            >
              Continuar na questão {next} →
            </IntentLink>
          )}
          <a
            className={`inline-flex min-h-11 items-center rounded-[4px] px-5 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C873] ${firstSession ? "border border-[#F1EBE8] text-[#F1EBE8] hover:bg-white/10" : "bg-[#F1EBE8] font-semibold text-primary hover:bg-white"}`}
            href="#listas"
          >
            Ver listas
          </a>
        </div>
        <nav
          aria-label="Atalhos de exercícios"
          className="mt-1 flex flex-wrap gap-x-5 gap-y-1"
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
        </nav>
      </div>
      <Image
        alt=""
        aria-hidden="true"
        className={`-mr-1 ml-auto hidden w-auto object-contain object-bottom md:block ${compact ? "h-[260px]" : "h-[400px]"}`}
        height={560}
        src="/exercises/hero-lousa.svg"
        unoptimized
        width={520}
      />
    </header>
  );
};
