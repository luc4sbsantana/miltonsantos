# Audiobook — Milton Santos e a Globalização Brasileira

Site estático de leitura sincronizada com áudio, estilo audiobook. O texto ocupa a tela inteira com destaque palavra por palavra em tempo real, acompanhando a narração.

## Como testar localmente

O `fetch` do JavaScript não funciona abrindo o `index.html` diretamente no navegador (protocolo `file://`). Use um servidor local:

### Opção 1 — Python (já vem instalado em muitos sistemas)
```bash
cd Resenhas
python -m http.server 8000
```
Depois abra [http://localhost:8000](http://localhost:8000).

### Opção 2 — VS Code Live Server
1. Instale a extensão **Live Server** no VS Code.
2. Clique com o botão direito em `index.html` → **Open with Live Server**.

### Opção 3 — Node.js (npx)
```bash
npx -y serve .
```

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub (pode ser público).
2. Faça upload de todos os arquivos desta pasta (`index.html`, `style.css`, `app.js`, `texto.txt`, `sync.json`, `Geografia.mp3`).
3. Vá em **Settings → Pages**.
4. Em **Source**, selecione a branch `main` e a pasta `/ (root)`.
5. Clique em **Save**. O site estará disponível em `https://seu-usuario.github.io/nome-do-repo/`.

## Arquivos

| Arquivo          | Descrição                                          |
|------------------|----------------------------------------------------|
| `index.html`     | Estrutura HTML do audiobook                        |
| `style.css`      | Estilo visual (fundo escuro, tipografia serifada)  |
| `app.js`         | Lógica de sincronização e controles                |
| `texto.txt`      | Texto do trabalho (cada linha = parágrafo/título)  |
| `sync.json`      | Tempos de cada palavra na narração                 |
| `Geografia.mp3`  | Áudio da narração                                  |

## Atalhos de teclado

- **Espaço** — Tocar / Pausar
- **← Seta esquerda** — Voltar 5 segundos
- **→ Seta direita** — Avançar 5 segundos
- **Clique em qualquer palavra** — Pular para ela no áudio

## Funcionalidades

- Destaque palavra por palavra sincronizado com o áudio
- Rolagem automática que mantém a palavra no centro da tela
- Player discreto com blur, velocidade ajustável (0.75×, 1×, 1.25×, 1.5×)
- Posição de leitura salva automaticamente (localStorage)
- Responsivo e acessível (aria-labels, contraste, prefers-reduced-motion)
