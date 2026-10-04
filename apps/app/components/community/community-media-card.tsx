import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileTextIcon,
  VideoIcon,
} from "lucide-react";
import {
  type CommunityMediaItem,
  communityMediaImageUrl,
  communityMediaTypeLabel,
  directVideoUrl,
  formatCommunityFileSize,
  videoEmbedFromUrl,
} from "@/lib/community-media";

interface CommunityMediaCardProperties {
  readonly compact?: boolean;
  readonly item: CommunityMediaItem;
  readonly thumbnail?: boolean;
}

const externalLinkProperties = {
  rel: "noreferrer",
  target: "_blank",
} as const;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one media card intentionally selects the safe presentation for image, video, article, file, and link fallbacks.
function CommunityMediaCard({
  compact = false,
  item,
  thumbnail = false,
}: CommunityMediaCardProperties) {
  if (item.kind === "image") {
    const aspectRatio =
      item.width && item.height ? `${item.width} / ${item.height}` : undefined;
    return (
      <figure className="community-media-card__image overflow-hidden rounded-sm border bg-muted">
        {/* biome-ignore lint/performance/noImgElement: private or external media may not be configured for next/image. */}
        <img
          alt={item.alt ?? ""}
          className="h-auto max-h-[34rem] w-full object-contain"
          decoding="async"
          height={item.height ?? 675}
          loading="lazy"
          referrerPolicy="no-referrer"
          src={communityMediaImageUrl(item.src, thumbnail ? "thumb" : "full")}
          style={aspectRatio ? { aspectRatio } : undefined}
          width={item.width ?? 1200}
        />
      </figure>
    );
  }

  if (item.kind === "video") {
    const embed = videoEmbedFromUrl(item.src);
    if (embed) {
      return (
        <figure className="community-media-card__video overflow-hidden rounded-sm border bg-black">
          <div className="aspect-video">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              className="size-full"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              src={embed.src}
              title={item.title ?? `${embed.provider} · vídeo`}
            />
          </div>
          <figcaption className="flex items-center gap-2 bg-background px-3 py-2 text-muted-foreground text-xs">
            <VideoIcon aria-hidden="true" className="size-3.5" />
            {item.title ?? `${embed.provider} · vídeo`}
          </figcaption>
        </figure>
      );
    }

    const directUrl = directVideoUrl(item.src);
    if (directUrl) {
      return (
        <figure className="community-media-card__video overflow-hidden rounded-sm border bg-black">
          {/* biome-ignore lint/a11y/useMediaCaption: direct community URLs do not provide a trustworthy caption track; inventing one would be misleading. */}
          <video
            className="max-h-[34rem] w-full"
            controls
            preload="none"
            src={directUrl}
          />
          <figcaption className="flex items-center gap-2 bg-background px-3 py-2 text-muted-foreground text-xs">
            <VideoIcon aria-hidden="true" className="size-3.5" />
            {item.title ?? "Vídeo"}
          </figcaption>
        </figure>
      );
    }
  }

  if (item.kind === "article") {
    return (
      <article className="community-media-card community-media-card--article">
        <BookOpenIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-brand-action-text"
        />
        <div className="min-w-0 flex-1">
          <p className="brand-eyebrow">Artigo científico</p>
          <h4 className="mt-2 break-words font-display text-xl leading-tight">
            {item.title ?? "Abrir referência científica"}
          </h4>
          {(item.authors || item.journal || item.year) && (
            <p className="mt-2 text-muted-foreground text-sm leading-6">
              {[item.authors, item.journal, item.year]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {item.doi && (
            <p className="mt-2 break-all font-data text-muted-foreground text-xs">
              DOI: {item.doi}
            </p>
          )}
          <a
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-sm px-3 text-sm underline underline-offset-4 hover:text-brand-structural focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
            href={item.url ?? item.src}
            {...externalLinkProperties}
          >
            Abrir artigo{" "}
            <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </article>
    );
  }

  if (item.kind === "file") {
    const size = formatCommunityFileSize(item.sizeBytes);
    return (
      <article className="community-media-card community-media-card--file">
        <FileTextIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-brand-action-text"
        />
        <div className="min-w-0 flex-1">
          <p className="brand-eyebrow">{communityMediaTypeLabel(item)}</p>
          <h4 className="mt-2 break-words font-medium text-sm">
            {item.name ?? "Arquivo"}
          </h4>
          {(item.mimeType || size) && (
            <p className="mt-1 text-muted-foreground text-xs">
              {[item.mimeType, size].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <a
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-sm px-3 text-sm underline underline-offset-4 hover:text-brand-structural focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
          href={item.src}
          {...externalLinkProperties}
        >
          Abrir <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
        </a>
      </article>
    );
  }

  return (
    <article
      className={`community-media-card community-media-card--link ${compact ? "community-media-card--compact" : ""}`}
    >
      <ExternalLinkIcon
        aria-hidden="true"
        className="size-5 shrink-0 text-brand-action-text"
      />
      <div className="min-w-0 flex-1">
        <p className="brand-eyebrow">Link</p>
        <h4 className="mt-2 break-words font-medium text-sm">
          {item.title ?? item.domain ?? "Referência externa"}
        </h4>
        {item.domain && (
          <p className="mt-1 truncate text-muted-foreground text-xs">
            {item.domain}
          </p>
        )}
      </div>
      <a
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-sm px-3 text-sm underline underline-offset-4 hover:text-brand-structural focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
        href={item.url ?? item.src}
        {...externalLinkProperties}
      >
        Abrir <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
      </a>
    </article>
  );
}

interface CommunityMediaGalleryProperties {
  readonly items: readonly CommunityMediaItem[];
  readonly thumbnail?: boolean;
}

export const CommunityMediaGallery = ({
  items,
  thumbnail = false,
}: CommunityMediaGalleryProperties) => {
  if (items.length === 0) {
    return null;
  }
  const images = items.filter((item) => item.kind === "image");
  const attachments = items.filter((item) => item.kind !== "image");

  return (
    <div className="mt-5 space-y-3">
      {images.length > 0 && (
        <div className={images.length === 1 ? "" : "grid gap-2 sm:grid-cols-2"}>
          {images.map((item) => (
            <CommunityMediaCard
              item={item}
              key={`${item.kind}:${item.src}`}
              thumbnail={thumbnail}
            />
          ))}
        </div>
      )}
      {attachments.map((item) => (
        <CommunityMediaCard
          compact
          item={item}
          key={`${item.kind}:${item.src}`}
          thumbnail={thumbnail}
        />
      ))}
    </div>
  );
};

export { CommunityMediaCard };
