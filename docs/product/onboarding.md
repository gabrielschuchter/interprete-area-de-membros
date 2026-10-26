# Onboarding "Matrícula"

Fonte visual e de copy: pacote `interprete-onboarding-handoff` (Direção A). Este documento registra o que o código faz hoje e onde ele se afasta do pacote.

## Contrato

- Sete etapas, uma rota cada: `/onboarding/{boas-vindas,identidade,foto,sobre,interesses,avisos,conclusao}`. `/onboarding` redireciona para a etapa em que a pessoa parou. A lista e a ordem estão em `lib/onboarding/steps.ts`; `Member.onboardingStep` guarda o índice da etapa mais avançada, então a ordem é um contrato persistido.
- O portão não mudou: `(authenticated)/layout.tsx` e `requireOnboardedMemberId` redirecionam para `/onboarding` quem não tem `onboardingStatus = COMPLETED`. Quem concluiu a versão 1 não repete (D11 A). A conclusão grava `onboardingVersion = 2`.
- Não há migração. O progresso vive nas colunas `Member.onboarding*` que já existiam (D1 A, D2 C em vez de JSON no banco).
- Uma identidade só: cada etapa grava em `Profile`, `Member` (nome e avatar) e `NotificationPreference`, os mesmos campos que Perfil e Configurações editam. Respostas vazias nunca apagam dado preenchido.
- Valores gerados pelo sistema ("Membro", `membro-xxxxxx`, avatar genérico do Clerk) entram como vazios.
- Interesses guardam o texto das 13 categorias da Biblioteca (`libraryCatalogCategories`); interesses livres já existentes no Perfil são preservados.
- Avisos: os três presets são aplicados sobre as 13 chaves de `lib/notification-preference-groups.ts`, a mesma lista usada em Configurações.

## Onde o código se afasta do pacote

- Username sem ponto nem sublinhado: o alfabeto do app (`lib/username-rules.ts`) é letras minúsculas, números e hífen, e menções e `/membros/{username}` dependem dele. A mensagem "só letras minúsculas, números, ponto, hífen e sublinhado" virou "Só letras minúsculas, números e hífen." e as sugestões usam hífen (`{base}-pbe`).
- Rascunho (D2): não há JSON de rascunho no banco. O que a pessoa digita é gravado ao continuar; voltar de etapa relê o Perfil. Rascunho local offline e sincronização ao voltar a rede ainda não existem: sem conexão, a faixa aparece e "Continuar" fica desabilitado.
- "Pular" nunca grava nada na etapa; só avança.
- Telemetria de funil (D17) não foi implementada.
- Troca de username depois do onboarding (D8) não mudou: o Perfil continua livre.
- Tablet usa a carteirinha escalada no topo; a etapa de avisos mostra só as notificações de exemplo no lugar da carteirinha.
