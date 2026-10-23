"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type RoomPanelKey = "aulas" | "notas" | "tempo";

interface RoomPanelContextValue {
  readonly panel: RoomPanelKey | null;
  readonly setPanel: (panel: RoomPanelKey | null) => void;
}

const RoomPanelContext = createContext<RoomPanelContextValue | null>(null);

const isLessonPath = (pathname: string) =>
  pathname.split("/").filter(Boolean).length === 3;

// Lives in the course layout so switching lessons keeps the panel as it is.
// Entering the room from anywhere else starts with the panel hidden, and the
// state is never persisted between visits.
export const RoomPanelProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const pathname = usePathname();
  const [panel, setPanelState] = useState<RoomPanelKey | null>(null);
  const onLessonPath = isLessonPath(pathname);

  useEffect(() => {
    if (!onLessonPath) {
      setPanelState(null);
    }
  }, [onLessonPath]);

  const setPanel = useCallback(
    (next: RoomPanelKey | null) => setPanelState(next),
    []
  );
  const value = useMemo(() => ({ panel, setPanel }), [panel, setPanel]);

  return (
    <RoomPanelContext.Provider value={value}>
      {children}
    </RoomPanelContext.Provider>
  );
};

const standalonePanel: RoomPanelContextValue = {
  panel: null,
  setPanel: () => undefined,
};

export const useRoomPanel = () => {
  const context = useContext(RoomPanelContext);
  const [localPanel, setLocalPanel] = useState<RoomPanelKey | null>(null);
  if (context) {
    return context;
  }
  return { ...standalonePanel, panel: localPanel, setPanel: setLocalPanel };
};
