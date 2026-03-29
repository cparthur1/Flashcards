# 🗂️ Flashcards AI

Uma ferramenta de estudo moderna e inteligente para transformar seus materiais em conhecimento memorizado. Carregue seus arquivos ou textos e deixe a Inteligência Artificial criar seu banco de questões em segundos.

---

## ✨ Novas Funcionalidades (Recentes)

### 🤖 Gerador de Flashcards com IA
Integrado nativamente com a **API do Gemini (Google)**, agora você pode gerar baralhos completos a partir de:
- **Arquivos:** PDF, Docx e TXT.
- **Texto Direto:** Cole seus resumos ou anotações diretamente no app.

### ⚡ Streaming em Tempo Real
Não precisa esperar a IA terminar! Os cartões aparecem na sua tela **conforme são gerados**. A interface de edição abre instantaneamente, permitindo que você acompanhe o progresso e já veja as primeiras questões.

### 🎨 Visual Premium & Experiência Fluida
- **Gradiente Animado:** Um fundo dinâmico e moderno durante a geração para um feedback visual elegante.
- **Editor Completo:** Revise, edite ou exclua cartões antes de começar a estudar ou salvar seu arquivo.
- **Título Automático:** A IA sugere um nome profissional para seu baralho com base no conteúdo gerado.

---

## 🔑 Configuração da API
Para usar o gerador, você precisa de uma chave de API do Gemini (Grátis):
1. Clique em **"Crie uma grátis"** na tela inicial do Gerador.
2. Siga o guia visual integrado para obter sua chave no **Google AI Studio**.
3. Cole sua chave e comece a criar!

---

## 📖 Como Funciona?

### Principais Modos de Estudo:
- **Aprendizado Ativo:** O app remove cartões que você já acertou e repete os que você errou até a fixação completa.
- **Tipos de Cartão:**
  - **Aberto:** Resposta escrita direta.
  - **Aberto Duplo:** Para conceitos com dois componentes (ex: Origem e Inserção).
  - **Múltipla Escolha:** Escolha entre 4 opções geradas pela IA.

### Fluxo de Trabalho:
1. **Gere ou Carregue:** Use a IA ou carregue um arquivo `.json` que você já possui.
2. **Revise:** Use o editor lateral para fazer ajustes finos.
3. **Estude ou Salve:** Clique em **"Jogar Agora"** para iniciar a sessão ou **"Salvar Arquivo"** para guardar seu baralho localmente.

---

## 🛠️ Detalhes Técnicos
- **Frontend:** HTML5, Tailwind CSS, JavaScript Vanilla.
- **IA:** Google Generative AI (`@google/generative-ai`) com suporte a **Streaming**.
- **PWA Ready:** Funciona diretamente no navegador e pode ser instalado como um app.

---

## ✍️ Uso Manual (Avançado)
Se preferir não usar a IA, você ainda pode carregar arquivos `.json` estruturados. O formato segue o padrão abaixo:

```json
[
  {
    "type": "open",
    "description": "Qual a capital da França?",
    "answer": "Paris"
  },
  {
    "type": "multiple_choice",
    "description": "Qual o maior planeta?",
    "answer": "Júpiter",
    "options": ["Terra", "Marte", "Júpiter", "Saturno"]
  }
]
```

---
*Desenvolvido para facilitar a vida de quem precisa decorar muito conteúdo em pouco tempo.* 🚀
