import { CheckIcon, LockIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

// Same gradient and line art families as the Sala boards. Picked from the id
// so a course keeps its look everywhere without storing anything.
const hash = (value: string) => {
  let total = 0;
  for (const char of value) {
    total = (total * 31 + char.charCodeAt(0)) % 9973;
  }
  return total;
};

export const coverLook = (id: string) => ({
  art: String((hash(id) % 4) + 1),
  gradient: String((Math.floor(hash(id) / 4) % 4) + 1),
});

export const clock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${rest}`
    : `${String(minutes).padStart(2, "0")}:${rest}`;
};

export const CoverArt = ({ art }: { readonly art: string }) => (
  <span aria-hidden="true" className="cb-art" data-a={art} />
);

export const CourseCover = ({
  badge,
  barPercent,
  coverUrl,
  done,
  id,
  kind,
  locked,
  numeral,
  title,
}: {
  readonly badge?: ReactNode;
  readonly barPercent?: number | null;
  readonly coverUrl?: string | null;
  readonly done?: boolean;
  readonly id: string;
  readonly kind: string;
  readonly locked?: boolean;
  readonly numeral?: number;
  readonly title: string;
}) => {
  const look = coverLook(id);
  return (
    <span
      className="cb-cv"
      data-g={look.gradient}
      data-image={coverUrl ? "true" : undefined}
    >
      {coverUrl ? (
        <Image
          alt=""
          fill
          sizes="(min-width: 1024px) 360px, 100vw"
          src={coverUrl}
          unoptimized
        />
      ) : (
        <CoverArt art={look.art} />
      )}
      <span className="cb-cv__k">{kind}</span>
      {locked ? (
        <span className="cb-cv__lock">
          <LockIcon aria-hidden="true" size={14} />
        </span>
      ) : null}
      {!locked && done ? (
        <span aria-label="Concluído" className="cb-cv__done" role="img">
          <CheckIcon aria-hidden="true" size={15} strokeWidth={2.2} />
        </span>
      ) : null}
      {!(locked || done) && badge ? (
        <span className="cb-cv__badge">{badge}</span>
      ) : null}
      {numeral ? (
        <span className="cb-cv__num">{numeral}</span>
      ) : (
        <span className="cb-cv__t">{title}</span>
      )}
      {barPercent && barPercent > 0 && barPercent < 100 ? (
        <span aria-hidden="true" className="cb-cv__bar">
          <i style={{ width: `${barPercent}%` }} />
        </span>
      ) : null}
    </span>
  );
};
