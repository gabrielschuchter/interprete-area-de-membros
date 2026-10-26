import type { BadgeCriterion } from "@repo/database";
import Image from "next/image";
import { badgeArtworkByCriterion } from "@/lib/badge-artwork";
import {
  conquestLabel,
  medalCriterionLabels,
} from "@/lib/gestao-medals-domain";

const sizes = [
  { label: "120 px", size: 120 },
  { label: "72 px", size: 72 },
  { label: "40 px", size: 40 },
] as const;

/** Palco escuro: a medalha em grande, nos tamanhos reais e bloqueada. */
export const MedalStage = ({
  criterion,
  threshold,
  title,
}: {
  readonly criterion: BadgeCriterion;
  readonly threshold: number;
  readonly title: string;
}) => {
  const art = badgeArtworkByCriterion[criterion];
  return (
    <div className="gk-stage">
      <div className="gk-stage-hero">
        <Image alt="" height={228} priority src={art} width={228} />
        <span aria-hidden="true" className="gk-museum-plinth" />
        <h2>{title}</h2>
        <p>
          {medalCriterionLabels[criterion]} · {threshold}
        </p>
      </div>
      <div className="gk-stage-sizes">
        {sizes.map(({ label, size }) => (
          <figure key={label}>
            <Image alt="" height={size} src={art} width={size} />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
        <span aria-hidden="true" className="gk-stage-sep" />
        <figure className="gk-stage-locked">
          <Image alt="" height={72} src={art} width={72} />
          <figcaption>Bloqueada</figcaption>
        </figure>
      </div>
    </div>
  );
};

export const stageCountLabel = conquestLabel;
