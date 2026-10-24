# reference/ · telas de referência

Arquivos HTML **estáticos** com CSS inline, exportados das telas desenhadas. Abrem direto no navegador (as fontes vêm do Google Fonts; precisa de internet para a tipografia correta). **São referência visual, não código para copiar:** a estrutura de componentes e a semântica correta estão em `08` e `09`.

## Válidas (seguir fielmente)

| Arquivo | O que mostra |
|---|---|
| `A2_Oculto.html` | Estado inicial (painel oculto, barra lateral expandida). TELA DE REFERÊNCIA PRINCIPAL. |
| `A2_Aulas.html` | Painel Aulas aberto pelo dock. |
| `A2_Notas.html` | Painel Notas aberto pelo dock. |
| `A2_Cronometro.html` | Painel Tempo aberto (Cronômetro | Pomodoro | Regressivo). O nome do arquivo é histórico. |
| `A2_Recolhida.html` | Painel oculto + barra lateral recolhida (só ícones, “I.” no lugar do logo). |

Pontos em que o código **deve divergir** do mockup (o mockup foi desenhado como imagem):
- A caixa de “marcar como feita” **fica fora do link** da aula (mockup a colocou dentro).
- Dock, painel e linhas precisam de `aria-*`, foco visível e estados de teclado (`12`).
- “Tempo” do dock mostra o tempo quando o timer roda (não aparece no mockup).
- Dados de exemplo (nomes de aulas, datas, durações) são ilustrativos.

## Só componentes (usar o interior; ignorar o layout ao redor, que é de uma direção anterior)

| Arquivo | O que aproveitar |
|---|---|
| `EstErro.html` | Interior do player: cartão “vídeo indisponível”. Usar só o cartão e o pôster; o layout ao redor é antigo. |
| `EstCarregando.html` | Interior do player: carregando. Só o esqueleto 16:9; layout ao redor antigo. |
| `EstRetomando.html` | Interior do player: cartão “Você parou em…”. Só o cartão; layout ao redor antigo. |
| `EstVazios.html` | Páginas/blocos de estado vazio e bloqueio (curso sem aulas, aula não liberada). Usar só os blocos; o texto final é o de 10. |
| `NotasAula.html` | Estados do composer e das notas (vazio, escrevendo, lista e menu, com/sem carimbo). Usar os componentes; o texto final é o de 10. |
| `Componentes.html` | Botões, chips, ícones de estado, linhas de trilha, materiais, notas. Referência de componentes; o layout é antigo. |

## Não usar

Qualquer tela com bloco “Terminou a aula?”, setas de anterior/próxima ao lado do título, rodapé de anterior/próxima, legenda “Aula N de M · X min” sob o player, ou botão redondo de recolher na borda da barra lateral: são versões **descartadas**.

## Mobile e tablet

**Não há tela de referência válida.** Implementar pela especificação de `08` §9–10. As telas mobile antigas (direções anteriores) estão descartadas.
