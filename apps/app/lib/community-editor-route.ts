/**
 * Rotas do editor de publicações da Comunidade. Nelas o cabeçalho do site, o
 * seletor da seção e a barra lateral saem de cena: o editor tem cabeçalho
 * próprio e o texto ocupa a tela. A pré-visualização é leitura, então mantém
 * o shell normal.
 */
export const isCommunityEditorRoute = (
  pathname: string,
  preview?: string | null
) => {
  if (pathname === "/comunidade/novo") {
    return true;
  }
  if (pathname.startsWith("/comunidade/editor/")) {
    return preview !== "1";
  }
  return false;
};
