# 01 · Contexto e decisões travadas

## O que é

A Sala de Aula é a tela em que o aluno do Interprete assiste a uma aula gravada, e a mesma tela serve para abrir uma gravação de encontro (Minhas gravações). O Interprete se posiciona como uma escola contemporânea de prática baseada em evidências. A sala deve passar a sensação de ambiente de estudo: sóbria, editorial, acolhedora, com referências sutis à Grécia antiga (meandro e templo em linha) e toque humano.

**Prioridades, em ordem:** (1) assistir e estudar melhor; (2) o player é sempre o foco; (3) navegação fluida entre aulas; (4) responsividade real (mobile é outra composição); (5) acabamento premium.

## O que não é

- Não é uma área de curso genérica nem um redesign do produto.
- Não cria fluxos novos além dos descritos.
- Não toca em encontros ao vivo, Comunidade, Início, Biblioteca, Exercícios, Gestão.

## Direção visual (validada)

“Direção A refinada”: título grande em serifa (Source Serif 4), vídeo como figura central, texto de leitura em serifa, divisor com meandro grego, ferramentas de bolso num dock à direita que abre um painel recolhível. Detalhes de vidro (glassmorphism) só sobre o pôster do player e em cartões sobre o vídeo.

## Decisões travadas

| ID | Decisão |
|---|---|
| **LD-01** | Layout da sala = Direção A refinada. Telas válidas: `reference/A2_Oculto`, `A2_Aulas`, `A2_Notas`, `A2_Cronometro` (painel Tempo), `A2_Recolhida`. |
| **LD-02** | O player é o foco. Sem legenda sob o player (nada de “Aula 3 de 8 · 14 min”). |
| **LD-03** | Dock à direita (68 px) com três ferramentas: **Aulas**, **Notas**, **Tempo**. Clicar abre um painel de 372 px; clicar de novo no ícone ativo ou no X oculta. **O painel sempre começa oculto** ao abrir a sala. O estado aberto/fechado **não é persistido** entre visitas. |
| **LD-04** | A barra lateral esquerda global **já existe** com seu recolher/expandir: o símbolo de painel ao lado do logo, e, recolhida, o “I.” que troca por esse símbolo com fade ao passar o mouse ou focar. **Reutilize o componente existente.** Só implemente se não existir (especificação em `08`). |
| **LD-05** | Removidos por completo: bloco “Terminou a aula? / Concluir aula”, setas de anterior/próxima ao lado do título, blocos grandes de “Aula anterior / Próxima aula” no rodapé, legenda sob o player. |
| **LD-06** | **Concluir** = caixa de seleção em cada linha do painel Aulas (“marcar como feita”). É a única forma de concluir. Nunca é automática. |
| **LD-07** | “Materiais” é uma lista mínima: uma linha por item (ícone, título, tipo). Sem numeração grande, sem segunda linha. Sem itens, a seção não existe. |
| **LD-08** | Painel **Tempo** integra o que a plataforma já tem: Cronômetro, Pomodoro e Contagem regressiva. Reutilizar a lógica existente. |
| **LD-09** | Painel **Notas**: notas vinculadas à aula, salvamento automático, fixar, “Abrir em Notas”. Carimbo de tempo opcional (LD-13). |
| **LD-10** | Estados obrigatórios: normal, em andamento, retomando, carregando, vídeo indisponível (quebrado), sem vídeo, aula não liberada, sem materiais, sem notas, curso sem aulas publicadas, sem acesso, não encontrada, erro de página. Detalhes em `06`. |
| **LD-11** | Minhas gravações: itens **sem vídeo** (só o registro) passam a abrir; a sala mostra o estado “sem vídeo”. Serve também para QA. Veja `11`. |
| **LD-12** | Mobile: **sem abas horizontais**. Player fixo no topo; ferramentas num dock inferior que abre folhas de tela cheia com botão de voltar; modos do Tempo como lista. |
| **LD-13** | Padrões adotados enquanto não houver decisão final (reversíveis por flag): posição do vídeo **é salva** e a retomada oferece “Retomar / Do início”; carimbo de tempo nas notas **entra**, opcional por nota; **não há** cartão ao fim do vídeo; **não há** avanço automático. |
| **LD-14** | Sempre `youtube-nocookie.com`; o link do YouTube nunca é exibido pela interface do Interprete. |
| **LD-15** | Miniaturas do painel Aulas são **arte da marca** (gradiente + templo em linha + número), não imagens do YouTube. |

## Glossário

- **Sala**: a tela de assistir (`RoomPage`).
- **Conteúdo da sala** (`RoomContent`): uma **aula** de curso (`lesson`) ou uma **gravação** de encontro (`recording`). A sala trata os dois com o mesmo componente.
- **Dock**: barra vertical de 68 px à direita com os três atalhos.
- **Painel**: área de 372 px que abre ao lado do dock.
- **Fachada** (`PlayerFacade`): pôster com botão de play. O iframe do YouTube só entra depois do toque.
- **Carimbo**: o minuto do vídeo associado a uma nota.
- **Trilha**: a lista de módulos e aulas do curso (ou a lista de gravações de uma série).
