# 16 · Decisões em aberto e riscos

## Decisões em aberto (com padrão seguro já adotado)

O Codex **não decide**: implementa o padrão e deixa reversível por flag. A pessoa de produto confirma depois.

| ID | Decisão | Padrão adotado | Alternativa |
|---|---|---|---|
| D-01 | Carimbo de tempo nas notas | **Ligado**, opcional por nota, com “Ir para” (flag `roomNotesTimestamp`) | Sem carimbo (notas só da aula) |
| D-02 | Salvar posição e oferecer “Retomar” | **Ligado** (flag `roomSavePosition`) | Retomar só a aula, sem minuto |
| D-03 | Gravações sem vídeo abrindo para todos os alunos | **Todos** (flag `roomOpenRecordingsWithoutVideo`) | Restringir a equipe/QA |
| D-04 | Painel lateral abre por padrão | **Não: sempre oculto** (decisão do produto, **travada**) | — |
| D-05 | Concluir automaticamente ao fim do vídeo | **Nunca**; só pela caixa (LD-06, **travada**) | — |
| D-06 | Cartão ao fim do vídeo e avanço automático | **Não existem** | — |
| D-07 | Tempo: comportamento do vínculo ao trocar de aula | Mantém o vínculo original; menu “Vincular a esta aula” | Mover o vínculo sozinho |
| D-08 | Fachada de “sem vídeo” para aulas de curso (não só gravações) | Mesmo cartão, texto de aula | — |
| D-09 | Mobile e tablet | **Não foram desenhados**: seguir `08` §9–10 e validar visualmente no QA | Pedir desenho depois |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| O repositório tem estruturas de dados diferentes do esperado (progresso, gravações, notas, timers) | Alto | Fase 0 + adaptadores + regra “reutilizar > estender > criar”; parar e perguntar só se mudar o escopo |
| Posição do vídeo exige a API do YouTube e CSP | Médio | Carregamento sob demanda; ajuste de CSP documentado; flag `roomSavePosition` |
| Estado do cronômetro vive só no cliente e some ao recarregar | Médio | Aceitar o comportamento existente; não criar persistência nova |
| “A equipe já foi avisada” sem canal real de alerta | Médio (honestidade do texto) | Descobrir o canal na Fase 0; se não houver, usar `room_video_issues` + log e **registrar** no relatório; avaliar trocar o texto com o produto |
| Gravações sem agrupamento por série | Médio | Usar o campo existente de agrupamento; senão um único grupo “Gravações” |
| Acesso a gravações por turma mais restrito que por curso | Alto (privacidade) | Usar a regra existente em toda leitura/mutação; teste de 403 cruzado |
| Mobile e tablet sem desenho | Médio | Especificação textual em `08`; revisão visual no QA; ajustes pequenos permitidos **sem alterar a estrutura** |
| Sidebar existente com comportamento diferente do descrito | Baixo | Não alterar; só garantir que a sala não interfere |
| Nomes e caminhos de rota diferentes | Baixo | Manter os existentes (`03`) |
| Bloqueio de autoplay no iOS | Baixo | Documentado em `07`; aceitar botão nativo |

## Fora de escopo (para evitar deriva)

Encontros ao vivo; Comunidade; Início; Biblioteca; Exercícios; Gestão (além de leitura); tema escuro/Modo foco em si; avaliação por estrelas (que existe em outras plataformas, mas **não** na sala do Interprete); comentários; certificados; download de vídeo; legendas próprias; progresso automático; pré-visualização de equipe para aulas despublicadas.
