# Arquitetura do Jogo, Mecânicas, Algoritmos e Regras de Desenvolvimento

> **Documento Oficial de Engenharia e Diretrizes**  
> **Caminho**: `dev_guidelines/GAME_ARCHITECTURE_AND_RULES.md`  
> **Público**: Desenvolvedores e Engenheiros do Flashcards WebApp  
> **Última Atualização**: Outubro de 2026

---

## 1. Visão Geral da Arquitetura e Ciclo de Vida

O motor de jogo do Flashcards WebApp é centralizado no arquivo [`js/game.js`](file:///home/chief_arthur/Apps/Flashcards/js/game.js) com suporte de módulos auxiliares ([`js/utils.js`](file:///home/chief_arthur/Apps/Flashcards/js/utils.js), [`js/stats-tracker.js`](file:///home/chief_arthur/Apps/Flashcards/js/stats-tracker.js), [`js/stats-ai.js`](file:///home/chief_arthur/Apps/Flashcards/js/stats-ai.js) e [`js/key-manager.js`](file:///home/chief_arthur/Apps/Flashcards/js/key-manager.js)).

### 1.1 Modos de Jogo
A aplicação opera em três modos distintos controlados via `activeMode` e sincronizados no `localStorage`:
1. **Normal (`flashcardsSave`)**: Baralho padrão selecionado pelo usuário.
2. **Caderno de Erros (`flashcardsNotebook`)**: Deck dinâmico contendo apenas cartões favoritados ou marcados para estudo de recuperação.
3. **Semana de Provas (`flashcardsExam`)**: Modo multi-deck agregador que mescla cartões de múltiplos baralhos habilitados.

---

### 1.2 Tipos de Flashcards Suportados

| Tipo (`card.type`) | Estrutura de Resposta | Interface de Entrada | Método de Validação |
| :--- | :--- | :--- | :--- |
| `open` | `card.answer` (sinônimos via `/`) | Campo de texto único `#answer-input` | Similaridade Levenshtein $\ge 0.8$ |
| `open_double` | `card.answer` e `card.answer2` | Dois campos `#answer-input-1` e `#answer-input-2` | Ambos com similaridade $\ge 0.8$ |
| `multiple_choice` | `card.answer`, `card.options` | 2 a 6 botões dinâmicos `.mc-option-btn` | Igualdade normalizada exata |
| `fill` | `card.answers` ou `card.answer` (separados por `;`) | Lacunas inline `.fill-blank-input` | Levenshtein $\ge 0.8$ em cada lacuna |
| `anki` | `card.answer`, `card.answerImage` | Botão Virar Cartão + 4 botões de avaliação | Auto-avaliação do usuário |
| `divisor` / `note` | N/A | Separadores de seção no editor | Ignorados no jogo (`isPlayableCard = false`) |

---

### 1.3 Ciclo de Vida de um Cartão (Fluxograma)

```
[ Início / Próximo ]
         │
         ▼
  loadQuestion() ──► Limpa UI com resetUI() e define questionStartTime
         │
         ▼
  [ Usuário Pensa & Digita / Clica ] ◄── schedulePrecomputeNextCard() roda em background
         │
         ▼
  handleOpenSubmit() / handleFillSubmit() / handleMCSubmit() / handleAnkiRating()
         │
         ▼
   Verificação & Cálculo de Similaridade (Levenshtein >= 80%)
         │
         ├────────────────────────────────────────┐
         ▼                                        ▼
   [ ACERTO ]                               [ ERRO ]
         │                                        │
         ▼                                        ▼
  showFeedback(true)                       showFeedback(false)
  • Pontuação & Streak +1                  • Streak zerada, wrongCount +1
  • Bolinha verde no Canvas                • Bolinha vermelha no Canvas
  • Animação flying-card ao header         • Card balança (shake) e mostra correção
  • Remoção do pool (ou leech check)       • Reagendamento com calculateThinkingGap()
         │                                        │
         ▼                                        ▼
  loadQuestion()                           [ Usuário clica Pular / Próxima ]
                                                  │
                                                  ▼
                                           loadQuestion()
```

---

### 1.4 Fluxo de Conclusão do Baralho (Deck Completion)

Quando todos os cartões jogáveis do baralho são memorizados (`questionsPool.length === 0`):
1. **Animação de Celebração**:
   - `launchCelebrationParticles(150)` dispara confetes coloridos no canvas de fundo `#background-canvas`.
2. **Tela de Conclusão no Card Holder**:
   - O `#question-card` transiciona para `#deck-completion-view` exibindo ícone 🏆, título comemorativo e grid com métricas resumo (Cards Concluídos, Precisão %, Duração e Sequência Máxima).
   - Disponibiliza dois botões de ação:
     - **"Ver estatísticas"**: Leva o usuário diretamente à página [`pages/stats.html`](file:///home/chief_arthur/Apps/Flashcards/pages/stats.html).
     - **"Restart"**: Limpa o canvas, reinicia score/streak, re-embaralha o baralho e inicia nova sessão via `initStatsSession()`.
   - Remove temporizadores automáticos arbitrários para dar controle total ao usuário.
3. **Persistência Enriquecida de Sessão**:
   - `completeCurrentSession()` finaliza a sessão gravando métricas completas (duração ativa, correções de IA, acurácia) tanto no `history` quanto mantendo `currentSession` ativo.
   - A página de estatísticas exibe o `#session-completed-banner` de 100% zerado e permite ao usuário alternar a visualização de todos os cards da sessão respondida.

---

## 2. Algoritmos Centrais e Regras Matemáticas

### 2.1 Algoritmo de Fila Adaptativa e Repetição Espaçada

O jogo **não utiliza uma fila linear estática**. O algoritmo recalcula o agendamento de cada cartão dinamicamente com base no desempenho real:

1. **Embaralhamento Inicial**:  
   Ao iniciar qualquer sessão ou baralho, todos os cartões jogáveis são embaralhados aleatoriamente via `shuffleArray()`.

2. **Cálculo de Gap por Tempo de Pensamento (`calculateThinkingGap`)**:  
   Quando o usuário erra um cartão, o intervalo (gap de cartões futuros) é **inversamente proporcional ao tempo que ele passou pensando**:
   - Se o usuário pensou bastante tempo ($\ge 15$s) e errou, significa que a questão é difícil: o cartão reaparece mais cedo (gap mínimo de **5 cartões**).
   - Se o usuário errou muito rápido (ex: chute ou distração $\le 1$s), o cartão recebe um intervalo maior de espera (gap até **20 cartões**).
   ```javascript
   function calculateThinkingGap(thinkingTimeSec) {
       const minGap = 5; // Mínimo absoluto
       const t = Math.max(0.8, thinkingTimeSec || 1);
       const bonus = Math.min(15, Math.max(0, Math.round(15 / t - 1)));
       return minGap + bonus;
   }
   ```

3. **Pré-cálculo em Tempo Ocioso (`precomputeNextCandidate`)**:  
   Para garantir que as animações de transição de cartões (60 FPS fluidos) não engasguem com processamento de algoritmo, o próximo cartão é pré-selecionado em segundo plano via `requestIdleCallback` enquanto o usuário ainda está lendo/digitando no cartão atual.

4. **Desempate Aleatório entre Cartões Vencidos**:  
   Caso múltiplos cartões tenham `dueStep <= currentStep`, o algoritmo sorteia aleatoriamente entre eles para que não se forme uma fila rígida ou previsível.

5. **Regra de Cartões Sanguessugas (Leech Rule)**:
   - Se o usuário errar um cartão **mais de 4 vezes** (`wrongCount > 4`), ele se torna um cartão sanguessuga e **permanece no jogo até ser acertado 2 vezes consecutivas** (`correctStreak >= 2`).
   - Cartões com **3 ou menos erros** são concluídos e removidos do baralho ativo logo no primeiro acerto.

6. **Injeção de Cartões Aleatórios contra Monotonia (Too Much Due)**:  
   Quando houver acúmulo de cartões vencidos (`dueCards.length >= 3` ou 2 cartões vencidos consecutivos já respondidos), o algoritmo intercala cartões aleatórios frescos (não vistos ou futuros) na proporção de no máximo 2 cartões vencidos para 1 cartão aleatório (além de ~35% de probabilidade orgânica no backlog). Isso impede que o usuário fique preso num loop repetitivo fechado dos mesmos cartões.

---

### 2.2 Algoritmo de Similaridade de Texto (Levenshtein Otimizado)

A validação de respostas abertas e preenchimento de lacunas aceita variações legítimas e pequenos erros de digitação:

1. **Normalização Prévia (`normalizeString`)**:  
   Converte para caixa baixa, remove acentos (Unicode NFD), limpa marcações Markdown (`*`, `_`, `` ` ``, `$`), remove pontuação e observações entre parênteses `(...)`.

2. **Cálculo Levenshtein com Buffers Planos (`calculateSimilarity`)**:  
   Utiliza dois vetores tipados `Int32Array(sLen + 1)` em vez de matrizes bidimensionais completas, reduzindo drasticamente o consumo de memória e coletas de lixo (GC).
   - Limiar de aprovação: **$\ge 0.8$ (80% de similaridade)**.
   - Suporte nativo a sinônimos definidos com barra `/` (ex: `Brasília / Brasilia`).

---

### 2.3 Metadados Puros e Transparência de IA

1. **Invisibilidade em Tempo de Jogo**:  
   Campos atribuídos por IA (`aiTopic`, `aiSubject`) são metadados puros do JSON. **Nunca** devem ser renderizados como selos, tags ou elementos visuais na interface de jogo ou no editor.
2. **Filtro de Pausas de Estudo**:  
   No cálculo da velocidade média por cartão em estatísticas ([`js/stats-tracker.js`](file:///home/chief_arthur/Apps/Flashcards/js/stats-tracker.js)), qualquer resposta que leve mais de **90 segundos** é desconsiderada da média, pois reflete uma pausa do usuário (app deixado aberto).

---

## 3. Otimizações de Desempenho e Eficiência

O projeto conta com 4 otimizações críticas implementadas para garantir velocidade instantânea e preservar bateria:

1. **Gamepad API Orientada a Eventos**:  
   O loop `pollGamepad()` **não** roda incondicionalmente a 60/120 FPS. Ele permanece dormente (consumo de CPU 0%) e só é ativado quando o evento nativo `gamepadconnected` detecta um controle físico conectado.
2. **Levenshtein de Memória Linear $O(N)$**:  
   Substituição da alocação de matriz $O(N \cdot M)$ por vetores reutilizáveis `Int32Array`, evitando engasgos de Garbage Collection em dispositivos móveis.
3. **Pré-indexação $O(1)$ em Estatísticas de IA ([`js/stats-ai.js`](file:///home/chief_arthur/Apps/Flashcards/js/stats-ai.js))**:  
   `answersLog` e `strugglingCards` são normalizados em mapas hash uma única vez antes de iterar os cartões, eliminando dezenas de milhares de execuções redundantes de expressões regulares.
4. **Persistência Debounced do Estado de Jogo**:  
   `saveGameState()` agrupa gravações rápidas no `localStorage` com debounce leve (80ms) e executa *flush* síncrono nos eventos `beforeunload` e `pagehide`.

---

## 4. Regras Obrigatórias para Desenvolvedores (Guidelines)

Ao criar novas funcionalidades ou modificar código existente, siga rigorosamente estas regras:

### 🔴 Regra 1: Logging Explícito e Identificável
Para permitir diagnósticos rápidos de problemas relatados por usuários ou testes:
- **Sempre** insira logs claros no console utilizando os prefixos padronizados:
  - `[Game]`: Interações de botões, ciclo de cards, UI e formulários.
  - `[Algorithm]`: Agendamento de gaps, seleção de candidatos, leeches e remoção do pool.
  - `[StatsTracker]`: Gravação de sessões, acertos e históricos.
  - `[Anki]`: Ações de virada e pontuações do gamepad/teclado.
  - `[Gamepad]`: Conexão, desconexão e status do loop.
- **Sempre** registre com `console.warn` quando uma ação do usuário for impedida por uma flag de bloqueio (`isOpenSubmitting`, `submitBtn.disabled`, `isAnimating`).

### 🔴 Regra 2: Resiliência em Flags de Trava (Locks)
- **Nunca** ative flags como `isOpenSubmitting = true` ou `isAnimating = true` sem envolver a execução subsequente em blocos `try...catch`.
- Se ocorrer qualquer exceção no cálculo, na animação ou no registro de dados, o bloco `catch` deve restaurar `isOpenSubmitting = false` e `isAnimating = false` para evitar que a interface fique congelada para o usuário.

### 🔴 Regra 3: Tipagem Defensiva em Strings e Objetos
- Jamais assuma que propriedades como `card.answer`, `card.description` ou `input.value` são strings válidas.
- Sempre utilize coerção segura antes de métodos de texto:
  ```javascript
  const answer = String(card?.answer ?? '');
  const parts = answer.split('/').map(s => s.trim()).filter(Boolean);
  ```

### 🔴 Regra 4: Validação de Sessão de Estatísticas
- Ao registrar respostas em `recordStatsAnswer()`, sempre garanta que `data.currentSession` existe antes de acessar propriedades internas. Se não existir, reinicialize-a e recarregue a referência local de `data`.

### 🔴 Regra 5: Arquitetura Orientada a Eventos
- Evite criar loops contínuos baseados em `setInterval` ou `requestAnimationFrame` que rodem em segundo plano sem necessidade. Prefira disparadores orientados a eventos (`addEventListener`, `MutationObserver`, `IntersectionObserver`).

### 🔴 Regra 6: 
- Evite usar emojis. Use os icones do https://fonts.google.com/icons ou crie o vector.
---

## 5. Estrutura de Arquivos Principais

```
├── dev_guidelines/
│   ├── DESIGN_LANGUAGE.md              # Diretrizes de UI/UX Material 3
│   └── GAME_ARCHITECTURE_AND_RULES.md  # Este documento (Regras do Jogo e Algoritmos)
├── js/
│   ├── game.js                         # Loop principal, UI do jogo, Gamepad e Fila
│   ├── stats-tracker.js                # Gravação de sessões, métricas e histórico local
│   ├── stats-ai.js                     # Métricas por tópico e agrupamento assistido
│   ├── utils.js                        # Levenshtein, normalização, KaTeX e rotas
│   ├── key-manager.js                  # Gerenciador seguro de API Key Gemini
│   ├── generate.js                     # Criador, editor e importador de baralhos
│   └── stats.js                        # Renderização do dashboard de estatísticas
├── pages/
│   ├── game.html                       # Página da partida
│   ├── generate.html                   # Editor e gerador de decks
│   └── stats.html                      # Painel analítico de desempenho
└── sw.js                               # Service Worker e cache PWA offline
```
