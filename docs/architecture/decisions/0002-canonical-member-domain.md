# ADR 0002 — Domínio canônico e origens de autenticação

## Status

Accepted — rollout de Production em 30/10/2026.

## Contexto

A aplicação de membros usava um alias `vercel.app` como URL pública e como
origem primária do Clerk. Como a Vercel controla esse domínio, a instalação
passou a encaminhar a Frontend API do Clerk por `/__clerk`, com middleware,
variáveis e allowlist específicos. O site institucional também mantinha
redirecionamentos publicados fora do repositório atual.

## Decisão

- O site institucional permanece em `https://escolainterprete.com.br`.
- O único origin público da área de membros é
  `https://membros.escolainterprete.com.br`.
- A Vercel recebe o tráfego da aplicação pelo CNAME `membros`; o Frontend API
  do Clerk usa DNS próprio em `clerk.membros`, apontado ao destino oficial
  informado pelo Clerk. Aplicação e Frontend API ficam em subdomínios distintos
  do mesmo site.
- A integração Clerk usa DNS/CNAME diretamente. Não se usa `frontendApiProxy`,
  `proxyUrl`, `/__clerk` nem variáveis `CLERK_PROXY_URL`, `CLERK_FAPI` ou suas
  variantes públicas.
- Em Production, origens públicas e `authorizedParties` usam somente o origin
  HTTPS canônico. Em Preview, `VERCEL_BRANCH_URL` é preferido e `VERCEL_URL` é
  o fallback; a resolução falha se nenhum origin HTTPS de Preview estiver
  presente. Em desenvolvimento local, HTTP só é aceito em loopback.
- Alias Vercel histórico continua recebendo apenas redirecionamento permanente
  de `GET`/`HEAD` ao domínio canônico, preservando caminho e query. Métodos que
  podem carregar escrita recebem `421` sem repetir o corpo da requisição.
- O site institucional encaminha `/entrar`, `/criar-conta`, `/membros` e
  `/login` ao host canônico. O `.htaccess` da Hostinger é a configuração
  publicada dessas rotas enquanto não existe repositório conectado à
  hospedagem.
- Convites, compartilhamentos, calendários e metadata constroem URLs pelo
  resolver de origin do ambiente; não confiam no cabeçalho `Host` nem em um
  origin Production estático nos Previews.

## Consequências

- Usuários, `Member`, `Profile`, papéis e dados persistidos continuam na mesma
  instância Clerk/Supabase; não há migração ou escrita de dados causada pelo
  domínio.
- Cookies do Clerk são vinculados ao origin do app ou ao Frontend API. Uma
  troca de `.vercel.app` para `escolainterprete.com.br` pode exigir novo login
  no dispositivo; a sessão antiga não pode ser copiada com segurança entre
  domínios. A identidade e o histórico persistido permanecem intactos.
- Alias antigo é somente uma entrada de compatibilidade para redirecionar links
  já distribuídos. Não deve ser publicado como destino de novos links.
- O guard de hosts da Vercel continua ativo e permite apenas o domínio
  canônico, os aliases mantidos para redirect e deployments verificados pelo
  procedimento de release.

## Rollback

O deployment Production anterior e o domínio Clerk anterior permanecem
recuperáveis até a validação do novo host. Em falha, reatribua o alias de
Production ao deployment anterior, reverta `NEXT_PUBLIC_APP_URL` e o
publishable key Clerk correspondentes, restaure o host guard do mesmo SHA e
retorne os quatro atalhos da Hostinger ao destino anterior. O CNAME `membros`
e o CNAME `clerk.membros` podem permanecer publicados enquanto o rollback é
avaliado, pois nenhum substitui os registros do domínio institucional.

## Verificação

Os critérios operacionais atuais e a evidência de Production estão em
[`docs/deployment/vercel.md`](../../deployment/vercel.md). A resolução e os
testes locais ficam em `packages/next-config/application-origin.ts` e
`apps/app/lib/application-host.test.ts`.
