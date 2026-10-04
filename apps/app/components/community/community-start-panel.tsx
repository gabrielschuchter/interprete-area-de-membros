import { randomUUID } from "node:crypto";
import { FileTextIcon } from "lucide-react";
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
      <option value="">Feed geral</option>
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
  <section className="paper-surface mt-10 border p-6 sm:p-8">
    <SingleFlightForm action={startDraft} className="grid gap-5">
      <input name="idempotencyKey" type="hidden" value={randomUUID()} />
      <div className="flex items-start gap-4">
        <FileTextIcon
          aria-hidden="true"
          className="mt-1 size-7 shrink-0 text-brand-action-text"
        />
        <div>
          <h2 className="font-display text-3xl">Nova publicação</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground leading-7">
            Compartilhe uma ideia, um estudo ou uma referência com a comunidade.
          </p>
        </div>
      </div>
      <SpaceField initialSpaceId={initialSpaceId} spaces={spaces} />
      <SingleFlightSubmit className="w-fit" pendingLabel="Abrindo…">
        Continuar
      </SingleFlightSubmit>
    </SingleFlightForm>
  </section>
);
