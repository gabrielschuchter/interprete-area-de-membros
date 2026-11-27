import Image from "next/image";
import {
  exerciseCoverTheme,
  exerciseCoverThemes,
  exerciseVolumeLabel,
} from "@/lib/exercise-cover";

const HTTP_URL = /^https?:\/\//u;

const safeCoverUrl = (coverUrl: string | null) => {
  if (!(coverUrl && HTTP_URL.test(coverUrl))) {
    return null;
  }
  try {
    const url = new URL(coverUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? coverUrl.replace(/["\\\n\r]/gu, "")
      : null;
  } catch {
    return null;
  }
};

/**
 * Capa da lista: a imagem cadastrada, se houver; senão uma etiqueta sobre a
 * cor da coleção (tema deduzido do título) com o volume pela ordem da lista.
 * Proporção fixa 12:5; os textos escalam com a largura da capa.
 */
export const ExerciseListCover = ({
  bankTitle,
  className = "",
  coverUrl,
  listSlug,
  title,
  volume,
}: {
  readonly bankTitle: string;
  readonly className?: string;
  readonly coverUrl: string | null;
  readonly listSlug: string;
  readonly title: string;
  readonly volume?: number;
}) => {
  const alt = `Capa da lista: ${title}`;
  const custom = safeCoverUrl(coverUrl);
  if (custom) {
    return (
      <Image
        alt={alt}
        className={`${className} block aspect-[12/5] w-full bg-[#EADBD6] object-cover`}
        height={400}
        src={custom}
        unoptimized
        width={960}
      />
    );
  }
  const theme =
    exerciseCoverThemes[exerciseCoverTheme(title, bankTitle, listSlug)];
  return (
    <div
      aria-label={alt}
      className={`${className} @container relative flex aspect-[12/5] w-full items-center justify-center overflow-hidden`}
      role="img"
      style={{
        backgroundColor: theme.background,
        backgroundImage:
          "linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.1))",
      }}
    >
      <div aria-hidden="true" className="w-[62cqw] bg-[#F7F3F1] p-[1.4cqw]">
        <div className="flex flex-col items-center gap-[1.6cqw] border border-[#E9C48E] px-[3cqw] py-[3.2cqw] text-center">
          <span className="font-data text-[#7A1230] text-[max(9px,3cqw)] uppercase leading-[1.5] tracking-[.3em] [text-wrap:balance]">
            {theme.label}
          </span>
          {volume ? (
            <>
              <span className="flex items-center gap-[1.2cqw]">
                <span className="h-px w-[7cqw] bg-[#E2565A]" />
                <span className="size-[1.2cqw] min-h-1 min-w-1 rotate-45 bg-[#C8333F]" />
                <span className="h-px w-[7cqw] bg-[#E2565A]" />
              </span>
              <span className="font-display font-semibold text-[#410230] text-[max(17px,6.4cqw)] leading-none">
                {exerciseVolumeLabel(volume)}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
