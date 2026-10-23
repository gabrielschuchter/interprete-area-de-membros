import type { ReactNode } from "react";
import { RoomPanelProvider } from "@/components/learning/room/room-panel-context";

const CourseLayout = ({ children }: { readonly children: ReactNode }) => (
  <RoomPanelProvider>{children}</RoomPanelProvider>
);

export default CourseLayout;
