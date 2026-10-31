# Vercel — área de membros e API

## Projetos

- Área de membros: `interprete-area-de-membros-app`, projeto
  `prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj`, root `apps/app`, Next.js, Node `24.x`.
- API: `interprete-area-de-membros-api`, projeto
  `prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6`, root `apps/api`, Next.js, Node `24.x`.
- A instalação usa Bun via `bun.lock` e Turborepo.
- O app Production atende `membros.escolainterprete.com.br`. Os aliases
  `interprete-area-de-membros.vercel.app` e
  `interprete-area-de-membros-app.vercel.app` são mantidos apenas como entradas
  de redirect para links históricos.
- A API mantém seu domínio Vercel próprio. Webhooks Clerk Production continuam
  em `/webhooks/auth` nesse projeto; nenhuma URL de webhook deve apontar ao app.

## Origins e variáveis

- `NEXT_PUBLIC_APP_URL` no app Production é
  `https://membros.escolainterprete.com.br`.
- O app resolve Preview em runtime/build pelo `VERCEL_BRANCH_URL`, com
  `VERCEL_URL` como fallback. A URL Production configurada não é usada para
  emitir links de Preview. Um Preview sem origin HTTPS próprio falha fechado.
- A metadata da API usa o hostname Production do próprio projeto e, em Preview,
  o branch/deployment Vercel da API; não usa o hostname Production como base de
  páginas Preview.
- O Clerk Production usa DNS/CNAME direto para sua Frontend API. O registro
  `clerk.membros` aponta para o target publicado pelo Clerk (`frontend-api.clerk.services`).
  Não configure proxy `/__clerk` ou variáveis `CLERK_PROXY_URL`,
  `NEXT_PUBLIC_CLERK_PROXY_URL`, `CLERK_FAPI` ou `NEXT_PUBLIC_CLERK_FAPI`.
- `CLERK_DISABLE_AUTO_PROXY=true` no app Production impede que o SDK escolha
  automaticamente `/__clerk` quando `VERCEL_PROJECT_PRODUCTION_URL` é um alias
  `vercel.app`. Essa variável deve estar presente no build e no runtime. Sua
  ausência fez o handshake de sessão expirada falhar com `host_invalid` em
  31/10/2026; validar a renovação de sessão após qualquer mudança de deployment.
- O Clerk Development local usa o par `pk_test_`/`sk_test_` e o Frontend API
  `accounts.dev` diretamente. Não copie chaves Production para local ou Preview.
- `PREVIEW_OUTBOX_RECOVERY_URL` é server-only no projeto API Production quando
  a recuperação Preview está habilitada. Deve apontar ao alias de Preview
  verificado do endpoint `/cron/outbox`; o código recusa HTTP, domínio que não
  seja `*.vercel.app`, host sem marcador de branch Vercel ou path diferente.

`DATABASE_URL` e `DIRECT_URL` permanecem configuradas como secrets/configs da
Vercel e não são registrados aqui. O runtime continua no pooler de transação do
Supabase; migrations usam o pooler de sessão. Chaves, secrets, webhook URLs e
tokens não devem ser copiados para esta documentação.

## Host guard e publicação

A regra de host guard `Community V2 compatible release hosts` continua ativa e
em prioridade 0. Ela aceita somente hostnames conferidos para o deployment
Production selecionado e para o Preview da mesma revisão quando necessário.
Não desabilite a regra para destravar um domínio. Use
`scripts/ops/community-release-host-guard.mjs`: dry-run, inspeção do digest,
stage e ativação com o digest exato. O CNAME `membros` da Vercel e os aliases
históricos precisam resolver para o deployment que contém os redirects.

Em 31/10/2026, `origin/main` (`f644467`) havia avançado com alterações de
produto e migrations não presentes no app em Production; o branch de domínio
divergia dele. A conexão Git automática da Vercel está desabilitada. Integre e
valide as duas linhas com QA e os gates de banco antes de publicar `main`; não
presuma que um deploy de `main` contenha esta correção. A promoção deve registrar o SHA do
código, deployment `READY`, aliases verificados e digest do firewall. Para
rollback, reatribua os aliases ao deployment Production anterior e restaure a
configuração Clerk correspondente antes de restaurar os redirects da Hostinger.

## Integração do site institucional

O site institucional está em `https://escolainterprete.com.br`, hospedado na
Hostinger. O projeto Git local não é a fonte da página publicada e o painel
Hostinger não tem repositório conectado. Os atalhos publicados ficam no bloco
`@atalhos-inicio` / `@atalhos-fim` de `public_html/.htaccess`:

| Entrada | Destino |
| --- | --- |
| `/entrar` | `https://membros.escolainterprete.com.br/sign-in` |
| `/criar-conta` | `https://membros.escolainterprete.com.br/sign-up` |
| `/membros` | `https://membros.escolainterprete.com.br/` |
| `/login` | `https://membros.escolainterprete.com.br/sign-in` |

Os atalhos continuam em `302` deliberadamente: são entradas operacionais do
site, e esse status permite rollback imediato sem cache permanente no navegador.
Eles sempre apontam ao origin canônico. Os dois aliases Vercel históricos usam
`308` porque só redirecionam navegação segura (`GET`/`HEAD`); mutações recebem
`421` sem replay do corpo. Preserve todo o restante do `.htaccess`, inclusive
CSP, regras do site e newsletter.

## Verificação de Production — 30/10/2026

Em 31/10/2026, o host canônico foi atribuído ao deployment de correção
`dpl_GjqW96cC3peZVjaCuSmZeLepUx5Q`, `READY`, construído a partir do SHA
`76a62e94d0f1137068925e8600d7e2a21b2f6ab4` com mudanças locais de documentação.
Os dois aliases Vercel históricos também foram atribuídos ao deployment corrigido
e redirecionam ao host canônico. A regra WAF `Community V2 compatible release
hosts` permanece ativa em modo `release`; nenhum bypass ou desativação foi usado.
Rollback imediato da correção de 31/10: deployment
`dpl_8MhPh2GpQttToAnPXw5qJf7eHmxa` (mas ele apresenta a falha de renovação de
sessão documentada abaixo). O deployment anterior ao cutover é
`dpl_HfdYrMaNLy3cE1DbbPvGfs3smwFm` (SHA
`a99ef910aaef3450385c00eb11b85db12bf3de10`, `READY`); sua reversão exige
restaurar também configuração Clerk, host guard e atalhos do site.

| Gate de produção | Estado observado |
| --- | --- |
| DNS do app | `membros` CNAME → `bbb51c26bfce45fc.vercel-dns-017.com`; os servidores autoritativos respondem com o target esperado. |
| HTTPS do app | Certificado TLS válido no host canônico. |
| Domínio Clerk/FAPI | `membros.escolainterprete.com.br` `Verified`; `clerk.membros` CNAME → `frontend-api.clerk.services`, `Verified`; `/v1/health` retornou HTTP 200 com TLS válido. |
| E-mail Clerk | Os três CNAMEs abaixo estão propagados e `Email 3/3 Verified`; Clerk informa certificado SSL emitido. |
| Navegação pública | `/`, `/sign-in`, `/sign-up` e rota protegida anônima respondem com os destinos esperados. Os aliases Vercel fazem redirect `308` preservando path/query; métodos de escrita recebem `421`. |
| Site institucional | `/entrar`, `/criar-conta`, `/membros` e `/login` chegam ao host canônico em desktop e viewport móvel. |
| Dados | Nenhuma alteração de Supabase, schema, usuários, papéis ou permissões foi feita. |

Registros de e-mail Clerk publicados na zona DNS Hostinger (TTL 14400):

| Nome | Tipo | Destino |
| --- | --- | --- |
| `clkmail.membros` | CNAME | `mail.gxrbxlyw7jo4.clerk.services` |
| `clk._domainkey.membros` | CNAME | `dkim1.gxrbxlyw7jo4.clerk.services` |
| `clk2._domainkey.membros` | CNAME | `dkim2.gxrbxlyw7jo4.clerk.services` |

O login inicial e acesso autenticado foram verificados em 30/10. Em 31/10, a
renovação de uma sessão expirada revelou `host_invalid` no caminho automático
`/__clerk`; após o deployment com a variável acima, o proprietário confirmou a
abertura e a sessão autenticada foi observada no host canônico.
Recuperação de senha e entrega efetiva de e-mail não foram testadas com envio.
O domínio Clerk
antigo continua listado como `Checking` e não é destino público; mantê-lo nesta
janela conserva opção de rollback. A mudança de origin pode exigir novo login
por causa do escopo dos cookies, sem alterar identidade ou dados persistidos.

Em 31/10, os atalhos institucionais haviam voltado ao alias antigo. Foram
corrigidos novamente no `.htaccess` ativo, preservando regras adicionais de
blog. O arquivo declara geração por scripts que não foram encontrados nos
repositórios locais ou no Git conectado da Hostinger; atualizar a fonte real do
build é pendência para impedir que uma futura publicação reverta os destinos.
