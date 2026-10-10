import { ExerciseUnavailable } from "@/components/exercises/exercise-unavailable";

export default function ExerciseListNotFound() {
  return (
    <ExerciseUnavailable
      description="Esta lista não está disponível no momento. Você pode escolher outra lista para praticar."
      title="Lista sem questões disponíveis."
    />
  );
}
