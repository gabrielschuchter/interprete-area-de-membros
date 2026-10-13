import "./gestao/gestao.css";
import { GestaoRestrictedState } from "./gestao/restricted-state";

const MemberForbidden = () => (
  <main className="gestao-denied-shell" id="gestao-main-content">
    <GestaoRestrictedState withinGestao={false} />
  </main>
);

export default MemberForbidden;
