import { LockKeyholeIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityPostView } from "@/components/community/community-post-view";
import { StudyHeartbeat } from "@/components/learning/study-heartbeat";
import { getMemberRole } from "@/lib/authorization";
import {
  getCommunityPostBySlug,
  isPrivateGroupPostSlug,
} from "@/lib/community";
import {
  communityReturnLabel,
  parseCommunityReturnTo,
} from "@/lib/community-query";
import { requireMemberId } from "@/lib/learning";
import { getOrCreateProfile } from "@/lib/profile";

interface CommunityPublicationPageProperties {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<{
    commentId?: string;
    commentsPage?: string;
    from?: string;
  }>;
}

const PrivateGroupPostNotice = () => (
  <div className="community-page min-h-svh bg-background">
    <main className="community-shell mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 pt-24 text-center">
      <LockKeyholeIcon
        aria-hidden="true"
        className="size-16 text-brand-structural"
      />
      <h1 className="font-display text-2xl">
        Esta publicação é de um grupo privado
      </h1>
      <p className="text-muted-foreground text-sm leading-6">
        Só membros do grupo podem ler e participar. Peça um convite a quem
        compartilhou o link.
      </p>
      <Link
        className="mt-1 inline-flex h-11 items-center rounded-md border-2 border-brand-structural px-5 font-semibold text-brand-structural text-sm"
        href="/comunidade"
      >
        Ir para a Comunidade
      </Link>
    </main>
  </div>
);

const CommunityPublicationPage = async ({
  params,
  searchParams,
}: CommunityPublicationPageProperties) => {
  const { slug } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const commentsPage = Number.parseInt(filters.commentsPage ?? "1", 10);
  const [role, post, currentProfile] = await Promise.all([
    getMemberRole(memberId),
    getCommunityPostBySlug(slug, memberId, commentsPage, filters.commentId),
    getOrCreateProfile(memberId, false),
  ]);

  if (!post) {
    if (await isPrivateGroupPostSlug(slug)) {
      return <PrivateGroupPostNotice />;
    }
    notFound();
  }

  return (
    <>
      <StudyHeartbeat activityKind="COMMUNITY" resourceId={post.id} />
      <CommunityPostView
        backHref={parseCommunityReturnTo(filters.from)}
        backLabel={communityReturnLabel(filters.from)}
        currentProfile={currentProfile}
        memberId={memberId}
        post={post}
        role={role}
      />
    </>
  );
};

export default CommunityPublicationPage;
