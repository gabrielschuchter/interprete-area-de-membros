import type { ReactNode } from "react";
import { LearningFonts } from "@/components/learning/learning-fonts";

const RecordingRoomLayout = ({
  children,
}: {
  readonly children: ReactNode;
}) => <LearningFonts>{children}</LearningFonts>;

export default RecordingRoomLayout;
