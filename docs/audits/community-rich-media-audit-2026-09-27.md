# Auditoria de rich media da Comunidade — 2026-09-27

## Baseline antes desta fase

O conteúdo da Comunidade é persistido em `CommunityPost.contentJson`, usando o
documento JSON do TipTap. A autorização continua separada da identidade: o
Clerk autentica a sessão, enquanto a aplicação verifica o membro, o papel e a
referência publicada antes de servir assets privados.

| Função | Existe | Funciona | Problema observado | Será alterada? |
| --- | --- | --- | --- | --- |
| Imagem inline | Sim | Sim | Upload JPG/PNG/WebP, normalização para WebP e renderização no post; não havia preview no feed | Sim, apresentação no feed e dimensões persistidas |
| Capa | Sim | Sim | Asset privado e renderização na página/feed; proporção fixa sem metadata própria | Sim, placeholder e card editorial |
| Múltiplas imagens | Sim | Sim | O editor aceita vários nós `image` ao longo da edição; o feed ignorava `contentJson` | Sim, galeria limitada no feed |
| Vídeo | Não na Comunidade | Não aplicável | Vídeos existentes pertencem ao pipeline de aulas/recordings, sem nó ou relação com `CommunityPost` | Sim, somente embed externo reconhecido e lazy |
| Embed | Parcial | Parcial | O editor possui apenas marca de link; não há nó de embed | Sim, YouTube/Vimeo reconhecidos viram mídia embed |
| Link | Sim | Sim | Link HTTP(S) sanitizado no documento, mas sem cartão no feed | Sim, fallback editorial por domínio |
| PDF | Fora da Comunidade | Sim na Biblioteca para staff | `member-assets` já valida PDF privado para `LibraryItem`, mas membros não tinham anexo no post | Sim, anexo comunitário autorizado |
| Arquivo | Fora da Comunidade | Parcial | Biblioteca aceita imagem/PDF/texto para staff; não havia anexo de post | Sim, PDF/texto como arquivo seguro e explícito |
| Artigo científico | Parcial | Sim na Biblioteca | `LibraryItem` já guarda autores, ano, DOI e PMID, mas não há relação nem metadata estruturada de periódico no post | Sim, nó de artigo com DOI e metadata Crossref persistida quando disponível |
| Storage privado | Sim | Sim | Rota server-side gera URL assinada e faz proxy same-origin com autorização | Preservado; apenas novo prefixo de anexo |
| Segurança de asset | Sim | Sim | `canReadMemberAssetPath` diferencia autor, audiência publicada e staff; cleanup remove referências abandonadas | Sim, incluir anexos no mesmo fluxo |
| Performance | Parcial | Sim | Feed não fazia fetch externo nem carregava conteúdo rico; também não apresentava a mídia existente | Sim, extrair dados do JSON em lote, no máximo poucos previews, sem fetch por render |

## Decisões de escopo

- Não foi criado sistema de autenticação, relação nova com Clerk ou bucket
  público.
- Não será feito fetch de Open Graph em cada card. Links sem metadata persistida
  terão fallback por domínio e ação de abertura.
- Artigo científico só exibe título, autores, periódico, ano ou DOI quando
  esses valores estiverem armazenados ou forem retornados por uma consulta real
  ao Crossref no momento de salvar/publicar. Falha ou ausência de metadata vira
  fallback, nunca conteúdo inventado.
- Upload comunitário novo fica limitado a PDF e texto simples. Outros formatos
  não serão anunciados como suportados sem validação de assinatura, MIME e
  comportamento de download.
- Imagens do feed usam a mesma rota autorizada em variante thumbnail WebP,
  gerada somente depois da checagem de sessão/referência; a leitura detalhada
  mantém o asset completo e as dimensões persistidas reservam o espaço antes
  do carregamento.
