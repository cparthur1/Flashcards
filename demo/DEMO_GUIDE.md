# 📋 Roteiro de Apresentação — Flashcards WebApp (Pitch & Demonstração)

> **Guia Rápido do Apresentador**  
> Use este checklist sequencial na sua reunião de demonstração. Cada etapa contém a **ação prática**, o **discurso comercial**, o **diferencial de engenharia** e o que destacar no **console** para impressionar o comprador.

---

## 🗂️ Checklist Rápido de Navegação

- [ ] [1. Preparação Pré-Demo (1 minuto)](#-1-preparação-pré-demo-1-minuto)
- [ ] [2. Visão Geral & Arquitetura Zero-Backend (Home)](#-2-visão-geral--arquitetura-zero-backend-home)
- [ ] [3. Criação de Baralhos & Parser Inteligente (Modal 1.2)](#-3-criação-de-baralhos--parser-inteligente-modal-12)
- [ ] [4. O Console HUD & O Algoritmo Neurocientífico](#-4-o-console-hud--o-algoritmo-neurocientífico-o-pulo-do-gato)
- [ ] [5. Os 5 Formatos de Cards & Tolerância a Erros](#-5-os-5-formatos-de-cards--tolerância-a-erros)
- [ ] [6. Marca-Texto Inteligente & UX Móvel Anti-Conflito](#-6-marca-texto-inteligente--ux-móvel-anti-conflito)
- [ ] [7. Camada de Inteligência Artificial (Gemini)](#-7-camada-de-inteligência-artificial-gemini)
- [ ] [8. Pomodoro Integrado & Periféricos (Gamepad API)](#-8-pomodoro-integrado--periféricos-gamepad-api)
- [ ] [9. Sincronização P2P sem Servidor (Bitset QR Code)](#-9-sincronização-p2p-sem-servidor-bitset-qr-code)
- [ ] [10. Modos Especiais: Caderno de Erros & Semana de Provas](#-10-modos-especiais-caderno-de-erros--semana-de-provas)
- [ ] [11. Dashboard de Analytics & Categorização IA](#-11-dashboard-de-analytics--categorização-ia)
- [ ] [12. Fechamento Comercial & Métricas de Valor](#-12-fechamento-comercial--métricas-de-valor)

---

## ⏱️ 1. Preparação Pré-Demo (1 minuto)

- [ ] Inicie o servidor local na raiz do projeto:
  ```bash
  python3 -m http.server 8000
  ```
- [ ] Abra no navegador: `http://localhost:8000` (tenha também o celular na mesma rede se for mostrar o P2P).
- [ ] Abra o Console HUD antecipadamente com <kbd>Alt</kbd> + <kbd>C</kbd> ou deixe engatilhado para abrir com **triplo clique** no título.
- [ ] Tenha em mãos os arquivos da pasta [`demo/`](file:///home/chief_arthur/Apps/Flashcards/demo/):
  - [`demo/deck.txt`](file:///home/chief_arthur/Apps/Flashcards/demo/deck.txt) para demonstrar o parser.
  - [`demo/deck.json`](file:///home/chief_arthur/Apps/Flashcards/demo/deck.json) como backup rápido de importação.
- [ ] Se for demonstrar IA ao vivo, garanta que a chave Gemini esteja salva ou pronta para colar.

---

## 🏠 2. Visão Geral & Arquitetura Zero-Backend (Home)

- [ ] **Ação:**
  - Mostre a tela inicial (`index.html`), o design Material You 3 Expressive, os cards com sombras suaves e microinterações.
- [ ] **O que falar pro comprador:**
  - *"O app é 100% Client-Side e PWA offline-first. Isso significa que seu custo de infraestrutura/servidor é **zero**, não há banco de dados para manter, e a privacidade do usuário é absoluta."*
  - *"Funciona em qualquer dispositivo (Web, Android, iOS, Desktop) com suporte a instalação como app nativo."*
- [ ] **Inteligência do app:**
  - **Zero Telemetria / Zero Latência:** Toda a lógica roda localmente no navegador (Vanilla ES Modules sem frameworks pesados ou hydration delays).
  - **Segurança de Nível Bancário:** Chaves de API e dados são armazenados via **Web Cryptography API** com chave AES-GCM 256 bits não-exportável (`extractable: false`) mantida no IndexedDB — mesmo com XSS malicioso, a chave crua não pode ser lida.
- [ ] **Dica de console:**
  - Mostre que a inicialização não faz nenhum disparo de tracking externo, apenas bootstrapping do Service Worker e restauração de estado do cofre seguro.

---

## 📄 3. Criação de Baralhos & Parser Inteligente (Modal 1.2)

- [ ] **Ação:**
  - Clique em **"Criar Baralho"** -> vá para a página de geração (`pages/generate.html`).
  - Abra o **Card 1.2: "Converta um doc"**.
  - Arraste ou selecione o arquivo [`demo/deck.txt`](file:///home/chief_arthur/Apps/Flashcards/demo/deck.txt) e selecione o modo desejado.
  - Clique em **"Converter e Abrir Editor"**.
- [ ] **O que falar pro comprador:**
  - *"O usuário comum não quer preencher formulário de card por card. Ele já tem anotações em Word ou Bloco de Notas. Nosso motor converte automaticamente um texto simples em flashcards estruturados com seções e tipos variados em menos de 1 segundo."*
- [ ] **Inteligência do app:**
  - **Suporte Nativo a `.txt`, `.doc` e `.docx`:** Extração no próprio browser via Mammoth.js sem enviar documentos para servidor externo.
  - **Parser Semântico de Tags:** Detecta marcadores como `(anki_like)`, `(open_double)`, `(fill)`, `(multiple_choice)` e linhas com `#` como divisores estruturais de seção.
  - **Validação de Sintaxe:** Normaliza lacunas com `_`, remove tags acidentais e organiza o deck automaticamente para o editor.
- [ ] **Dica de console:**
  - No editor, mostre que os cards foram carregados com tipos, alternativas e divisores já instanciados no estado de memória.

---

## 🧠 4. O Console HUD & O Algoritmo Neurocientífico (O Pulo do Gato!)

- [ ] **Ação:**
  - No editor, clique em **"Salvar e Estudar"** para abrir o jogo (`pages/game.html`).
  - Abra o console interno pressionando <kbd>Alt</kbd> + <kbd>C</kbd> ou dê um **triplo clique no título do baralho**.
- [ ] **O que falar pro comprador:**
  - *"Aqui está o cérebro do produto: não usamos repetição fixa ingênua nem caixas de Leitner simples. Construímos um algoritmo proprietário baseado em 3 pilares da neurociência cognitiva moderna: Dificuldades Desejáveis, Erro de Predição e Efeito de Intercalação."*
  - *"E para auditoria completa e transparência, criamos este HUD de console integrado, que permite acompanhar exatamente cada cálculo cognitivo que o app toma em tempo real, inclusive em celulares sem precisar ligar cabo USB."*
- [ ] **Inteligência do app (`js/engine/scheduler.js`):**
  1. **Dificuldades Desejáveis (Bjork):** Nunca reapresenta um card imediatamente (intervalo mínimo de 5 cards) para forçar o decaimento da memória de trabalho fonológica e obrigar o cérebro a fazer esforço genuíno de recuperação.
  2. **Erro de Predição & Latência de Resposta:**
     - Se o usuário erra muito rápido ($t < 2s$), o algoritmo identifica chute cego ou falsa confiança e aplica **bônus de gap (+4 cards)** para quebrar o viés intuitivo.
     - Se erra após refletir muito ($t > 12s$), o gap fica no mínimo (5 cards) para evitar a extinção total do traço de memória.
  3. **Efeito de Intercalação (Interleaving Effect):** O algoritmo analisa os tópicos (`citologia`, `genética`, `computação`) e **proíbe blocos monotônicos**, alternando temas automaticamente e injetando cartões novos quando há acúmulo de cartões pendentes.
  4. **Regras de Graduação & Leech Cards (Sanguessugas):** Cartões com mais de 4 erros (`wrongCount > 4`) são marcados como sanguessugas e exigem **2 acertos consecutivos** para serem graduados da sessão.
- [ ] **Dica de console:**
  - Mostre as linhas de log com prefixo `[Algorithm]`:
    - `[Algorithm] calculateThinkingGap (Neuroscience): { thinkingTime: 'X.Xs', bonus: Y, finalGap: Z }`
    - `[Algorithm] Card due selecionado (Interleaving): { topic: '...', lastTopic: '...' }`
    - `[Algorithm] Intercalando card aleatório fresco (Interleaving Effect)`

---

## 🎴 5. Os 5 Formatos de Cards & Tolerância a Erros

- [ ] **Ação:**
  - Vá respondendo os cards do deck demo, destacando cada mecânica:
- [ ] **1. Resposta Aberta (`open` — Active Recall):**
  - **Ação:** Digite a resposta com um pequeno erro de digitação (ex: `Mitocondria` sem acento).
  - **O que falar:** *"O sistema possui tolerância inteligente a erros de digitação e acentuação via algoritmo de Distância de Levenshtein otimizado com Typed Arrays (`Int32Array`), aceitando similaridade $\ge 80\%$."*
- [ ] **2. Resposta Dupla (`open_double`):**
  - **Ação:** Digite `Adenina`, aperte <kbd>Enter</kbd> (o foco pula sozinho para o segundo campo), digite `Guanina` e aperte <kbd>Enter</kbd>.
  - **O que falar:** *"Ergonomia fluida: o foco avança automaticamente sem necessidade de mouse, perfeito para estudos de alta velocidade."*
- [ ] **3. Múltipla Escolha (`multiple_choice`):**
  - **Ação:** Em vez de clicar com o mouse, aperte a tecla <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd> ou <kbd>4</kbd> no teclado.
  - **O que falar:** *"Interface com atalhos diretos nos números para zero fricção e alta cadência de revisão."*
- [ ] **4. Preenchimento de Lacunas (`fill` / Cloze Deletion):**
  - **Ação:** Mostre as lacunas integradas no fluxo do texto e a validação individual de cada token.
  - **O que falar:** *"Ideal para termos técnicos, artigos de leis, fórmulas ou definições de livros didáticos."*
- [ ] **5. Formato Anki-like (`anki`):**
  - **Ação:** Aperte <kbd>Espaço</kbd> para virar o cartão. Mostre os 4 botões de avaliação:
    - <kbd>1</kbd> Errei (Again) | <kbd>2</kbd> Difícil (Hard) | <kbd>3</kbd> Bom (Good) | <kbd>4</kbd> Fácil (Easy)
  - **O que falar:** *"Combina o melhor do Anki clássico com a modernidade visual do Material You."*
- [ ] **Dica de console:**
  - Mostre a avaliação de similaridade sendo calculada em milissegundos:
    - `[Game] Levenshtein Similarity: 0.92 -> Resposta aceita!`

---

## 🖍️ 6. Marca-Texto Inteligente & UX Móvel Anti-Conflito

- [ ] **Ação:**
  - Selecione qualquer palavra na pergunta ou resposta usando o mouse ou dedo.
  - Mostre o popup flutuante surgindo **logo abaixo do texto selecionado**.
  - **Clique no botão do marca-texto** (`highlight.svg`) para exibir a paleta de cores:
    - Aponte a animação expressiva **Material Design 3**: o botão faz um bounce dinâmico com leve inclinação e a barra expande com física elástica (spring), revelando os 4 círculos de cores pastel em cascata com efeito de pulo/bounce.
  - Pressione as teclas <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd> ou <kbd>4</kbd> (ou clique) para aplicar as cores pastel (Amarelo, Verde, Azul, Roxo).
  - Clique na palavra marcada para mostrar a opção de remoção em 1 toque.
- [ ] **O que falar pro comprador:**
  - *"Em celulares, quando você seleciona texto, o Android e o iOS abrem o menu nativo 'Copiar/Compartilhar' acima da palavra. Projetamos nosso menu de marca-texto para surgir intencionalmente **abaixo**, eliminando 100% dos conflitos de toque."*
  - *"Repare no polimento visual: animações expressivas Material V3 com física de mola (spring/bounce) e feedback háptico tátil na expansão da paleta."*
  - *"As marcações são persistidas no próprio baralho: quando você volta a estudar, seus destaques continuam lá."*
- [ ] **Inteligência do app:**
  - Prioridade contextual de atalhos em `input-controller.js`: se há texto selecionado, as teclas <kbd>1</kbd>–<kbd>4</kbd> pintam o texto; se o card Anki está virado, avaliam a dificuldade; se está em campo de texto, digitam os números. Sem conflitos!
- [ ] **Dica de console:**
  - Logs mostram: `[Game] Highlight aplicado: 'termo' com cor yellow (persistido no deck)`.

---

## 🤖 7. Camada de Inteligência Artificial (Gemini)

- [ ] **Ação 1: Tutor Resumido ("Peça Ajuda"):**
  - Selecione um termo no cartão e clique no botão circular com ícone de tutor (`tutor.svg`).
  - Aponte a **animação suave de shimmer** enquanto a IA processa.
  - Mostre o card flutuante exibindo uma explicação de 1 a 2 frases contextualizada estritamente com a pergunta e resposta do card atual.
- [ ] **Ação 2: Chat Lateral com Contexto:**
  - No popup do tutor, clique no ícone de chat (`open_chat.svg`).
  - A gaveta lateral se abre já trazendo o contexto do card para o usuário tirar dúvidas complementares.
- [ ] **Ação 3: Avaliação Semântica Inteligente:**
  - Em uma pergunta aberta, digite uma resposta conceitualmente correta, mas com palavras diferentes da esperada no banco.
  - A IA do Gemini analisa semanticamente via **Structured Outputs (JSON Schema)** e valida o acerto dinamicamente, exibindo uma justificativa pedagógica.
- [ ] **O que falar pro comprador:**
  - *"A IA aqui não é um enfeite genérico: ela atua como um professor particular ao lado do aluno. Ela compreende sinônimos em respostas abertas e explica termos sem tirar o foco da sessão de estudos."*
  - *"Utilizamos o modelo ultra-rápido `gemini-flash-lite`, com tempo de resposta na casa de milissegundos e custo operacional mínimo por requisição."*
- [ ] **Dica de console:**
  - Abra o console e mostre o log da chamada:
    - `[Tutor] Chamada Gemini executada com sucesso. Versão: gemini-flash-lite-latest, Latência: 480ms`
    - `[Tutor] Avaliação Semântica: { correto: true, justificativa: 'O usuário utilizou um sinônimo exato aceito na literatura...' }`

---

## ⏱️ 8. Pomodoro Integrado & Periféricos (Gamepad API)

- [ ] **Ação 1: Modo Pomodoro:**
  - Abra o menu hambúrguer e ative o **Pomodoro**.
  - Mostre o contador no topo (25 min de foco / 5 min de descanso).
  - Explique que ao final do ciclo é emitido feedback sonoro sintetizado em tempo real via **Web Audio API** (`AudioContext`, sem precisar baixar MP3s pesados) e vibração tátil (**Vibration API** com 11 assinaturas hápticas diferentes).
- [ ] **Ação 2: Gamepad API (Estudo com Controle de Videogame):**
  - Mencione ou conecte um controle de videogame (Xbox, PS5, Switch ou 8BitDo).
  - Mostre que os botões frontais viram o card e os botões A/B/X/Y avaliam as dificuldades.
- [ ] **O que falar pro comprador:**
  - *"Estudantes de alta performance estudam horas por dia. O suporte a controles de videogame permite estudar recostado na cadeira ou esteira ergométrica sem tocar no teclado."*
- [ ] **Inteligência do app:**
  - **Zero Consumo de Bateria:** Em vez de rodar um loop de polling contínuo gastando CPU, o motor escuta o evento `gamepadconnected` e suspende o ciclo de leitura quando inativo.

---

## 📲 9. Sincronização P2P sem Servidor (Bitset QR Code)

- [ ] **Ação:**
  - No menu do jogo, clique em **"Transferir Sessão"** (`transfer.js`).
  - Mostre o QR Code gerado na tela.
- [ ] **O que falar pro comprador:**
  - *"Se o app não tem servidor, como o usuário passa o progresso do computador para o celular? Criamos um algoritmo de compressão em **Bitset**: codificamos o estado de todo o baralho em uma sequência binária (1s e 0s)."*
  - *"O QR Code fica tão leve e de baixa densidade que qualquer câmera de celular antigo consegue ler em frações de segundo, até no escuro e sem internet."*
- [ ] **Inteligência do app:**
  - Cada cartão do pool ativo vira um bit (`1` pendente, `0` concluído). Um baralho de 100 cards gera uma string minúscula de dados que cabe em um QR de densidade mínima.
- [ ] **Dica de console:**
  - Mostre o log no console ou overlay de sync:
    - `[SyncLog] Otimizando QR... Bitset gerado: 1101001... (X bytes)`

---

## 📚 10. Modos Especiais: Caderno de Erros & Semana de Provas

- [ ] **Ação 1: Caderno de Erros (Notebook):**
  - Mostre o ícone de marcador (bookmark) no canto superior do cartão.
  - Explique que o aluno pode favoritar questões críticas para montar instantaneamente um baralho filtrado só com seus pontos fracos.
- [ ] **Ação 2: Semana de Provas (Exam Mode):**
  - Na tela inicial, selecione múltiplos baralhos para fundi-los em uma fila contínua única.
- [ ] **O que falar pro comprador:**
  - *"Esses dois modos resolvem a dor real do estudante em época de prova: revisar apenas o que errou ou fundir 10 matérias em uma maratona de estudo intercalado."*

---

## 📊 11. Dashboard de Analytics & Categorização IA

- [ ] **Ação:**
  - Abra a página de Estatísticas (`pages/stats.html`).
  - Mostre os gráficos de retenção por formato de card, precisão geral e tempo médio por questão.
  - Aponte a seção de **Leech Cards (Sanguessugas)** isolando as questões mais difíceis.
  - Mostre o agrupamento automático por **Matérias & Assuntos**.
- [ ] **O que falar pro comprador:**
  - *"O app não apenas mede acertos e erros: ele categoriza automaticamente os baralhos do aluno em matérias amplas e assuntos específicos usando o Gemini via Function Calling (`salvar_categorizacao_estudos`)."*
  - *"O aluno e a instituição conseguem ver exatamente onde está o gargalo de aprendizado (ex: 'meu rendimento cai 30% em Farmacologia quando comparado a Anatomia')."*

---

## 💼 12. Fechamento Comercial & Métricas de Valor

- [ ] **Resumo de Venda dos 5 Diferenciais Técnicos:**
  1. **Custo de Operação Quase Zero:** Arquitetura Serverless/Client-Side; roda em qualquer CDN estática (Cloudflare Pages, Vercel, S3) sem custo de servidor.
  2. **Independência Tecnológica:** Código Vanilla moderno e modular, sem dependências de frameworks perecíveis (React/Vue/Angular), com manutenção simples e durabilidade garantida por anos.
  3. **Algoritmo com Embasamento Científico:** Não é apenas um visual bonito; é um motor cognitivo sério que retém alunos e gera resultados comprovados de memorização.
  4. **Segurança & Privacidade em Primeiro Lugar:** Criptografia WebCrypto de ponta a ponta e zero armazenamento de dados sensíveis em servidores de terceiros.
  5. **Pronto para Distribuição:** PWA com manifest, Service Worker offline, suporte a mobile, desktop e atalhos completos de teclado e gamepad.

---

## ⌨️ Tabela de Atalhos para Memorizar na Apresentação

| Atalho | Efeito no Jogo |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>C</kbd> | Abrir/Fechar Console HUD de auditoria |
| **Triplo Clique no Título** | Abrir/Fechar Console HUD em qualquer dispositivo |
| <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd>, <kbd>4</kbd> | Cores de Marca-texto (com texto selecionado) ou Notas Anki (virado) ou Múltipla Escolha |
| <kbd>Espaço</kbd> / <kbd>Enter</kbd> | Virar cartão Anki / Submeter resposta aberta / Avançar |
| <kbd>Esc</kbd> | Fechar modais, gaveta da IA ou cancelar marcação |
