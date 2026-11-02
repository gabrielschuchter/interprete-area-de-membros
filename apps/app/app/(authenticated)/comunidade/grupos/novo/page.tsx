import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  ArrowLeftIcon,
  CheckIcon,
  GlobeIcon,
  LockKeyholeIcon,
  UsersRoundIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { GroupCoverUpload } from "@/components/community/group-cover-upload";
import { GroupMemberInvitePicker } from "@/components/community/group-member-invite-picker";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { requireMemberId } from "@/lib/learning";
import { createStudyGroup } from "../../actions";

interface NewStudyGroupPageProperties {
  readonly searchParams: Promise<{ error?: string }>;
}

const NewStudyGroupPage = async ({
  searchParams,
}: NewStudyGroupPageProperties) => {
  const memberId = await requireMemberId();
  const filters = await searchParams;
  const errorMessages: Readonly<Record<string, string>> = {
    form: "Revise os campos. O nome é obrigatório e você pode convidar até 50 pessoas por envio.",
    name: "Você já criou um grupo com esse nome. Escolha outro nome para o seu grupo.",
    slug: "Não foi possível reservar um endereço para o grupo. Tente novamente.",
    cover: "A capa deve terminar de ser enviada antes de criar o grupo.",
  };
  const errorMessage = filters.error
    ? (errorMessages[filters.error] ?? null)
    : null;

  return (
    <div className="community-page min-h-svh bg-background">
      <main className="community-shell mx-auto w-full">
        <CommunityNavigation active="groups" />
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/comunidade/grupos">
            <ArrowLeftIcon aria-hidden="true" /> Grupos
          </Link>
        </Button>
        <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,2.3fr)_minmax(280px,0.92fr)] lg:gap-12">
          <div className="min-w-0">
            <header className="max-w-5xl">
              <h1 className="font-display text-4xl leading-[1.05] sm:text-4xl">
                Um lugar para aprender em conjunto
              </h1>
              <p className="mt-3 max-w-[38rem] text-muted-foreground leading-7 sm:text-base">
                Escolha um nome, defina quem pode entrar e convide as pessoas
                que vão construir essa conversa com você.
              </p>
            </header>

            {errorMessage ? (
              <p
                className="mt-7 border-destructive border-l-2 bg-destructive/10 px-4 py-3 text-sm"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}

            <SingleFlightForm
              action={createStudyGroup}
              className="paper-surface mt-6 space-y-7 border p-5 sm:p-8"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <label
                  className="block sm:col-span-2"
                  htmlFor="study-group-title"
                >
                  <span className="font-medium text-sm">Nome do grupo</span>
                  <Input
                    autoComplete="off"
                    className="mt-2"
                    id="study-group-title"
                    maxLength={80}
                    name="title"
                    placeholder="Ex.: Interpretação de exames"
                    required
                  />
                  <span className="mt-2 block text-muted-foreground text-sm">
                    O endereço do grupo será criado automaticamente.
                  </span>
                </label>
                <label
                  className="block sm:col-span-2"
                  htmlFor="study-group-description"
                >
                  <span className="font-medium text-sm">Descrição curta</span>
                  <Textarea
                    className="mt-2 min-h-[4.5rem]"
                    id="study-group-description"
                    maxLength={500}
                    name="description"
                    placeholder="Em uma frase, o propósito do grupo"
                  />
                  <span className="mt-2 block text-muted-foreground text-sm">
                    Aparece na lista de grupos.
                  </span>
                </label>
                <label
                  className="block sm:col-span-2"
                  htmlFor="study-group-details"
                >
                  <span className="font-medium text-sm">Sobre o grupo</span>
                  <Textarea
                    className="mt-2 min-h-[7.5rem]"
                    id="study-group-details"
                    maxLength={2400}
                    name="details"
                    placeholder="Temas, frequência e como as pessoas podem participar"
                  />
                  <span className="mt-2 block text-muted-foreground text-sm">
                    Aparece na página do grupo, com as regras de convivência.
                  </span>
                </label>
                <div className="sm:col-span-2">
                  <GroupCoverUpload compact />
                </div>
                <fieldset className="space-y-3 sm:col-span-2">
                  <legend className="font-medium text-sm">Privacidade</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block cursor-pointer">
                      <input
                        className="peer sr-only"
                        defaultChecked
                        name="visibility"
                        type="radio"
                        value="PRIVATE"
                      />
                      <span className="relative block h-full border bg-background p-4 transition-colors before:absolute before:top-5 before:left-4 before:size-5 before:rounded-full before:border before:border-input after:absolute after:top-[1.5625rem] after:left-[1.3125rem] after:size-2.5 after:scale-0 after:rounded-full after:bg-brand-structural after:transition-transform after:content-[''] peer-checked:border-2 peer-checked:border-brand-structural peer-checked:bg-brand-structural/5 peer-checked:after:scale-100 peer-checked:before:border-brand-structural peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                        <span className="flex items-center gap-2 pl-7 font-display text-lg">
                          <LockKeyholeIcon
                            aria-hidden="true"
                            className="size-4 text-brand-structural"
                          />
                          Privado
                        </span>
                        <span className="mt-3 block space-y-2 text-muted-foreground text-sm leading-5">
                          <span className="flex items-start gap-2">
                            <CheckIcon
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0 text-brand-structural"
                            />
                            Só quem for convidado entra.
                          </span>
                          <span className="flex items-start gap-2">
                            <CheckIcon
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0 text-brand-structural"
                            />
                            Só membros leem as publicações.
                          </span>
                          <span className="flex items-start gap-2">
                            <CheckIcon
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0 text-brand-structural"
                            />
                            Não aparece na lista pública de grupos.
                          </span>
                        </span>
                      </span>
                    </label>
                    <label className="block cursor-pointer">
                      <input
                        className="peer sr-only"
                        name="visibility"
                        type="radio"
                        value="PUBLIC"
                      />
                      <span className="relative block h-full border bg-background p-4 transition-colors before:absolute before:top-5 before:left-4 before:size-5 before:rounded-full before:border before:border-input after:absolute after:top-[1.5625rem] after:left-[1.3125rem] after:size-2.5 after:scale-0 after:rounded-full after:bg-brand-structural after:transition-transform after:content-[''] peer-checked:border-2 peer-checked:border-brand-structural peer-checked:bg-brand-structural/5 peer-checked:after:scale-100 peer-checked:before:border-brand-structural peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                        <span className="flex items-center gap-2 pl-7 font-display text-lg">
                          <GlobeIcon
                            aria-hidden="true"
                            className="size-4 text-brand-structural"
                          />
                          Público
                        </span>
                        <span className="mt-3 block space-y-2 text-muted-foreground text-sm leading-5">
                          <span className="flex items-start gap-2">
                            <CheckIcon
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0 text-brand-structural"
                            />
                            Qualquer membro da escola encontra e entra.
                          </span>
                          <span className="flex items-start gap-2">
                            <CheckIcon
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0 text-brand-structural"
                            />
                            Todos podem ler as publicações.
                          </span>
                          <span className="flex items-start gap-2">
                            <CheckIcon
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0 text-brand-structural"
                            />
                            Aparece na lista e na busca.
                          </span>
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>
              </div>

              <div className="border-t pt-6">
                <GroupMemberInvitePicker
                  currentMemberId={memberId}
                  description="Você pode selecionar até 50 pessoas de cada vez e também poderá convidar depois por link."
                  label="Convidar pessoas · opcional"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t pt-6">
                <Button asChild variant="outline">
                  <Link href="/comunidade/grupos">Cancelar</Link>
                </Button>
                <SingleFlightSubmit pendingLabel="Criando grupo…">
                  Criar grupo de estudo
                </SingleFlightSubmit>
              </div>
            </SingleFlightForm>
          </div>
          <aside className="lg:sticky lg:top-8 lg:-mt-[4.5rem] lg:self-start">
            <p className="brand-eyebrow mb-3">Prévia na lista de grupos</p>
            <section className="overflow-hidden border bg-background">
              <div className="flex aspect-[16/7] items-center justify-center bg-[radial-gradient(circle_at_72%_35%,rgba(143,19,57,0.24),transparent_34%),linear-gradient(125deg,rgba(143,19,57,0.12),rgba(74,0,46,0.04))] text-brand-structural">
                <UsersRoundIcon
                  aria-hidden="true"
                  className="size-10 opacity-75"
                />
              </div>
              <div className="p-5">
                <h2 className="mt-2 font-display text-2xl">Seu grupo</h2>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                  A identidade, a descrição e a privacidade escolhidas
                  aparecerão no diretório e na página do grupo.
                </p>
              </div>
            </section>
            <section className="mt-5 border border-brand-structural/25 bg-brand-structural/5 p-5">
              <h2 className="font-display text-xl">Depois de criar</h2>
              <p className="mt-3 text-muted-foreground text-sm leading-6">
                A página abre em Publicações. Convide pessoas pelo nome ou
                compartilhe um link do grupo.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default NewStudyGroupPage;

export const metadata: Metadata = { title: "Novo grupo | Interprete" };
