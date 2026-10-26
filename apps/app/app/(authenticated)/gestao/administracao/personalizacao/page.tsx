import { requireGestaoAction } from "@/lib/gestao-authorization";
import { getCursosBlocks, getPortalNoteConfig } from "@/lib/personalization";
import { getProductConfig } from "@/lib/product-config";
import { PersonalizationEditor } from "./personalization-editor";

const GestaoPersonalizationPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const params = await searchParams;
  await requireGestaoAction("customization.manage");
  const [product, blocks, note] = await Promise.all([
    getProductConfig(),
    getCursosBlocks(),
    getPortalNoteConfig(),
  ]);
  return (
    <section className="gt-page gk-person-page">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Personalização</h1>
          <p>
            Decisões editoriais e de produto da experiência dos membros, com
            prévia antes de publicar.
          </p>
        </div>
      </header>
      {params.resultado === "publicado" ? (
        <output className="gk-result">
          Alterações publicadas. Os alunos já veem a nova configuração.
        </output>
      ) : null}
      <PersonalizationEditor
        initial={{
          blocks,
          note,
          recordingsExperienceV2: product.recordingsExperienceV2,
          showLearnNavigation: product.showLearnNavigation,
        }}
      />
    </section>
  );
};

export default GestaoPersonalizationPage;
