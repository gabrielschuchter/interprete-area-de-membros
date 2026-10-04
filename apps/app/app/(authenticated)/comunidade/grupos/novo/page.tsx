import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { ArrowLeftIcon, UsersRoundIcon } from "lucide-react";
import Link from "next/link";
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
  };
  const errorMessage = filters.error
    ? (errorMessages[filters.error] ?? null)
    : null;

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[960px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/comunidade">
            <ArrowLeftIcon aria-hidden="true" /> Voltar para a comunidade
          </Link>
        </Button>
        <header className="mt-8 max-w-3xl">
          <p className="brand-eyebrow">Comunidade · grupos de estudo</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
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

        <SingleFlightForm
          action={createStudyGroup}
          className="paper-surface mt-8 space-y-7 border p-5 sm:p-8"
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
            <label className="block sm:col-span-2" htmlFor="study-group-title">
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
            <label className="block sm:col-span-2" htmlFor="study-group-cover">
              <span className="font-medium text-sm">Capa · opcional</span>
              <Input
                className="mt-2"
                id="study-group-cover"
                maxLength={2000}
                name="coverUrl"
                placeholder="https://… ou uma imagem enviada à plataforma"
                type="url"
              />
            </label>
            <label
              className="block sm:col-span-2"
              htmlFor="study-group-visibility"
            >
              <span className="font-medium text-sm">Privacidade</span>
              <select
                className="mt-2 h-10 w-full rounded-sm border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
                defaultValue="PRIVATE"
                id="study-group-visibility"
                name="visibility"
              >
                <option value="PRIVATE">Privado · só membros convidados</option>
                <option value="PUBLIC">
                  Público · qualquer membro pode encontrar
                </option>
              </select>
            </label>
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
      </main>
    </div>
  );
};

export default NewStudyGroupPage;
