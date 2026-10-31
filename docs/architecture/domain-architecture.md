# Arquitetura de domínios

## Mapa público

| Serviço | Origin canônico | Responsabilidade |
| --- | --- | --- |
| Site institucional | `https://escolainterprete.com.br` | Conteúdo e aquisição |
| Área de membros | `https://membros.escolainterprete.com.br` | Aplicação autenticada |
| Clerk Frontend API | `https://clerk.membros.escolainterprete.com.br` | Sessões e endpoints do SDK Clerk |
| API | URL Production própria da Vercel | Webhooks e rotas de infraestrutura |

O CNAME `membros` aponta para o destino que a Vercel mostra para o projeto da
área de membros. O CNAME `clerk.membros` aponta para `frontend-api.clerk.services`,
como mostrado na tela de domínios da instância Clerk Production. Esses registros
são independentes; não substitua o CNAME do app pelo destino do Clerk.

## Resolução por ambiente

- Production: `NEXT_PUBLIC_APP_URL=https://membros.escolainterprete.com.br`;
  o resolver rejeita origins ausentes ou não HTTPS.
- Preview: links e `authorizedParties` usam `VERCEL_BRANCH_URL`, com
  `VERCEL_URL` como fallback HTTPS. Um Preview sem origin próprio falha fechado
  em vez de enviar usuários ao app publicado.
- Desenvolvimento: `http://localhost` é permitido somente em loopback; outros
  hosts exigem HTTPS. O Clerk local usa a instância Development diretamente.

O mesmo resolver alimenta metadata, convites, compartilhamentos e links de
calendário. O valor do cabeçalho `Host` não define URLs públicas. A API usa o
hostname Production do próprio projeto e o origin branch/deployment da Vercel
em Preview.

## Clerk e cookies

A aplicação mantém uma instância Clerk Production e uma Development. A FAPI
Production usa CNAME direto; o proxy `/__clerk` era uma adaptação ao host Vercel
controlado pelo provedor e foi removido. A allowlist `authorizedParties` aceita
somente o origin Production canônico ou origins HTTPS do Preview atual.

O cookie de sessão Clerk fica no host do app; o cookie de cliente fica no host
da FAPI. O navegador não envia cookies do antigo domínio `vercel.app` aos novos
hosts. Pode ser necessário entrar novamente uma vez, sem recriar usuários nem
alterar dados, papéis ou sessões persistidas no Clerk.

## Links e compatibilidade

O site institucional encaminha `/entrar` para `/sign-in`, `/criar-conta` para
`/sign-up`, e `/membros` para `/`. `/login` também converge para `/sign-in`.
Convites, compartilhamentos e notificações devem gerar links no origin do
ambiente vigente.

Os dois aliases `vercel.app` históricos permanecem ligados à Vercel apenas para
redirecionar `GET`/`HEAD` com `308`, preservando path e query. Requisições que
possam alterar dados recebem `421` sem replay do corpo. Não use esses aliases em
CTAs, convites ou mensagens novas.

## Operação e segurança

- A regra de host guard da Vercel permanece ativa; o release valida deployment,
  SHA, aliases e digest antes da ativação.
- O site Hostinger não possui repositório Git conectado. Os quatro atalhos
  estão no bloco gerenciado de `public_html/.htaccess`; a atualização não altera
  as regras do site, CSP, e-mail, DNS do root ou outros rewrites.
- Webhooks Clerk continuam no projeto API em `/webhooks/auth`; a mudança do
  origin do app não altera o destino nem o segredo do webhook.
- O worker de recuperação Preview recebe sua URL de branch Vercel pela variável
  server-only `PREVIEW_OUTBOX_RECOVERY_URL`; o código valida HTTPS, host de
  Preview e o caminho `/cron/outbox`.
- CORS não é aberto entre os dois sites: os links são navegações de browser, e
  as operações autenticadas continuam no origin do app.

## Estado confirmado em Production — 30/10/2026

- Vercel: desde 31/10, `membros.escolainterprete.com.br` atende o deployment
  `dpl_GjqW96cC3peZVjaCuSmZeLepUx5Q`; aliases Vercel antigos redirecionam e não
  são destinos de links novos. Veja a proveniência e o rollback no runbook.
- Hostinger: o CNAME `membros` aponta para
  `bbb51c26bfce45fc.vercel-dns-017.com`; os CNAMEs do FAPI e de e-mail do Clerk
  estão publicados e verificados. Não houve alteração em MX, SPF ou DMARC do
  domínio raiz.
- Clerk Production: domínio do app `Verified`, FAPI em
  `clerk.membros.escolainterprete.com.br` `Verified`, e-mail `3/3 Verified` e
  certificado SSL emitido.
- A sessão de Production foi autenticada no host canônico; entrar em
  `/sign-in?redirect_url=%2Fcomunidade` com sessão ativa chegou a
  `/comunidade`. Não houve mudanças em usuário, papel, banco ou dado de produto.
- Em 31/10 foi identificado erro na renovação de sessão: o SDK escolheu o proxy
  automático `/__clerk` a partir do hostname Vercel. A configuração
  `CLERK_DISABLE_AUTO_PROXY=true` foi criada em Production; após o deployment,
  o proprietário abriu o app e a sessão autenticada foi observada novamente.
- O domínio Clerk antigo continua listado como `Checking` durante a janela de
  rollback. Ele não é canônico nem destino de novas URLs; veja o procedimento e
  o estado atual em [`docs/deployment/vercel.md`](../deployment/vercel.md).

## Verificação live

O DNS, certificados, aliases, host guard, atalhos Hostinger e evidência
autenticada estão registrados em
[`docs/deployment/vercel.md`](../deployment/vercel.md). Refaça a verificação
após qualquer mudança de domínio, publishable key Clerk ou ambiente Vercel.
