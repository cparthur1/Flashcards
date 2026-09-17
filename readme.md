# 🧠 Flashcards AI

> Plataforma moderna, 100% serverless e orientada a privacidade para estudo ativo, repetição espaçada e análise cognitiva com Inteligência Artificial.

[![Acessar Webapp](https://img.shields.io/badge/Acessar-Webapp%20Online-2563eb?style=for-the-badge&logo=googlechrome&logoColor=white)](https://cparthur1.github.io/Flashcards/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-7c3aed?style=for-the-badge&logo=pwa&logoColor=white)](https://cparthur1.github.io/Flashcards/)
[![Powered by Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4f46e5?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)
[![Local First](https://img.shields.io/badge/Privacidade-100%25%20Local-10b981?style=for-the-badge&logo=databricks&logoColor=white)](https://cparthur1.github.io/Flashcards/)

> 🚀 **Experimente online agora sem precisar instalar nada:**  
> 👉 **[https://cparthur1.github.io/Flashcards/](https://cparthur1.github.io/Flashcards/)**

O **Flashcards AI** transforma materiais brutos (PDFs, documentos Word, apostilas ou anotações) em baralhos interativos de alta retenção, combinando o algoritmo de repetição espaçada (estilo Anki), geração inteligente de perguntas, categorização semântica por matérias e assuntos, sincronização por QR Code sem servidor e analítica pedagógica em tempo real.

---

## ⚡ Principais Funcionalidades

### 🤖 1. Criação & Edição com IA (Google Gemini)
- **Geração Multiformato:** Crie baralhos técnicos a partir de arquivos **PDF**, **Docx (Word)**, **TXT** ou colando anotações diretamente no app.
- **Streaming em Tempo Real:** Os flashcards surgem na tela conforme são sintetizados pelo modelo. O editor abre instantaneamente para revisão contínua.
- **Edição Agêntica (Agentic Deck Editor):** Peça ajustes em linguagem natural no painel lateral de chat. O Gemini usa *Function Calling* para criar, atualizar ou podar cartões no baralho.
- **Correção Semântica Inteligente:** Na hora de responder, a IA analisa o significado da sua resposta escrita, perdoa pequenos erros de digitação e explica o fundamento do acerto ou erro.
- **Tutor Virtual Integrado:** Dúvidas no cartão atual? Abra o assistente dentro da partida para pedir analogias, exemplos práticos ou aprofundamento imediato.

---

### 🎴 2. Quatro Modos de Cartão & Renderização Avançada
- **Aberto (Active Recall):** Digite a resposta esperada para forçar a recuperação ativa da memória.
- **Aberto Duplo:** Perguntas com 2 respostas obrigatórias (ex.: *Origem & Inserção*, *Mecanismo de Ação & Posologia*).
- **Múltipla Escolha:** 2 a 6 opções com feedback visual imediato e suporte a atalhos de teclado.
- **Anki (Repetição Espaçada):** Cartões com frente/verso e autoavaliação em 4 botões (*Errei, Difícil, Bom, Fácil*).
- **Fórmulas Matemáticas (KaTeX):** Renderização impecável de LaTeX inline (`$...$`) e em bloco (`$$...$$`).
- **Markdown & Imagens:** Formatação rica com tabelas, negritos e imagens na pergunta e na resposta.

---

### 🖍️ 3. Marca-Texto Interativo nos Cartões (Highlighter)
- **Seleção Dinâmica:** Selecione qualquer trecho de texto da pergunta ou resposta para exibir o gatilho minimalista flutuante.
- **Paleta Pastel com 4 Cores:** Amarelo, Verde, Azul e Roxo pastel sem distrações visuais.
- **Persistência Total:** Marcações são salvas permanentemente no baralho e acompanham o cartão nas próximas rodadas.
- **Desmarcar com 1 Clique:** Selecionar um trecho já grifado atualiza o botão para remoção imediata da marcação.
- **Analytics de Destaques:** Acompanhe na página de estatísticas a contagem de grifos aplicados por cor.

---

### 📊 4. Página de Estatísticas & Analítica Cognitiva (`pages/stats.html`)

#### 🎯 Aba Sessão Atual
- **Progresso & Precisão:** Percentual de conclusão do baralho, acertos/erros, tempo total e ritmo médio (`s/card`).
- **Previsão & Ritmo:** Estimativa de tempo restante até zerar o baralho, card mais rápido (⚡ recall imediato) e card mais lento (⏳ reflexão aprofundada).
- **Domínio do Baralho (Mastery Score):** Índice de fixação (0 a 100 pontos) com distintivos dinâmicos:
  - 🏆 *Mestre do Baralho* (≥ 85 pts)
  - 🥇 *Domínio Avançado* (65–84 pts)
  - 🥈 *Em Construção* (40–64 pts)
  - 🥉 *Iniciando* (< 40 pts)
- **Linha do Tempo Invertida:** Exibe estritamente os **últimos 10 cartões respondidos**, com o mais recente posicionado na **extrema esquerda** com pulso indicador e tooltip detalhado.
- **Diagnóstico Pedagógico:** Análise comparativa sessão a sessão (`+X% vs sessão anterior`) para identificar ganhos ou fadiga cognitiva.

#### 🧠 Categorização Semântica com Gemini Flash-Lite (Function Calling)
- **Desempenho por Matérias Globais:** Agrupa todos os seus baralhos estudados em disciplinas gerais (ex.: *Medicina*, *Semiologia*, *Farmacologia*) e aponta em quais matérias seu aproveitamento é superior.
- **Desempenho por Assuntos do Baralho:** Mapeia cada pergunta do baralho atual para um tópico conciso (ex.: *Valvopatias*, *Eletrocardiograma*, *Arritmias*) com barra de aproveitamento e badges de retenção.
- **Mínimo de Categorias Possível:** O prompt força a consolidação em temas amplos e consistentes, reutilizando categorias salvas no navegador para evitar fragmentação.
- **Modo Local e Seguro:** Se a IA não estiver ativa, nenhuma requisição é enviada e um card convida o usuário a inserir a chave.

#### 📈 Aba Histórico
- Totais acumulados de sessões, tempo de estudo, cartões revisados, precisão histórica e **Recorde de Sequência Histórica** (🔥).
- Gráfico responsivo em SVG/CSS da evolução da precisão sessão a sessão.
- Grid de matérias globais para acompanhamento de longo prazo.

#### ⚠️ Aba Foco de Revisão
- Exibe estritamente os **Top 20 cards com maior frequência de erros** em ordem decrescente.
- Botão **+ Caderno** individual ou em lote para transferir dúvidas para o Caderno de Estudos.
- Opção **Ignorar** posicionada abaixo de cada botão para ocultar cartões pontuais da lista de atenção.

---

### 📲 5. Sincronização P2P Serverless (QR Code + Bitsets)
- **Sem Servidor e Sem Conta:** Transfira sua sessão de estudo do computador para o smartphone em menos de 2 segundos.
- **Bitsets Binários + Compressão LZ-String:** Decks com mais de 300 cartões cabem em um único QR Code estático.
- **Scanner Embutido:** Abra a câmera do celular diretamente no webapp para ler o código sem sair da página.

---

### 📓 6. Caderno de Estudos (Notebook)
- Espaço dedicado para isolar cartões difíceis, errados ou marcados para reforço imediato.
- Alterne entre o baralho original e o Caderno pelo seletor de modo na barra superior.

---

## 🎨 Design System & Estética

O Flashcards AI foi projetado segundo diretrizes rigorosas documentadas em [`css/style.css`](css/style.css):
- **Paleta Minimalista:** Tons de azul (`#2563eb`, `#1d4ed8`) e roxo (`#7c3aed`, `#6d28d9`) com fundo limpo.
- **Luz e Sombra Monocromáticas:** Gradientes suaves que representam iluminação direcional física (claro no topo, sutilmente mais escuro na base), banindo gradientes arco-íris estridentes.
- **Profundidade Skeuomórfica Tátil:** Chanfros internos finos (`inset 0 1px 0 rgba(255,255,255,...)`), reentrâncias em trilhos de barra de progresso (`inset 0 1px 2px rgba(0,0,0,...)`) e sombras macias em elevações.
- **Menu Hambúrguer Estruturado:** Header despoluído com 4 seções organizadas (*Inteligência Artificial*, *Baralho*, *Estudo & Sessão*, *Sair*).
- **Dark Mode Completo:** Ajuste visual relaxante para estudos noturnos prolongados.

---

## 🎮 Atalhos de Teclado & Gamepad

| Ação | Teclado | Gamepad / Controle |
| :--- | :--- | :--- |
| **Girar Cartão (Anki)** | `Espaço` ou `Enter` | Botão `A` / `Cross` |
| **Classificar Errei (Again)** | `1` | D-Pad `Esquerda` |
| **Classificar Difícil (Hard)** | `2` | D-Pad `Cima` |
| **Classificar Bom (Good)** | `3` | D-Pad `Direita` |
| **Classificar Fácil (Easy)** | `4` | D-Pad `Baixo` |
| **Alternativas (Múltipla Escolha)** | `1`, `2`, `3`, `4` | Botões frontais |
| **Console Diagnóstico** | `Alt + C` | — |

---

## 🔑 Configuração da Chave da API do Gemini (Opcional & Grátis)

Os recursos básicos de flashcards funcionam **100% offline**. Para habilitar a geração de baralhos, o chat tutor e a categorização por matérias:

1. Obtenha uma chave gratuita no [Google AI Studio](https://aistudio.google.com/app/apikey).
2. No menu do app, clique na seção **Inteligência Artificial** ou no card de IA nas Estatísticas.
3. Cole sua chave de API (`AIzaSy...`).
4. Sua chave é guardada **apenas localmente no seu navegador** (`sessionStorage`/`localStorage`), garantindo total privacidade.

---

## 📂 Estrutura de Arquivos JSON (Modo Manual)

Você pode salvar e carregar seus próprios baralhos usando arquivos `.json`. O formato suportado é simples e extensível:

```json
[
  {
    "type": "anki",
    "description": "Qual a tríade clínica clássica da estenose aórtica?",
    "answer": "Dispneia de esforço, angina de peito e síncope."
  },
  {
    "type": "open",
    "description": "Qual o principal neurotransmissor inibitório do SNC?",
    "answer": "GABA"
  },
  {
    "type": "open_double",
    "description": "Quais são a origem e a inserção do músculo bíceps braquial?",
    "answer": "Tubérculo supraglenoidal e processo coracoide",
    "answer2": "Tuberosidade do rádio e aponeurose bicipital"
  },
  {
    "type": "multiple_choice",
    "description": "Qual a conduta inicial na hipercalemia grave com alterações no ECG?",
    "answer": "Gluconato de Cálcio a 10% IV",
    "options": [
      "Furosemida IV",
      "Gluconato de Cálcio a 10% IV",
      "Insulina regular com glicose",
      "Bicarbonato de Sódio"
    ]
  }
]
```

---

## 🛠️ Tecnologias Utilizadas

- **Frontend Core:** HTML5 Semântico, Vanilla JavaScript moderno (ES Modules).
- **Estilização:** Tailwind CSS + Design System skeuomórfico em CSS puro ([`css/style.css`](css/style.css)).
- **Inteligência Artificial:** Google Generative AI SDK (`@google/generative-ai`) com chamadas estruturadas de Function Calling (`gemini-flash-lite-latest`).
- **Renderização Científica:** [KaTeX](https://katex.org/) (fórmulas matemáticas) e [Marked.js](https://marked.js.org/) (Markdown).
- **Sincronização & QR:** [LZ-String](https://pieroxy.net/blog/pages/lz-string/index.html) e [html5-qrcode](https://github.com/mebjas/html5-qrcode).
- **PWA & Offline:** Service Worker ([`sw.js`](sw.js)) com cache estático automatizado.

---

## 🌐 Acesso Online Imediato

Você pode utilizar o app diretamente pelo navegador em qualquer dispositivo (Desktop ou Mobile), sem precisar clonar ou instalar nada:

👉 **[https://cparthur1.github.io/Flashcards/](https://cparthur1.github.io/Flashcards/)**

Compatível com instalação como PWA para funcionamento offline.

---

## 🚀 Como Executar Localmente

Como o projeto é 100% estático e sem dependências de compilação complexas, basta servi-lo com qualquer servidor web HTTP:

```bash
# Clone o repositório
git clone https://github.com/cparthur1/Flashcards.git
cd Flashcards

# Inicie um servidor estático simples (exemplo com Python 3)
python3 -m http.server 8000

# Ou use Node.js
npx serve .
```

Abra `http://localhost:8000` no seu navegador favorito.

---

*Desenvolvido para transformar estudos complexos em memória permanente e de longo prazo.* 💡
