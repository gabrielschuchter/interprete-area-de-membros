import { randomUUID } from "node:crypto";
import { FileTextIcon, MessageCircleIcon } from "lucide-react";
import { startDraft } from "@/app/(authenticated)/comunidade/actions";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";

interface CommunityStartSpace {
  readonly id: string;
  readonly title: string;
}

interface CommunityStartPanelProperties {
  readonly initialSpaceId?: string;
  readonly spaces: readonly CommunityStartSpace[];
}

const SpaceField = ({
  initialSpaceId,
  spaces,
}: CommunityStartPanelProperties) => (
  <label className="block text-left">
    <span className="brand-eyebrow">Onde publicar</span>
    <select
      className="mt-2 h-10 w-full rounded-sm border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
      defaultValue={initialSpaceId ?? ""}
      name="spaceId"
    >
      <option value="">Feed geral, sem espaço</option>
      {spaces.map((space) => (
        <option key={space.id} value={space.id}>
          {space.title}
        </option>
      ))}
    </select>
  </label>
);

export const CommunityStartPanel = ({
  initialSpaceId,
  spaces,
}: CommunityStartPanelProperties) => (
  <section className="mt-10 grid gap-4 md:grid-cols-2">
    <SingleFlightForm
      action={startDraft}
      className="paper-surface border p-6 sm:p-8"
    >
      <input name="kind" type="hidden" value="PUBLICATION" />
      <input name="idempotencyKey" type="hidden" value={randomUUID()} />
      <FileTextIcon aria-hidden="true" className="size-7 text-brand-action" />
      <h2 className="mt-5 font-display text-3xl">Nova publicação</h2>
      <p className="mt-3 min-h-20 text-muted-foreground leading-7">
        Escreva uma análise, uma leitura científica ou um texto para guardar e
        compartilhar com a comunidade.
      </p>
      <div className="mt-6">
        <SpaceField initialSpaceId={initialSpaceId} spaces={spaces} />
      </div>
      <SingleFlightSubmit className="mt-6 w-full" pendingLabel="Abrindo…">
        Começar a escrever
      </SingleFlightSubmit>
    </SingleFlightForm>
    <SingleFlightForm
      action={startDraft}
      className="paper-surface border p-6 sm:p-8"
    >
      <input name="kind" type="hidden" value="DISCUSSION" />
      <input name="idempotencyKey" type="hidden" value={randomUUID()} />
      <MessageCircleIcon
        aria-hidden="true"
        className="size-7 text-brand-action"
      />
      <h2 className="mt-5 font-display text-3xl">Nova discussão</h2>
      <p className="mt-3 min-h-20 text-muted-foreground leading-7">
        Abra uma pergunta, compartilhe uma dúvida ou coloque uma observação em
        conversa rapidamente.
      </p>
      <div className="mt-6">
        <SpaceField initialSpaceId={initialSpaceId} spaces={spaces} />
      </div>
      <SingleFlightSubmit
        className="mt-6 w-full"
        pendingLabel="Abrindo…"
        variant="outline"
      >
        Abrir discussão
      </SingleFlightSubmit>
    </SingleFlightForm>
  </section>
);
