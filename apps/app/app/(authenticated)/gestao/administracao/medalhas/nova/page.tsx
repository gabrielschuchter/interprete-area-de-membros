import { requireGestaoAction } from "@/lib/gestao-authorization";
import { GestaoCrumbTail } from "../../../gestao-crumbs";
import { MedalForm } from "../medal-form";

const GestaoNewMedalPage = async () => {
  await requireGestaoAction("badges.manage");
  return (
    <section className="gt-page">
      <GestaoCrumbTail items={[{ label: "Nova medalha" }]} />
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Nova medalha</h1>
          <p>
            Ela nasce como rascunho. O símbolo é a arte padrão do critério
            escolhido; publique quando o texto estiver pronto.
          </p>
        </div>
      </header>
      <div className="gk-person-main gk-narrow">
        <MedalForm
          awards={0}
          initial={{
            criterion: "LESSONS_COMPLETED",
            description: "",
            id: null,
            threshold: 1,
            title: "",
          }}
        />
      </div>
    </section>
  );
};

export default GestaoNewMedalPage;
