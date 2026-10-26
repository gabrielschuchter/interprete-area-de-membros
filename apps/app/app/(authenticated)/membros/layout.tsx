import type { ReactNode } from "react";
import "../comunidade/community-fidelity.css";

const MembersLayout = ({ children }: { readonly children: ReactNode }) => (
  <div className="community-route">{children}</div>
);

export default MembersLayout;
