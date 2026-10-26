import type { ReactNode } from "react";
import { LearningFonts } from "@/components/learning/learning-fonts";
import "../comunidade/community-fidelity.css";

const MembersLayout = ({ children }: { readonly children: ReactNode }) => (
  <LearningFonts>
    <div className="community-route">{children}</div>
  </LearningFonts>
);

export default MembersLayout;
