import type { JSONContent } from "@tiptap/core";
import { redirect } from "next/navigation";
import { CommunityComposer } from "@/components/community/community-composer";
import { getCommunitySpaces } from "@/lib/community";
import { safeCommunityReturnPath } from "@/lib/community-return-path";
import { requireMemberId } from "@/lib/learning";
import { readIdempotencyKey } from "@/lib/mutation-contract";

interface NewCommunityContentPageProperties {
  readonly searchParams: Promise<{
    idempotencyKey?: string;
    returnTo?: string;
    spaceId?: string;
  }>;
}

const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const NewCommunityContentPage = async ({
  searchParams,
}: NewCommunityContentPageProperties) => {
  const [filters, memberId] = await Promise.all([
    searchParams,
    requireMemberId(),
  ]);
  const idempotencyKey = readIdempotencyKey(filters.idempotencyKey);
  if (!idempotencyKey) {
    redirect("/comunidade");
  }
  const spaces = await getCommunitySpaces(memberId);
  const space = spaces.find(({ id }) => id === filters.spaceId) ?? null;
  const returnTo = safeCommunityReturnPath(filters.returnTo);

  return (
    <div className="min-h-svh bg-background">
      <main className="community-editor-shell mx-auto w-full">
        <h1 className="sr-only">Escrever publicação</h1>
        <CommunityComposer
          backHref={
            returnTo ??
            (space ? `/comunidade/grupos/${space.slug}` : "/comunidade")
          }
          idempotencyKey={idempotencyKey}
          initialContent={emptyDocument}
          initialCoverUrl={null}
          initialSpaceId={space?.id ?? null}
          initialSpaceSlug={space?.slug ?? null}
          initialSubtitle={null}
          initialTags={[]}
          initialTitle="Rascunho sem título"
          initialUpdatedAt={null}
          postId={null}
          spaces={spaces.map(({ id, slug, title }) => ({ id, slug, title }))}
          status="DRAFT"
        />
      </main>
    </div>
  );
};

export default NewCommunityContentPage;
