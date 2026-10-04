# Eventos e identidade do domínio de membros

## Fonte de verdade

Prisma/PostgreSQL no Supabase continua sendo a fonte de verdade. `DomainEvent`
registra fatos imutáveis e mínimos; `OutboxJob` registra cada consumidor que
precisa processar o fato. O evento e seus jobs precisam ser gravados na mesma
transação da mudança de domínio que os originou.

O payload guarda IDs, estado e metadados necessários à entrega. Texto de aulas,
posts, respostas, dados de contato e outras informações privadas não devem ser
copiados para eventos ou jobs. `actorId` é uma referência histórica sem FK para
que a desativação de uma identidade não apague o registro do fato.

## Idempotência e execução

- `DomainEvent.idempotencyKey` identifica a ocorrência lógica no domínio.
- `OutboxJob(eventId, consumerKey)` impede cadastrar duas vezes o mesmo
  consumidor e `OutboxJob.idempotencyKey` permite deduplicação nos destinos.
- O dispatcher reivindica jobs `PENDING`/`RETRY` vencidos ou `PROCESSING` com
  lease expirado, com transação curta, `FOR UPDATE SKIP LOCKED` e lotes de até
  100 itens.
- Sucesso marca `SUCCEEDED`; erros recuperáveis usam backoff; falhas esgotadas
  ficam `DEAD` para inspeção e reprocessamento explícito.
- Efeitos externos também precisam aceitar a chave idempotente. Repetir a
  execução de um consumer não pode duplicar notificações nem concessões.
- O worker processa lotes limitados e não carrega todo o público em memória.

No caminho normal, a operação grava evento e jobs de forma atômica. Após o
commit, mutations do app tentam processar até cinco jobs como melhor esforço;
um erro deixa o job durável para nova tentativa. Esse limite evita prolongar a
resposta do usuário e não substitui um worker periódico: filas maiores que o
lote e falhas precisam ser recuperadas pelo cron. Nenhum payload sensível chega ao
Realtime: um trigger usa `realtime.send` para transmitir somente ID da
notificação e operação. O canal privado é exatamente
`member-notifications:<Clerk member ID>`; o cliente invalida sua visão e busca
os dados completos pelo endpoint autenticado. A função do trigger fixa
`search_path` vazio e tem execução direta revogada para `PUBLIC`.

A integração nativa Clerk/Supabase precisa estar habilitada no Clerk e
registrada como provedor de terceiro no Supabase. O servidor usa o token de
sessão Clerk, valida que `sub` corresponde ao `Member.id` autenticado e que
`role` é `authenticated`, e renova a credencial antes do `exp`. Não há template
JWT legado nem segredo de assinatura Supabase compartilhado com o Clerk.

As tabelas são acessadas pelo servidor Prisma. RLS fica habilitado e não recebe
policy permissiva para `anon` ou `authenticated`.

## Identidade e histórico

`Member.deactivatedAt` transforma a remoção Clerk em tombstone. O webhook
preserva relações históricas, substitui dados pessoais do perfil por uma
identidade removida e é idempotente. Os webhooks create/update/delete são
serializados por advisory lock transacional do ID Clerk, evitando que um evento
atrasado restaure dados pessoais após a remoção.

O registro de autor sem membro encontrado é preservado como referência legada;
nenhuma migration atribui autoria a outra pessoa. Relações novas devem validar
o membro no servidor e usar FK quando a retenção histórica permitir.

## Entrega e recuperação

`GET`/`POST /cron/outbox` em `apps/api` processa apenas os consumers registrados
e exige `Authorization: Bearer <CRON_SECRET>` com segredo de pelo menos 32
caracteres. A configuração idempotente de Supabase Cron está em
`docs/deployment/supabase-outbox-cron.sql`; o job lê URL e segredo do Vault e
chama o endpoint a cada minuto. O setup remoto ainda precisa ser criado e
validado; a restrição temporária de quota/Fair Use pode impedir essa
validação. O job Vercel anterior apontava para `/cron/keep-alive`, uma rota
inexistente, e foi removido.

`notifications.batch_requested` aceita até 100 destinatários por job. O
consumer consulta membros ativos e preferências em lote, grava notificações
com deduplicação e confirma o job na mesma transação. Assim, falha antes do
commit deixa o lote recuperável; falha depois do commit não duplica registros.
O endpoint retorna apenas contagens e não expõe payloads nem mensagens de erro
do banco.

Antes de release, verificar backlog, idade do job mais antigo, tentativas,
falhas `DEAD`, duplicatas e RLS. Rollback de aplicação não apaga eventos/jobs
nem reverte dados de domínio já escritos.
