import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { PersonalLibraryGrid } from "@/components/library/personal-library-grid";
import { requireMemberId } from "@/lib/learning";
import { getPersonalLibraryItems } from "@/lib/library";

const PersonalLibraryPage = async () => {
  const memberId = await requireMemberId();
  const items = await getPersonalLibraryItems(memberId);

  return (
    <main className="mx-auto min-h-full w-full max-w-[1080px] bg-[#F1EBE8] px-5 pt-4 pb-12 md:px-8 md:pt-8 md:pb-16 lg:px-12 lg:pt-10">
      <Button
        asChild
        className="-ml-2 h-11 px-2 text-[#7A5A69]"
        variant="ghost"
      >
        <Link href="/biblioteca" prefetch={false}>
          <ArrowLeftIcon aria-hidden="true" /> Voltar para a biblioteca
        </Link>
      </Button>
      <header className="mt-5 max-w-[600px] md:mt-6">
        <p className="font-data text-[#7A5A69] text-[10px] uppercase tracking-[.14em]">
          Seu acervo de estudo
        </p>
        <span aria-hidden="true" className="brand-rule mt-3" />
        <h1 className="mt-3 font-display font-semibold text-[#40222F] text-[36px] leading-[1.05] tracking-[-.02em] md:text-5xl">
          Biblioteca pessoal.
        </h1>
        <p className="mt-3 text-[#7A5A69] text-[15px] leading-[1.6]">
          Aulas, materiais e cursos que você salvou, reunidos em um só lugar e
          sincronizados com a sua conta.
        </p>
      </header>

      {items.length === 0 ? (
        <section className="mt-8 flex max-w-[760px] flex-col items-center gap-6 rounded-lg border border-[#E2D6D1] bg-white p-6 md:mt-10 md:flex-row md:gap-10 md:p-10">
          {/* Decorative empty-state art is static and copied from the handoff. */}
          {/* biome-ignore lint/performance/noImgElement: local SVG keeps the approved handoff viewBox. */}
          <img
            alt=""
            aria-hidden="true"
            className="h-[120px] w-[220px] shrink-0 object-contain"
            decoding="async"
            height={120}
            src="/library/illustrations/empty-bookshelf.svg"
            width={220}
          />
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-2xl text-[#40222F] leading-tight md:text-[26px]">
              Nenhum item salvo ainda.
            </h2>
            <p className="mt-3 text-[#7A5A69] text-sm leading-6">
              Use o marcador Salvar nos cards de Aprender ou nos materiais da
              biblioteca para guardar itens e voltar a eles depois.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild className="h-11">
                <Link href="/aprender" prefetch={false}>
                  Explorar Aprender
                </Link>
              </Button>
              <Button
                asChild
                className="h-11 border-2 border-[#8C1535] bg-transparent text-[#8C1535]"
                variant="outline"
              >
                <Link href="/biblioteca" prefetch={false}>
                  Ver biblioteca
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <PersonalLibraryGrid items={items} />
      )}
    </main>
  );
};

export default PersonalLibraryPage;
