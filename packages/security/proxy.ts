import { defaults, type Options, withVercelToolbar } from "@nosecone/next";

export { createMiddleware as securityMiddleware } from "@nosecone/next";

// Nosecone security headers configuration
// https://docs.arcjet.com/nosecone/quick-start
export const noseconeOptions: Options = {
  ...defaults,
  // Content Security Policy (CSP) is disabled by default because the values
  // depend on which Next Forge features are enabled. See
  // https://www.next-forge.com/packages/security/headers for guidance on how
  // to configure it.
  contentSecurityPolicy: false,
  // A área de membros incorpora o player do YouTube (aulas e vídeos da
  // Comunidade). Com COEP require-corp o navegador recusa o iframe
  // ("www.youtube-nocookie.com se recusou a se conectar"), porque o YouTube não
  // envia Cross-Origin-Resource-Policy. Nada aqui depende de isolamento entre
  // origens (SharedArrayBuffer), então o cabeçalho sai.
  crossOriginEmbedderPolicy: false,
  // O YouTube passou a exigir a origem de quem incorpora (erro 153 sem
  // Referer). Envia só a origem para outros sites, nunca o caminho.
  referrerPolicy: { policy: ["strict-origin-when-cross-origin"] },
};

export const noseconeOptionsWithToolbar: Options =
  withVercelToolbar(noseconeOptions);
