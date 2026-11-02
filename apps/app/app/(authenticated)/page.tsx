import type { Metadata } from "next";
import { PortalView } from "@/components/portal/portal-view";
import { requireOnboardedMemberId } from "@/lib/authorization";
import { getPortalNoteText } from "@/lib/personalization";

const PortalPage = async () => {
  const memberId = await requireOnboardedMemberId();
  const note = await getPortalNoteText(memberId);
  return (
    <>
      <link
        as="image"
        fetchPriority="high"
        href="/portal/art-1250-e5b2e48dfe.webp"
        media="(min-width: 700px) and (min-height: 521px)"
        rel="preload"
        type="image/webp"
      />
      <link
        as="image"
        fetchPriority="high"
        href="/portal/mobile-estudar-3979b5ac.webp"
        media="(max-width: 699px), (max-height: 520px) and (min-width: 700px)"
        rel="preload"
        type="image/webp"
      />
      <link
        as="image"
        fetchPriority="high"
        href="/portal/mobile-comunidade-fc58e6afaa.webp"
        media="(max-width: 699px), (max-height: 520px) and (min-width: 700px)"
        rel="preload"
        type="image/webp"
      />
      <PortalView note={note} />
    </>
  );
};

export default PortalPage;

export const metadata: Metadata = { title: "Início | Interprete" };
