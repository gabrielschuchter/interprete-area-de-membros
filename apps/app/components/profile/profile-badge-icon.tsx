import type { BadgeCriterion } from "@repo/database";
import Image from "next/image";
import { badgeImageFor } from "@/lib/badge-artwork";

/** A mesma imagem da medalha em toda a plataforma; apagada enquanto não conquistada. */
export const ProfileBadgeIcon = ({
  criterion,
  earned = false,
  imageUrl,
  size = "default",
}: {
  readonly criterion: BadgeCriterion;
  readonly earned?: boolean;
  readonly imageUrl?: string | null;
  readonly size?: "default" | "small";
}) => {
  const dimension = size === "small" ? 40 : 52;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center"
      style={{ height: dimension, width: dimension }}
    >
      <Image
        alt=""
        className={`size-full object-contain ${earned ? "" : "opacity-45 grayscale"}`}
        height={dimension}
        loading="lazy"
        sizes={`${dimension}px`}
        src={badgeImageFor({ criterion, imageUrl })}
        unoptimized={Boolean(imageUrl?.startsWith("https://"))}
        width={dimension}
      />
    </span>
  );
};
