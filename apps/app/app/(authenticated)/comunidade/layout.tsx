import type { ReactNode } from "react";
import "./community-fidelity.css";

const CommunityLayout = ({ children }: { readonly children: ReactNode }) => (
  <div className="community-route">{children}</div>
);

export default CommunityLayout;
