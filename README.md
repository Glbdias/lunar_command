# 🚀 ZUNO — NASA Space Apps Challenge

Pet virtual educativo na Lua (7–12 anos) que usa **dados reais da NASA**.

## Como rodar
Precisa de **Node.js 18+** (sem dependências).

```bash
node server.js
```
Abra http://localhost:5173 — ou rode `npm start`, ou dê dois cliques em `iniciar.bat` no Windows.

> Por que um servidor? A API da NASA OSDR só libera CORS para o próprio domínio, então o `server.js`
> faz o proxy. Ele também guarda as respostas em `cache/`, então depois do primeiro acesso o jogo funciona offline.
> Sem internet e sem cache, o jogo usa valores embutidos (extraídos dos mesmos estudos) e mostra "OFFLINE" no painel Dados NASA.

## Deploy no Vercel
O projeto já vem configurado (`vercel.json`): é só importar o repositório no Vercel, sem mudar nada nas configurações.
- `public/` é servido como site estático (jogo, arte e vídeo).
- `api/osdr.js` e `api/lro.js` são funções serverless que fazem o proxy da NASA nos mesmos endereços do servidor local
  (`/api/osdr/{id}` e `/api/lro/{camada}/{z}/{linha}/{coluna}`); o cache fica na CDN do Vercel.
- `server.js` é só para rodar no PC e fica fora do deploy (`.vercelignore`).

## Integração com a NASA

### NASA OSDR (Open Science Data Repository) — plantação
**OSD-895 — estufa EDEN ISS, Antártida (Terra), 2018** → via `/api/osd895` (`lib/osd895.js`)

A API `https://osdr.nasa.gov/osdr/data/osd/files/895` só lista os arquivos. O servidor:
1. baixa o ZIP de metadados ISA;
2. lê as tabelas `s_OSD-895.txt` e `a_OSD-895_*.txt`;
3. une os registros por *Sample Name*;
4. guarda o resultado em cache (24 h no PC, 1 dia na CDN do Vercel e a última cópia no aparelho).

| Jogo | Registro do estudo | Mostrado à criança |
|---|---|---|
| Alface | Lettuce Waldmanns Green (colheita única) | dias até colher + kg colhidos no canteiro escolhido |
| Pepino | Cucumber Picowell (colheita repetida) | duração total do cultivo (não o 1º fruto) + kg colhidos |
| Rabanete | Radish Raxe (colheita única) | dias até colher + kg colhidos no canteiro escolhido |

Produção estimada (kg) = Mean Edible Freshweight (kg/m²) × área do canteiro (1×1, 2×2 ou 3×3 m).
Sem dado → "Ainda não temos esse dado" (nunca zero ou valor inventado).
Dias de jogo, água e energia são balanceamento do jogo, separados da ciência.
Detalhes, campos e conferência dos valores: [docs/professor-osd895.md](docs/professor-osd895.md).

### LRO / LOLA (Lunar Reconnaissance Orbiter) — exploração
Tiles WMTS do **NASA Moon Trek** → via `/api/lro/{shade|dem}/{z}/{row}/{col}`
- `LRO_LOLA_DEM_Global_128ppd_v04` (elevação) é lido pixel a pixel em um canvas.
- O mapa é dividido em 16 zonas; para cada uma calculamos **altitude média** e **inclinação** (gradiente).
- Inclinação + distância → custo de oxigênio/energia. Inclinação + baixa altitude → mais sucata.
- `LRO_LOLA_ClrShade_Global_128ppd_v04` é a imagem de relevo mostrada no mapinha do painel.
- Os **4 pinos** da tela de Exploração são 4 zonas reais escolhidas pelo relevo (perto/plana, fundo de cratera, borda íngreme, a mais distante).
- Regiões: **Cratera Copérnico** e **Fra Mauro (pouso da Apollo 14)**.

## Abertura
Todo jogo novo (primeira vez, "Jogar de novo" ou "Reiniciar") abre com o vídeo `public/assets/intro.mp4` (botão PULAR).
Ao terminar, segue para o tutorial: história a partir de "Nos destroços, você encontrou Zuno...", escolha de idade e dicas do robô.
Para trocar o vídeo, basta substituir esse arquivo.

## Mecânicas (conforme o GDD e as telas)
- HUD: Energia/Elixir (%), Oxigênio (%), Sucata (quantidade). Água aparece na tela da Plantação.
- Explorar (−O₂ −Elixir → sucata na mochila) · Voltar para a base (enche O₂; se faltar O₂ na volta, o robô resgata e metade da mochila se perde).
- Extrair gelo (−Elixir → +Água) · Plantar (−Elixir −Água) · Colher (→ +Elixir para o Zuno).
- Dormir: +Elixir (mais se houve colheita no dia), enche O₂, avança 1 dia, plantas crescem.
- Melhorias (como na tela): Base 5 níveis (tanque 100→180), Plantação 4 níveis (+cúpulas, −água, colheitas maiores), Foguete 5 partes (minigames: canos, fios, jogo da memória, fios, canos). As últimas partes do foguete exigem tanque maior → obriga a melhorar a Base.
- Dificuldade pela idade: 7–8 Iniciante, 9–10 Intermediário, 11–12 Avançado.
- Acessibilidade: todo texto tem botão 🔊 (narração pelo navegador, no idioma escolhido) + narração automática do robô.
- Idioma: português por padrão; o botão 🌐 English (história, idade e tela inicial) ou a Área dos pais troca para inglês.
  A escolha fica salva no aparelho (`zuno-lang`) e vale também para jogos novos. Textos desenhados na arte das telas continuam em português.
- Modo Supervisão (⚙️, protegido por conta de multiplicação): limite diário de tela, idade, narração, reiniciar.

## Arquivos
- `server.js` — servidor estático + proxy/cache NASA
- `public/index.html`, `public/style.css`
- `public/game.js` — lógica do jogo, integração das APIs
- `public/assets/` — arte recortada das telas originais: fundo de cada tela (`bg_*.webp`), popups, botões, cúpulas, plantas, pinos, peças dos minigames, robô
- `public/art.js` — só o rabanete (não aparece nas telas), desenhado no mesmo estilo
- `design/` — as telas originais usadas como fonte

Cada tela usa a arte original como fundo; números das barras, timers, plantas, custos, níveis, textos dos popups,
pinos e peças dos minigames são camadas dinâmicas posicionadas por cima (coordenadas 330×540 em `game.js`, objeto `SCREENS`).
