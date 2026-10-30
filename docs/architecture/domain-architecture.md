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

## Verificação live

O estado do DNS, certificado Clerk, allowlist Vercel e atalhos Hostinger deve
ser registrado em [`docs/deployment/vercel.md`](../deployment/vercel.md) após
cada cutover. Builds e testes locais não são evidência suficiente de autenticação
em Production.
