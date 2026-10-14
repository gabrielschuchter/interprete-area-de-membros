import { PortalView } from "@/components/portal/portal-view";

const PortalPage = () => (
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
    <PortalView />
  </>
);

export default PortalPage;
