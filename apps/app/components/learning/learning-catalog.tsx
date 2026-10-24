import { BookmarkIcon, LockKeyholeIcon } from "lucide-react";
import Image from "next/image";
import { submitLearningBookmark } from "@/app/(authenticated)/biblioteca/actions";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import type { LearningRailCard } from "./learning-content-rail";

const catalogAction = (card: LearningRailCard) => {
  if (card.actionLabel) {
    return card.actionLabel;
  }
  if (card.progress === 100) {
    return "Rever curso";
  }
  if (card.progress) {
    return "Continuar aula";
  }
  return "Ver conteúdo";
};
export const CatalogBookmark = ({
  card,
}: {
  readonly card: LearningRailCard;
}) => {
  return card.bookmark && !card.disabled ? (
    <SingleFlightForm
      action={submitLearningBookmark}
      className="absolute top-2 right-2"
    >
      <input name="targetType" type="hidden" value={card.bookmark.targetType} />
      <input name="targetId" type="hidden" value={card.bookmark.targetId} />
      <input
        name="desired"
        type="hidden"
        value={card.bookmark.saved ? "off" : "on"}
      />
      <SingleFlightSubmit
        aria-label={
          card.bookmark.saved
            ? `Remover ${card.title} dos salvos`
            : `Salvar ${card.title}`
        }
        className="size-11 bg-white/95 text-brand-action-text"
        pendingLabel="…"
        size="icon"
        variant="outline"
      >
        <BookmarkIcon
          aria-hidden="true"
          className="size-4"
          fill={card.bookmark.saved ? "currentColor" : "none"}
        />
      </SingleFlightSubmit>
    </SingleFlightForm>
  ) : null;
};
export const LearningCatalog = ({
  cards,
  title,
  headingId,
}: {
  readonly cards: readonly LearningRailCard[];
  readonly title: string;
  readonly headingId: string;
}) =>
  cards.length > 0 ? (
    <section aria-labelledby={headingId} className="learning-catalog-section">
      <h2 id={headingId}>{title}</h2>
      <ul className="learning-catalog-grid">
        {cards.map((card) => (
          <li className="learning-catalog-card" key={card.href}>
            <div className="learning-catalog-cover">
              <Image
                alt=""
                fill
                sizes="(min-width: 768px) 480px, 100vw"
                src={card.coverUrl || "/brand/learning/course-study.svg"}
                unoptimized
              />
              <CatalogBookmark card={card} />
            </div>
            <div className="learning-catalog-copy">
              <h3>{card.title}</h3>
              {card.meta && <p>{card.meta}</p>}
              {card.description && (
                <p className="line-clamp-2">{card.description}</p>
              )}
              {typeof card.progress === "number" && (
                <div className="learning-catalog-progress">
                  <progress
                    aria-label={`Progresso de ${card.title}`}
                    max={100}
                    value={card.progress}
                  />
                  <span>{card.progress}% concluído</span>
                </div>
              )}
              {card.disabled ? (
                <p className="mt-auto flex items-center gap-2 pt-3">
                  <LockKeyholeIcon aria-hidden="true" className="size-4" />
                  Conteúdo ainda não liberado.
                </p>
              ) : (
                <IntentLink
                  className={`learning-catalog-action ${card.progress && card.progress < 100 ? "learning-catalog-action--primary" : ""}`}
                  href={card.href}
                >
                  {catalogAction(card)}
                </IntentLink>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
