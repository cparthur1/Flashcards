# Flashcards
Um webapp simples de flashcards que uso pra carregar .json com conteúdos da faculdade e decorar conceitos

# Resumo de como usar:
Ninguém que precisa decorar um monte de conteúdo vai escrever na mão os flashcards que precisa e, se fosse, usaria o Ankii. A ideia disso aqui é ser um jeito de fazer mais rápido cartões prontos pra usar. 
Coloque todos os slides ou materiais com listas de conceitos que precisa decorar no Gemini ou Chat GPT com o prompt:

"Usando todo o conteúdo de todos os materiais que te mandei, gere um arquivo .json com flashcards para mim decorar todos os conceitos apresentados nos materiais. Nos cartões de resposta escrita "open" a resposta deve ser em palavras chave, As respostas das questões abertas devem ser de 1 palavra só (ou mais caso for um conceito formado por mais de uma palavra), como se a resposta fosse o título do cartão e a pergunta a descrição dele. Quando houver vários conceitos que tenham respostas similares ou diferenciais, use os cartões de múltipla escolha "multiple_choice". O .json deve seguir essa estrutura: [
    {
        "type": "open",
        "description": "Qual a capital da França?",
        "answer": "Paris"
    },
    {
        "type": "multiple_choice",
        "description": "Qual o maior planeta do Sistema Solar?",
        "answer": "Júpiter",
        "options": ["Terra", "Marte", "Júpiter", "Saturno"]
    },
    {
        "type": "open",
        "description": "Qual a fórmula química da água?",
        "answer": "H2O"
    }
]"

Colando esse prompt junto dos teus materiais, ele deve gerar o texto dos teus flashcards, cole esse texto em um bloco de notas e salve o arquivo como .json, abra o webapp e faça upload desse arquivo e pronto :) 

# 📖 Para que serve?
Esta é uma ferramenta de estudo flexível e reutilizável, projetada para ajudar você a memorizar e revisar conteúdos de qualquer matéria através de flashcards. A plataforma funciona diretamente no seu navegador e permite que você carregue seus próprios bancos de questões, tornando o aprendizado ativo e personalizado.
Principais Funcionalidades:
Dois Tipos de Questão: Suporta tanto questões dissertativas (resposta aberta) quanto de múltipla escolha.
Aprendizado Inteligente: Questões acertadas são removidas do ciclo de estudo atual, enquanto as erradas são repetidas até que você acerte, garantindo a fixação do conteúdo.
Totalmente Personalizável: Você pode criar bancos de questões sobre qualquer assunto (Biologia, Direito, História, Idiomas, etc.) usando um formato de arquivo simples (.json).
Não Requer Instalação: Funciona 100% no seu navegador. Basta abrir o arquivo HTML e carregar suas perguntas.

# ⚙️ Como Funciona?
A aplicação é composta por dois arquivos principais:
flashcards_template.html: Este é o "motor" do aplicativo. É o arquivo que você abre no navegador para iniciar a plataforma. Ele contém toda a lógica para exibir as perguntas, verificar as respostas e gerenciar seu progresso.
[seu_arquivo_de_questoes].json: Este é o seu banco de dados de perguntas. É um arquivo de texto simples onde você lista todas as perguntas, respostas e opções que deseja estudar.
Ao iniciar, o flashcards_template.html pedirá que você carregue um arquivo .json. Uma vez carregado, o aplicativo lê suas perguntas e inicia uma sessão de estudo.

# 🚀 Como Usar?
Siga estes 3 passos simples para começar a estudar:
Passo 1: Crie seu Banco de Questões
O primeiro passo é criar um arquivo .json com suas perguntas. Você pode usar qualquer editor de texto simples (Bloco de Notas, VS Code, Sublime Text, etc.).
A estrutura do arquivo é uma lista de objetos, onde cada objeto é um flashcard. Veja como formatar cada tipo de questão abaixo.
Passo 2: Abra a Plataforma
Abra o arquivo flashcards_template.html em qualquer navegador de internet (Google Chrome, Firefox, Safari, etc.).
Passo 3: Carregue seu Arquivo e Comece
Na tela inicial, clique no botão para selecionar um arquivo, encontre o seu arquivo .json que você criou no Passo 1 e clique em "Iniciar Flashcards". Pronto! A sessão de estudo começará imediatamente.

# ✍️ Como Criar seu Próprio Banco de Questões (.json)
Este é o passo mais importante. Seu arquivo .json deve ser uma lista ([]) contendo vários objetos de questão ({}). Cada objeto precisa seguir um formato específico.
1. Questões Abertas (Dissertativas)
Use este formato para perguntas onde você precisa digitar a resposta.
Estrutura:
{
  "type": "open",
  "description": "Qual a pergunta que você quer fazer?",
  "answer": "Qual a resposta correta"
}


Exemplo:
{
  "type": "open",
  "description": "Qual organela celular é responsável pela respiração celular?",
  "answer": "Mitocôndria"
}


💡 Dica: Se uma resposta pode ser escrita de várias formas (ex: um nome e um sinônimo), separe-as com uma barra /. O sistema aceitará qualquer uma delas.
Exemplo: "answer": "Barbeiro/Triatomíneo"
2. Questões de Múltipla Escolha
Use este formato para perguntas com opções pré-definidas.
Estrutura:
{
  "type": "multiple_choice",
  "description": "Qual a sua pergunta de múltipla escolha?",
  "answer": "A resposta correta exata",
  "options": ["Opção A", "Opção B", "Opção C", "A resposta correta exata"]
}


Exemplo:
{
  "type": "multiple_choice",
  "description": "Quem é o hospedeiro definitivo do *Toxoplasma gondii*?",
  "answer": "Felinos",
  "options": ["Humanos", "Cães", "Felinos", "Aves"]
}


Observações Importantes:
A "answer" deve ser exatamente igual a uma das strings dentro da lista "options".
Para uma melhor experiência visual, forneça sempre 4 opções de resposta. O sistema irá embaralhá-las automaticamente.
Arquivo .json Completo (Exemplo)
Seu arquivo final será uma lista com todas as suas questões, misturando os tipos se desejar.
[
    {
        "type": "open",
        "description": "Qual a capital da França?",
        "answer": "Paris"
    },
    {
        "type": "multiple_choice",
        "description": "Qual o maior planeta do Sistema Solar?",
        "answer": "Júpiter",
        "options": ["Terra", "Marte", "Júpiter", "Saturno"]
    },
    {
        "type": "open",
        "description": "Qual a fórmula química da água?",
        "answer": "H2O"
    }
]
