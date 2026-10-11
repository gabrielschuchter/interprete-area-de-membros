import Image from "next/image";

export const ExerciseEmptyIllustration = () => (
  <Image
    alt=""
    aria-hidden="true"
    className="h-[110px] w-40 shrink-0"
    height={110}
    src="/exercises/empty-notebook.svg"
    unoptimized
    width={160}
  />
);
