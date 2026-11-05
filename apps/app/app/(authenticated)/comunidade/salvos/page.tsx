import { permanentRedirect } from "next/navigation";

// Salvos é um só (05/11/2026): as publicações salvas da Comunidade aparecem
// no Salvos global, filtradas por "Comunidade".
const LegacyCommunitySavedPage = () =>
  permanentRedirect("/salvos?tipo=comunidade");

export default LegacyCommunitySavedPage;
