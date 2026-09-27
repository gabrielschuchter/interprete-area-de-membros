import { HomeBlockType } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { requireAdmin } from "@/lib/authorization";
import { getHomeBlockConfigurations } from "@/lib/home-config";
import { getProductConfig } from "@/lib/product-config";
import { saveHomeBlock, saveProductSettings } from "./actions";

interface PersonalizationPageProperties {
  readonly searchParams: Promise<{ message?: string; status?: string }>;
}

const blockLabels: Record<HomeBlockType, string> = {
  [HomeBlockType.ASYNC_LEARNING]: "Aprendizado assíncrono",
  [HomeBlockType.COLLECTION]: "Coleção editorial",
  [HomeBlockType.COMMUNITY]: "Comunidade",
  [HomeBlockType.CONTINUE_WATCHING]: "Continue assistindo",
  [HomeBlockType.FEEDBACK]: "Feedback",
  [HomeBlockType.NEXT_MEETING]: "Próximo encontro",
  [HomeBlockType.PENDING_ACTIVITY]: "Atividade pendente",
  [HomeBlockType.PREPARATION]: "Preparação",
};

const PersonalizationPage = async ({
  searchParams,
}: PersonalizationPageProperties) => {
  await requireAdmin();
  const [{ message, status }, productConfig, homeBlocks] = await Promise.all([
    searchParams,
    getProductConfig(),
    getHomeBlockConfigurations(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <header className="max-w-3xl">
        <p className="brand-eyebrow">Admin · produto</p>
        <span aria-hidden="true" className="brand-rule mt-4" />
        <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          A experiência começa aqui.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Decisões editoriais e de produto ficam centralizadas nesta página. Se
          uma configuração não existir, a plataforma usa defaults seguros.
        </p>
      </header>

      {message && (
        <p
          className={`mt-8 border px-4 py-3 text-sm ${status === "error" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-brand-action/40 bg-brand-action/5"}`}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}

      <section aria-labelledby="product-heading" className="mt-12 max-w-3xl">
        <div className="border-b pb-4">
          <p className="brand-eyebrow">Decisões de produto</p>
          <h2 className="mt-2 font-display text-3xl" id="product-heading">
            O que está disponível para os membros
          </h2>
        </div>
        <form action={saveProductSettings} className="mt-6 space-y-4">
          <label className="paper-surface flex items-start gap-4 border p-5">
            <input
              className="mt-1 size-4 accent-brand-action"
              defaultChecked={productConfig.recordingsExperienceV2}
              name="recordingsExperienceV2"
              type="checkbox"
            />
            <span>
              <span className="block font-medium">Arquivo de gravações</span>
              <span className="mt-1 block text-muted-foreground text-sm leading-6">
                Ativa a experiência semântica de encontros anteriores. Os assets
                históricos continuam preservados mesmo quando ela estiver
                desligada.
              </span>
            </span>
          </label>
          <label className="paper-surface flex items-start gap-4 border p-5">
            <input
              className="mt-1 size-4 accent-brand-action"
              defaultChecked={productConfig.showLearnNavigation}
              name="showLearnNavigation"
              type="checkbox"
            />
            <span>
              <span className="block font-medium">Aprender na navegação</span>
              <span className="mt-1 block text-muted-foreground text-sm leading-6">
                Mostra Aprender apenas quando houver conteúdo assíncrono
                publicado e acessível. Cursos históricos não contam como aulas
                novas.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit">Salvar decisões</Button>
            <Link
              className="text-muted-foreground text-sm underline underline-offset-4"
              href="/admin"
            >
              Voltar à visão geral
            </Link>
          </div>
        </form>
      </section>

      <section aria-labelledby="home-heading" className="mt-14 max-w-4xl">
        <div className="border-b pb-4">
          <p className="brand-eyebrow">Página inicial</p>
          <h2 className="mt-2 font-display text-3xl" id="home-heading">
            Blocos que merecem aparecer
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground leading-6">
            Desative uma seção somente quando ela não fizer sentido para a fase
            atual. A Home continua funcionando mesmo se todas as configurações
            forem removidas.
          </p>
        </div>
        <div className="mt-6 space-y-5">
          {homeBlocks.map((block) => (
            <form
              action={saveHomeBlock}
              className="paper-surface grid gap-5 border p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_16rem]"
              key={block.type}
            >
              <input name="type" type="hidden" value={block.type} />
              <div>
                <label className="block" htmlFor={`${block.type}-title`}>
                  <span className="brand-eyebrow">
                    {blockLabels[block.type]}
                  </span>
                  <Input
                    className="mt-2"
                    defaultValue={block.title ?? ""}
                    id={`${block.type}-title`}
                    name="title"
                    placeholder="Título padrão da interface"
                  />
                </label>
                <label
                  className="mt-4 block"
                  htmlFor={`${block.type}-subtitle`}
                >
                  <span className="brand-eyebrow">Descrição opcional</span>
                  <Textarea
                    className="mt-2 min-h-20"
                    defaultValue={block.subtitle ?? ""}
                    id={`${block.type}-subtitle`}
                    name="subtitle"
                    placeholder="Uma orientação curta para o membro"
                  />
                </label>
              </div>
              <div className="space-y-4">
                <label className="flex items-center gap-3 text-sm">
                  <input
                    className="size-4 accent-brand-action"
                    defaultChecked={block.enabled}
                    name="enabled"
                    type="checkbox"
                  />
                  Exibir este bloco
                </label>
                <label className="block" htmlFor={`${block.type}-position`}>
                  <span className="brand-eyebrow">Posição</span>
                  <Input
                    className="mt-2"
                    defaultValue={block.position}
                    id={`${block.type}-position`}
                    max={999}
                    min={0}
                    name="position"
                    type="number"
                  />
                </label>
                <label className="block" htmlFor={`${block.type}-count`}>
                  <span className="brand-eyebrow">Itens</span>
                  <Input
                    className="mt-2"
                    defaultValue={block.itemCount}
                    id={`${block.type}-count`}
                    max={12}
                    min={1}
                    name="itemCount"
                    type="number"
                  />
                </label>
                <Button size="sm" type="submit">
                  Salvar bloco
                </Button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
};

export default PersonalizationPage;
