"use client";

import { useEffect, useState } from "react";
import { safeGestaoReturnPath } from "@/lib/gestao-navigation";

export const useGestaoReturnPath = (memberId: string, from: string | null) => {
  const [remembered, setRemembered] = useState({
    memberId,
    path: safeGestaoReturnPath(from),
  });
  useEffect(() => {
    const key = `interprete:gestao:return:v1:${memberId}`;
    try {
      const next = safeGestaoReturnPath(from ?? sessionStorage.getItem(key));
      setRemembered({ memberId, path: next });
      sessionStorage.setItem(key, next);
    } catch {
      if (from !== null) {
        setRemembered({ memberId, path: safeGestaoReturnPath(from) });
      }
    }
  }, [from, memberId]);
  if (from !== null) {
    return safeGestaoReturnPath(from);
  }
  return remembered.memberId === memberId ? remembered.path : "/estudar";
};
