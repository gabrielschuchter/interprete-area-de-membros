import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { memberActivitiesEnabled } from "@/lib/member-features";

/** A área fica fora do ar sem apagar nada; ver lib/member-features.ts. */
const ActivitiesLayout = ({ children }: { readonly children: ReactNode }) => {
  if (!memberActivitiesEnabled) {
    notFound();
  }
  return children;
};

export default ActivitiesLayout;
