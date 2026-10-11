import { ExerciseUnavailable } from "@/components/exercises/exercise-unavailable";

export default function SavedExerciseQuestionNotFound() {
  return (
    <ExerciseUnavailable
      description="Esta questão não está mais disponível entre as suas favoritas."
      title="Questão salva não encontrada."
    />
  );
}
