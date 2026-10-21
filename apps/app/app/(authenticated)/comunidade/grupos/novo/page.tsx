import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  ArrowLeftIcon,
  GlobeIcon,
  LockKeyholeIcon,
  UsersRoundIcon,
} from "lucide-react";
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
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <CommunityNavigation active="groups" />
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/comunidade">
            <ArrowLeftIcon aria-hidden="true" /> Voltar para a comunidade
          </Link>
        </Button>
        <header className="mt-8 max-w-5xl">
          <p className="brand-eyebrow">Comunidade · grupos de estudo</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-4xl leading-[1.05] sm:text-5xl">
            Um lugar para aprender em conjunto.
          </h1>
          <p className="mt-5 text-muted-foreground leading-7 sm:text-lg">
            Escolha um nome, defina quem pode encontrar o grupo e convide as
            pessoas que vão construir essa conversa com você.
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2.3fr)_minmax(280px,0.92fr)]">
          <SingleFlightForm
            action={createStudyGroup}
            className="paper-surface space-y-7 border p-5 sm:p-8"
          >
            <div className="flex items-center gap-3 border-b pb-5">
              <UsersRoundIcon
                aria-hidden="true"
                className="size-6 text-brand-action-text"
              />
              <div>
                <h2 className="font-display text-2xl">Novo grupo de estudo</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  O endereço do grupo será criado automaticamente.
                </p>
              </div>
            </div>

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
              </label>
              <label
                className="block sm:col-span-2"
                htmlFor="study-group-description"
              >
                <span className="font-medium text-sm">Descrição</span>
                <Textarea
                  className="mt-2 min-h-24"
                  id="study-group-description"
                  maxLength={500}
                  name="description"
                  placeholder="Explique o propósito do grupo em poucas linhas."
                />
              </label>
              <label
                className="block sm:col-span-2"
                htmlFor="study-group-details"
              >
                <span className="font-medium text-sm">Detalhes</span>
                <Textarea
                  className="mt-2 min-h-28"
                  id="study-group-details"
                  maxLength={2400}
                  name="details"
                  placeholder="Combine temas, frequência e como as pessoas podem participar."
                />
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
                    <span className="block h-full border bg-background p-4 transition-colors peer-checked:border-brand-structural peer-checked:bg-brand-structural/5 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                      <span className="flex items-center gap-2 font-display text-lg">
                        <LockKeyholeIcon
                          aria-hidden="true"
                          className="size-4 text-brand-structural"
                        />
                        Privado
                      </span>
                      <span className="mt-3 block space-y-2 text-muted-foreground text-sm leading-5">
                        <span className="block">
                          Só participantes veem as publicações.
                        </span>
                        <span className="block">
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
                    <span className="block h-full border bg-background p-4 transition-colors peer-checked:border-brand-structural peer-checked:bg-brand-structural/5 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                      <span className="flex items-center gap-2 font-display text-lg">
                        <GlobeIcon
                          aria-hidden="true"
                          className="size-4 text-brand-structural"
                        />
                        Público
                      </span>
                      <span className="mt-3 block space-y-2 text-muted-foreground text-sm leading-5">
                        <span className="block">
                          Qualquer membro encontra e pode entrar.
                        </span>
                        <span className="block">
                          Todos podem ler as publicações.
                        </span>
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
            </div>

            <div className="border-t pt-6">
              <GroupMemberInvitePicker currentMemberId={memberId} />
            </div>

            <div className="flex justify-end border-t pt-6">
              <SingleFlightSubmit pendingLabel="Criando grupo…">
                Criar grupo de estudo
              </SingleFlightSubmit>
            </div>
          </SingleFlightForm>
          <aside className="space-y-5 lg:sticky lg:top-8 lg:self-start">
            <section className="overflow-hidden border bg-background">
              <div className="flex aspect-[16/7] items-center justify-center bg-[radial-gradient(circle_at_72%_35%,rgba(143,19,57,0.24),transparent_34%),linear-gradient(125deg,rgba(143,19,57,0.12),rgba(74,0,46,0.04))] text-brand-structural">
                <UsersRoundIcon
                  aria-hidden="true"
                  className="size-10 opacity-75"
                />
              </div>
              <div className="p-5">
                <p className="brand-eyebrow">Prévia</p>
                <h2 className="mt-2 font-display text-2xl">Seu grupo</h2>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                  A identidade, a descrição e a privacidade escolhidas
                  aparecerão no diretório e na página do grupo.
                </p>
              </div>
            </section>
            <section className="border border-brand-structural/25 bg-brand-structural/5 p-5">
              <h2 className="font-display text-xl">Depois de criar</h2>
              <p className="mt-3 text-muted-foreground text-sm leading-6">
                A página do grupo abre em Publicações. Como proprietário, você
                poderá gerenciar participantes, moderadores e configurações.
              </p>
            </section>
            <p className="px-1 text-muted-foreground text-xs leading-5">
              Depois de criar o grupo, você poderá definir moderadores e ajustar
              as configurações.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default NewStudyGroupPage;
