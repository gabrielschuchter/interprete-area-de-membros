import { Badge } from "@repo/design-system/components/ui/badge";
import Image from "next/image";
import { badgeArtworkByCriterion } from "@/lib/badge-artwork";
import type { ProfileBadgeDefinition } from "@/lib/profile-badge-catalog";

interface EarnedProfileBadge extends ProfileBadgeDefinition {
  readonly awardedAt: Date;
}

type ProfileBadgeCardItem = ProfileBadgeDefinition & {
  readonly awardedAt?: Date;
};

const BadgeGrid = ({
  badges,
  emptyMessage,
  status,
}: {
  readonly badges: readonly ProfileBadgeCardItem[];
  readonly emptyMessage: string;
  readonly status: "earned" | "available";
}) => {
  if (badges.length === 0) {
    return (
      <p className="mt-4 text-muted-foreground text-sm leading-6">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {badges.map((badge) => (
        <li className="paper-surface flex gap-3 border p-4" key={badge.id}>
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center"
          >
            <Image
              alt=""
              className="size-full object-contain"
              height={56}
              loading="lazy"
              sizes="56px"
              src={badgeArtworkByCriterion[badge.criterion]}
              width={56}
            />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-medium text-sm">{badge.title}</h4>
              <Badge variant="outline">
                {status === "earned" ? "Conquistada" : "Disponível"}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground text-xs leading-5">
              {badge.description}
            </p>
            {status === "earned" && badge.awardedAt ? (
              <time
                className="mt-2 block text-muted-foreground text-xs"
                dateTime={badge.awardedAt.toISOString()}
              >
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "medium",
                  timeZone: "America/Sao_Paulo",
                }).format(badge.awardedAt)}
              </time>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
};

export const ProfileBadges = ({
  availableBadges,
  earnedBadges,
}: {
  readonly availableBadges: readonly ProfileBadgeDefinition[];
  readonly earnedBadges: readonly EarnedProfileBadge[];
}) => (
  <section aria-labelledby="profile-badges-heading" className="mt-10">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div>
        <p className="brand-eyebrow">Reconhecimento</p>
        <h2 className="mt-2 font-display text-3xl" id="profile-badges-heading">
          Medalhas
        </h2>
      </div>
    </div>

    <section aria-labelledby="profile-earned-badges-heading" className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <p className="brand-eyebrow">Seu percurso</p>
          <h3
            className="mt-2 font-display text-2xl"
            id="profile-earned-badges-heading"
          >
            Conquistadas
          </h3>
        </div>
        <span className="font-data text-muted-foreground text-sm">
          {earnedBadges.length}
        </span>
      </div>
      <BadgeGrid
        badges={earnedBadges}
        emptyMessage="As conquistas aparecerão aqui quando você atingir os critérios."
        status="earned"
      />
    </section>

    <section
      aria-labelledby="profile-available-badges-heading"
      className="mt-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <p className="brand-eyebrow">Catálogo</p>
          <h3
            className="mt-2 font-display text-2xl"
            id="profile-available-badges-heading"
          >
            Disponíveis
          </h3>
        </div>
        <span className="font-data text-muted-foreground text-sm">
          {availableBadges.length}
        </span>
      </div>
      <BadgeGrid
        badges={availableBadges}
        emptyMessage="Nenhuma medalha está disponível no momento."
        status="available"
      />
    </section>
  </section>
);
