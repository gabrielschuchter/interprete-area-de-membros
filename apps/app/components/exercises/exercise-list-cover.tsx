import Image from "next/image";
import { exerciseCoverSrc } from "@/lib/exercise-cover";

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
 * Capa da lista: a imagem cadastrada, se houver; senão a capa da coleção
 * (tema e volume deduzidos do título). Proporção fixa 12:5.
 */
export const ExerciseListCover = ({
  bankTitle,
  className = "",
  coverUrl,
  listSlug,
  title,
}: {
  readonly bankTitle: string;
  readonly className?: string;
  readonly coverUrl: string | null;
  readonly listSlug: string;
  readonly title: string;
}) => (
  <Image
    alt={`Capa da lista: ${title}`}
    className={`${className} block aspect-[12/5] w-full bg-[#EADBD6] object-cover`}
    height={400}
    src={safeCoverUrl(coverUrl) ?? exerciseCoverSrc(title, bankTitle, listSlug)}
    unoptimized
    width={960}
  />
);
