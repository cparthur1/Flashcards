# Guia de Demonstração Passo a Passo — Flashcards WebApp

> **Bem-vindo ao Guia Oficial de Demonstração do Flashcards WebApp!**  
> Este roteiro foi estruturado para permitir que desenvolvedores, avaliadores e estudantes explorem e testem **todas as funcionalidades, mecânicas neurobiológicas e inovações de IA** do aplicativo de forma prática e interativa.

---

## 📁 Conteúdo do Diretório `demo/`

| Arquivo | Descrição |
| :--- | :--- |
| [`demo/deck.json`](file:///home/chief_arthur/Apps/Flashcards/demo/deck.json) | Baralho estruturado em JSON pronto para importação direta, contendo **3 exemplos de cada formato de card** suportado. |
| [`demo/deck.txt`](file:///home/chief_arthur/Apps/Flashcards/demo/deck.txt) | Arquivo de texto estruturado com tags semânticas pronto para ser convertido em flashcards através do conversor manual (Modal 1.2). |
| [`demo/DEMO_GUIDE.md`](file:///home/chief_arthur/Apps/Flashcards/demo/DEMO_GUIDE.md) | Este guia completo de testes e demonstração passo a passo. |

---

## 🚀 Passo 0: Inicializando a Aplicação Localmente

O Flashcards é um web app estático de alto desempenho (Vanilla ES Modules, sem etapas pesadas de build ou transpile). Para iniciá-lo:

1. No terminal, execute um servidor HTTP simples na raiz do projeto:
   ```bash
   python3 -m http.server 8000
   ```
2. Abra seu navegador em `http://localhost:8000`.

---

## 📥 Passo 1: Importando ou Convertendo o Baralho Demo

Você tem duas formas de carregar o baralho de demonstração:

### Opção A: Conversão de Documento TXT (Recomendada para testar o conversor)
1. Na tela inicial (`index.html`), clique em **"Novo Baralho"** (`+ Criar Novo Baralho`).
2. Na página do criador (`pages/generate.html`), selecione o **Card 1.2: "Converta um documento"**.
3. No modal que abrir:
   - Formato dos cards: mantenha **"Tradicional"** (ou "Anki-like").
   - Selecione ou arraste o arquivo [`demo/deck.txt`](file:///home/chief_arthur/Apps/Flashcards/demo/deck.txt).
   - Clique em **"Converter e Abrir Editor"**.
4. Observe que o parser identificou automaticamente todas as seções e os 5 formatos de cards!
5. Clique em **"Salvar e Estudar"** no topo para iniciar a sessão de jogo.

### Opção B: Importação Direta via JSON
1. No menu superior ou no editor (`pages/generate.html`), clique no botão **"Importar Deck (JSON)"** ou carregue [`demo/deck.json`](file:///home/chief_arthur/Apps/Flashcards/demo/deck.json).

---

## 🎴 Passo 2: Experimentando os 5 Formatos de Flashcards

Durante o jogo ([`pages/game.html`](file:///home/chief_arthur/Apps/Flashcards/pages/game.html)), teste a jogabilidade de cada formato:

### 1. Resposta Única (`open` — Active Recall)
* **Exemplo no Deck**: Pergunta sobre a organela celular produtora de ATP.
* **Mecânica**: Digite a resposta no campo `#answer-input` e pressione <kbd>Enter</kbd>.
* **Tolerância Levenshtein**: Teste digitar com pequenos erros de digitação (ex: `Mitocondria` sem acento). O algoritmo aceita similaridade $\ge 80\%$.
* **Sinônimos**: O sistema suporta respostas alternativas separadas por `/` no banco.

### 2. Resposta Dupla (`open_double` — Active Recall Coordenado)
* **Exemplo no Deck**: Bases nitrogenadas púricas do DNA (`Adenina` e `Guanina`).
* **Mecânica**: Dois campos independentes com placeholders explicativos.
* **Ergonomia**: Digite a primeira resposta e pressione <kbd>Enter</kbd>; o cursor pula automaticamente para o segundo campo. Ao pressionar <kbd>Enter</kbd> no segundo, o card é validado.

### 3. Múltipla Escolha (`multiple_choice`)
* **Exemplo no Deck**: Vaso sanguíneo que leva sangue oxigenado dos pulmões ao átrio esquerdo.
* **Mecânica**: Opções dispostas em botões tácteis com ripple.
* **Atalhos Rápidos**: Pressione os números <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd> ou <kbd>4</kbd> no teclado físico para selecionar a alternativa correspondente instantaneamente.

### 4. Preenchimento de Lacunas (`fill` — Cloze Deletion)
* **Exemplo no Deck**: Divisão celular (`Mitose` e `Meiose`).
* **Mecânica**: As lacunas aparecem inseridas diretamente no fluxo do parágrafo de texto.
* **Validação Individual**: Cada token digitado é avaliado de forma independente.

### 5. Autoavaliação Anki-like (`anki`)
* **Exemplo no Deck**: Feedback Negativo na Homeostase Biológica.
* **Mecânica de 2 Etapas**:
  1. Visualize a **Frente** do cartão. Pressione <kbd>Espaço</kbd> ou <kbd>Enter</kbd> (ou clique no card) para **Virar o Cartão**.
  2. Visualize o **Verso** detalhado e selecione uma das 4 avaliações:
     - <kbd>1</kbd>: **Errei (Again)** — reagenda com intervalo de memorização rápida (5 a 8 cards).
     - <kbd>2</kbd>: **Difícil (Hard)**
     - <kbd>3</kbd>: **Bom (Good)**
     - <kbd>4</kbd>: **Fácil (Easy)**

---

## 🎨 Passo 3: Marca-texto Inteligente e Paleta Pastel

1. **Seleção de Texto**: Com o mouse ou toque, selecione qualquer palavra ou frase dentro da pergunta ou resposta do cartão.
2. **Posicionamento Inferior Anti-Conflito**:
   - Note que o popup flutuante aparece **logo abaixo do texto selecionado**, evitando sobrepor o menu nativo do iOS/Android (Copiar/Compartilhar).
3. **Paleta de Cores**:
   - Clique no ícone de marca-texto (`highlight.svg`) para expandir as 4 cores pastel:
     - <kbd>1</kbd> **Amarelo** (`#fef08a`)
     - <kbd>2</kbd> **Verde** (`#bbf7d0`)
     - <kbd>3</kbd> **Azul** (`#bfdbfe`)
     - <kbd>4</kbd> **Roxo** (`#e9d5ff`)
4. **Atalhos Instantâneos (1–4)**:
   - Com o texto selecionado, basta pressionar <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd> ou <kbd>4</kbd> no teclado para aplicar a cor desejada sem precisar abrir a paleta!
5. **Persistência de Estudo**: As palavras destacadas são permanentemente salvas no baralho e continuam visíveis nas próximas sessões de estudo.
6. **Desmarcar em 1 Toque**: Dê um clique em qualquer palavra já destacada para abrir o popup no modo *"Tirar marcação"* e restaurar o texto limpo.

---

## 🧠 Passo 4: Tutor de IA, Definições Instantâneas e Chat

> *Requer uma chave de API do Google Gemini configurada no menu hamburguer ou tela inicial.*

1. **Botão "Peça Ajuda" (`tutor.svg`)**:
   - Ao selecionar um termo no cartão, repare no botão circular branco ao lado do marca-texto com o ícone [`tutor.svg`](file:///home/chief_arthur/Apps/Flashcards/assets/img/tutor.svg).
   - *(Quando os recursos de IA estiverem desativados, este botão se oculta automaticamente).*
2. **Animação de Shimmer**:
   - Clique em **"Peça ajuda"**.
   - O botão executa um efeito de shimmer em azul e roxo suave uma vez e abre um card suspenso.
3. **Definição Resumida no Contexto do Card**:
   - O modelo `gemini-flash-lite-latest` gera uma definição de **1 a 2 frases**, direta e contextualizada com a pergunta e resposta do cartão atual.
   - Suporte completo a formatação didática e fórmulas matemáticas/químicas em LaTeX.
4. **Continuar Conversa no Chat (`open_chat.svg`)**:
   - No canto superior direito do card de definição, clique no ícone [`open_chat.svg`](file:///home/chief_arthur/Apps/Flashcards/assets/img/open_chat.svg).
   - O popup fecha, a gaveta lateral do Tutor de IA se abre e a conversa continua automaticamente com a questão no histórico para você tirar dúvidas complementares.
5. **Avaliação Semântica em Questões Abertas**:
   - Ao errar uma questão aberta, a IA analisa semanticamente se sua resposta é uma variação válida ou sinônimo e pode conceder o acerto dinamicamente.

---

## ⏱️ Passo 5: Foco com Pomodoro & Controle com Gamepad

### Pomodoro Integrado
1. Abra o menu hambúrguer no topo direito e ative o **Modo Pomodoro**.
2. O relógio no topo acompanhará sua sessão de 25 minutos de estudo ativo.
3. Ao término do ciclo, o overlay imersivo de descanso (5 min) se manifesta com efeitos de desfoque e pausa o agendamento de cards.

### Gamepad API (Controles Físicos)
1. Conecte qualquer joystick USB/Bluetooth (Xbox, PlayStation DualSense, Nintendo Switch Pro ou 8BitDo).
2. O sistema detecta o periférico e inicia polling com zero consumo de bateria quando inativo:
   - **Gatilhos / Botões frontais**: Viram o cartão Anki.
   - **X / Dpad Esquerdo**: Errei (Again).
   - **Y / Dpad Cima**: Difícil (Hard).
   - **A / Dpad Baixo**: Bom (Good).
   - **B / Dpad Direita**: Fácil (Easy).

---

## 📊 Passo 6: Dashboard de Estatísticas e Métricas de Aprendizagem

1. Conclua o baralho para assistir à explosão de partículas comemorativas no canvas de fundo e visualizar a tela de conclusão com métricas de streak e precisão.
2. Acesse a página de Estatísticas ([`pages/stats.html`](file:///home/chief_arthur/Apps/Flashcards/pages/stats.html)):
   - **Taxa de Retenção & Acurácia**: Acompanhamento gráfico por formato de card.
   - **Detecção de Leech Cards (Sanguessugas)**: Cartões com alta taxa de erro reincidente são isolados para atenção especial.
   - **Estatísticas de Marca-texto**: Contador de keywords destacadas e cartões marcados.
   - **Categorização Automática com IA**: Agrupamento temático inteligente dos baralhos via `gemini-flash-lite-latest`.

---

## 🔄 Passo 7: Modos de Estudo Avançados

### 1. Caderno de Erros (Notebook Mode)
- Favorite qualquer cartão clicando no ícone de marcador (bookmark) no canto do card.
- Na tela inicial, selecione o baralho dinâmico **"Caderno de Erros"** para estudar exclusivamente cartões que necessitam de reforço.

### 2. Semana de Provas (Exam Mode)
- No menu seletor de baralhos, ative a **Semana de Provas**.
- Marque múltiplos baralhos para fundi-los em uma fila contínua e estudar todo o conteúdo de uma disciplina para uma prova iminente.

### 3. Sincronização e Transferência de Sessão (P2P Local)
- No menu hamburguer, selecione **"Transferir Sessão"** ou **"Receber Sessão"** para migrar seu progresso, histórico e baralhos entre smartphone e computador via WebRTC/QR sem depender de nuvens externas.

---

## ⌨️ Tabela Rápida de Teclas de Atalho

| Tecla / Combinação | Ação no Jogo |
| :--- | :--- |
| <kbd>1</kbd> / <kbd>Numpad 1</kbd> | Marca-texto Amarelo (com texto selecionado) ou Avaliação "Errei" (Anki virado) |
| <kbd>2</kbd> / <kbd>Numpad 2</kbd> | Marca-texto Verde (com texto selecionado) ou Avaliação "Difícil" (Anki virado) |
| <kbd>3</kbd> / <kbd>Numpad 3</kbd> | Marca-texto Azul (com texto selecionado) ou Avaliação "Bom" (Anki virado) |
| <kbd>4</kbd> / <kbd>Numpad 4</kbd> | Marca-texto Roxo (com texto selecionado) ou Avaliação "Fácil" (Anki virado) |
| <kbd>Espaço</kbd> | Virar Cartão Anki / Avançar questão / Pular card com Chatbot aberto |
| <kbd>Enter</kbd> | Submeter resposta / Virar Cartão / Avançar após correção |
| <kbd>Esc</kbd> | Fechar popup de marca-texto, modais, zoom de imagem ou drawer da IA |
