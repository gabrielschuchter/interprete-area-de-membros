import type { ReactNode } from "react";
import { ExerciseSessionDraftProvider } from "@/components/exercises/exercise-session-drafts";
import { ExerciseSessionMobileHeader } from "@/components/exercises/exercise-session-navigation";

interface ExerciseSessionLayoutProperties {
  readonly children: ReactNode;
  readonly params: Promise<{ readonly sessionId: string }>;
}

const ExerciseSessionLayout = async ({
  children,
  params,
}: ExerciseSessionLayoutProperties) => {
  const { sessionId } = await params;
  return (
    <ExerciseSessionDraftProvider key={sessionId} storageKey={sessionId}>
      <ExerciseSessionMobileHeader sessionId={sessionId} />
      {children}
    </ExerciseSessionDraftProvider>
  );
};

export default ExerciseSessionLayout;
