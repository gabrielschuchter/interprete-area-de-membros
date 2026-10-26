import type { ReactNode } from "react";
import { LearningFonts } from "@/components/learning/learning-fonts";
import "./community-fidelity.css";

// The design system names Source Serif 4, Inter and IBM Plex Mono but only
// LearningFonts loads them; without it the Comunidade fell back to Georgia.
const CommunityLayout = ({ children }: { readonly children: ReactNode }) => (
  <LearningFonts>
    <div className="community-route">{children}</div>
  </LearningFonts>
);

export default CommunityLayout;
