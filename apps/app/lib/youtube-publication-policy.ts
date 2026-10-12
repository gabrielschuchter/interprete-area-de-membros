import type { YouTubeVerificationResult } from "./youtube-verification";

export const youtubePublicationIssue = (
  verification: YouTubeVerificationResult
) => {
  if (
    (verification.status === "UNLISTED" || verification.status === "PUBLIC") &&
    verification.metadata?.embeddable === true
  ) {
    return null;
  }

  switch (verification.status) {
    case "EMBEDDING_DISABLED":
      return "Ative a incorporação do vídeo no YouTube antes de publicar.";
    case "INVALID":
      return "Confira o link do vídeo do YouTube antes de publicar.";
    case "NOT_CONFIGURED":
      return "Configure a chave do YouTube no servidor antes de publicar este vídeo.";
    case "PRIVATE_OR_NOT_FOUND":
      return "O vídeo está privado ou não foi encontrado. Use um vídeo não listado.";
    case "UNREACHABLE":
      return "Não foi possível verificar o vídeo. Tente publicar novamente.";
    default:
      return "O vídeo precisa estar disponível e permitir incorporação.";
  }
};
