import { permanentRedirect } from "next/navigation";

// A Visão geral do Estudar saiu (05/11/2026): Cursos é a entrada da seção.
const LegacyStudyOverviewPage = () => permanentRedirect("/cursos");

export default LegacyStudyOverviewPage;
