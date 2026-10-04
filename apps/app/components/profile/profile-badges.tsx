import { Badge } from "@repo/design-system/components/ui/badge";
import { AwardIcon } from "lucide-react";

interface ProfileBadgeItem {
  readonly awardedAt: Date;
  readonly description: string;
  readonly id: string;
  readonly title: string;
}

export const ProfileBadges = ({
  badges,
}: {
  readonly badges: readonly ProfileBadgeItem[];
}) => (
  <section aria-labelledby="profile-badges-heading" className="mt-10">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div>
        <p className="brand-eyebrow">Conquistas</p>
        <h2 className="mt-2 font-display text-3xl" id="profile-badges-heading">
          Medalhas
        </h2>
      </div>
      <span className="font-data text-muted-foreground text-sm">
        {badges.length}
      </span>
    </div>
    {badges.length === 0 ? (
      <p className="mt-4 text-muted-foreground text-sm leading-6">
        As medalhas conquistadas ao longo do percurso aparecerão aqui.
      </p>
    ) : (
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {badges.map((badge) => (
          <li className="paper-surface flex gap-3 border p-4" key={badge.id}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-action/10 text-brand-action-text">
              <AwardIcon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-sm">{badge.title}</h3>
                <Badge variant="outline">Conquistada</Badge>
              </div>
              <p className="mt-1 text-muted-foreground text-xs leading-5">
                {badge.description}
              </p>
              <time
                className="mt-2 block text-muted-foreground text-xs"
                dateTime={badge.awardedAt.toISOString()}
              >
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "medium",
                  timeZone: "America/Sao_Paulo",
                }).format(badge.awardedAt)}
              </time>
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);
