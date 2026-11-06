import type { ReactNode } from "react";
import "./community-editor.css";
import "./community-fidelity.css";
import "./community-cover-adjust.css";
import "./community-post.css";

const CommunityLayout = ({ children }: { readonly children: ReactNode }) => (
  <div className="community-route">{children}</div>
);

export default CommunityLayout;
