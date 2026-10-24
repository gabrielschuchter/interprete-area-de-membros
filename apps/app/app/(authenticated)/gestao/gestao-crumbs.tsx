"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface GestaoCrumb {
  readonly href?: string;
  readonly label: string;
}

interface GestaoCrumbsContextValue {
  readonly setTail: (items: readonly GestaoCrumb[]) => void;
  readonly tail: readonly GestaoCrumb[];
}

const GestaoCrumbsContext = createContext<GestaoCrumbsContextValue | null>(
  null
);

export const GestaoCrumbsProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [tail, setTail] = useState<readonly GestaoCrumb[]>([]);
  const value = useMemo(() => ({ setTail, tail }), [tail]);
  return (
    <GestaoCrumbsContext.Provider value={value}>
      {children}
    </GestaoCrumbsContext.Provider>
  );
};

export const useGestaoCrumbTail = () =>
  useContext(GestaoCrumbsContext)?.tail ?? [];

/**
 * Páginas profundas informam o trecho final da migalha (nome do curso, da
 * turma, "Entregas"). O trecho some quando a página sai.
 */
export const GestaoCrumbTail = ({
  items,
}: {
  readonly items: readonly GestaoCrumb[];
}) => {
  const context = useContext(GestaoCrumbsContext);
  const setTail = context?.setTail;
  const serialized = JSON.stringify(items);
  useEffect(() => {
    if (!setTail) {
      return;
    }
    setTail(JSON.parse(serialized) as readonly GestaoCrumb[]);
    return () => setTail([]);
  }, [serialized, setTail]);
  return null;
};
