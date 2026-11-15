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
`GET https://osdr.nasa.gov/osdr/data/osd/meta/{id}` → via `/api/osdr/{id}`

| Estudo | O que extraímos | Vira no jogo |
|---|---|---|
| **OSD-895** — EDEN ISS (estufa espacial análoga, Antártida 2018) | biomassa: pepino 67 kg, alface 56 kg, rabanete 8 kg; luz; fotoperíodo; "spread harvest" do pepino | Elixir por colheita = `10 + kg × 0,35`; pepino com colheita contínua (3×) |
| **OSD-883** — vegetais cultivados com solo lunar da Apollo 14 | alface coletada com 18 dias, rabanete com 14 dias | Dias de crescimento = `dias reais ÷ 7` (× nível de dificuldade) |

Culturas: **Alface, Pepino e Rabanete** (a alface substitui a couve do GDD para ficar igual às telas).

O pepino não aparece nesses estudos com duração de ciclo; usamos 42 dias como estimativa e isso aparece como "estimativa" no jogo.

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
- Melhorias (como na tela): Base 5 níveis (tanque 100→180), Plantação 4 níveis (+cúpulas, −água, colheitas maiores), Foguete 5 partes (minigames canos/fios alternados). As últimas partes do foguete exigem tanque maior → obriga a melhorar a Base.
- Dificuldade pela idade: 7–8 Iniciante, 9–10 Intermediário, 11–12 Avançado.
- Acessibilidade: todo texto tem botão 🔊 (narração pt-BR pelo navegador) + narração automática do robô.
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
