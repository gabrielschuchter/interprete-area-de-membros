import { ExerciseUnavailable } from "@/components/exercises/exercise-unavailable";

export default function ExerciseSessionNotFound() {
  return (
    <ExerciseUnavailable
      description="Esta sessão não está mais disponível. Você pode começar uma nova a partir de uma lista."
      title="Sessão não encontrada."
    />
  );
}
