# Dados de crescimento das plantas — NASA OSDR OSD-895

Guia para professores e avaliadores: de onde vêm os números que a plantação do Zuno mostra às crianças.

## O estudo
**OSD-895 — Biomass Production of the EDEN ISS Space Greenhouse in Antarctica During the 2018 Experiment Phase.**
A estufa EDEN ISS fica ao lado da estação Neumayer III, **na Antártida (Terra)**. Ela imita uma estufa de base espacial,
mas **as plantas não foram cultivadas na Lua**. O jogo deixa isso claro na fonte de cada informação.

## Como os dados são obtidos (`lib/osd895.js`)
1. Consulta `https://osdr.nasa.gov/osdr/data/osd/files/895`. O JSON **só lista os arquivos** do estudo.
2. Localiza o ZIP de metadados ISA (`OSD-895_metadata_OSD-895-ISA.zip`) e baixa pelo `remote_url` + `https://osdr.nasa.gov`.
3. Lê as tabelas TSV do ZIP e une os registros por **Sample Name**:
   - `s_OSD-895.txt`: `Characteristics[cultivar]`, `Parameter Value[Harvest Type]`, `Parameter Value[Cycles Evaluated]`
   - `a_OSD-895_*.txt`: `Parameter Value[Age At Sample Harvest]`, `Parameter Value[Mean Edible Freshweight]`,
     `Parameter Value[Edible Freshweight Range]` e as colunas `Unit` logo depois de cada uma.
4. Valida as unidades (`day` e `kilogram per square meter`). Valor ausente, "Not Applicable" ou unidade inesperada
   vira **"Ainda não temos esse dado"**, nunca zero nem um número inventado.

**Cache e falhas de rede.** O ZIP é baixado e lido no servidor, não na tela.
- No PC (`server.js`): o resultado fica em `cache/osd895.json`, é renovado a cada 24 h e, se a NASA estiver fora do ar, a última cópia é usada.
- No Vercel (`api/osd895.js`): a CDN guarda a resposta por 1 dia.
- No aparelho: o jogo guarda a última resposta no navegador e mostra a data em que ela foi obtida em **🛰️ NASA → Dados da NASA**.

## Alimentos do jogo e registros usados
| Jogo | Sample Name (OSD-895) | Colheita | Age At Sample Harvest | Mean Edible Freshweight | Faixa |
|---|---|---|---|---|---|
| Alface | `Lactuca_sativa_Lettuce_Waldmanns_Green` | única (batch) | 37,9 dias | 2,77 kg/m² | 1,42–4,36 kg/m² |
| Pepino | `Cucumis_sativus_FruitCrop_Cucumber_Picowell` | repetida (spread) | 161 dias | 50,88 kg/m² | 41,70–59,98 kg/m² |
| Rabanete | `Raphanus_sativus_sativus_TuberCrop_Radish_Raxe` | única (batch) | 22,6 dias | 1,82 kg/m² | 1,10–3,21 kg/m² |

*Valores conferidos no ZIP em 15/11/2026; o jogo sempre exibe o que a API devolver.*
Referência extra conferida: rúcula com luz alta (`Eruca_vesicaria_sativa_LeafyGreens_Arugula_highLight`), 29 dias e 5,49 kg/m².
O estudo tem 4 alfaces; o jogo usa a *Waldmanns Green* (verde, igual ao desenho). Para trocar, altere `CROP_SAMPLE` em `public/game.js`.

## Cálculos
- **Duração observada** = `Age At Sample Harvest` (dias).
- **Produção média observada** = `Mean Edible Freshweight` (kg/m²).
- **Produção estimada (kg)** = produção média observada (kg/m²) × área plantada (m²).
  A criança escolhe o canteiro na tela "O que plantar?": 1×1 m, 2×2 m ou 3×3 m (1, 4 ou 9 m²).
  A faixa mínima–máxima também é multiplicada pela área e aparece nos detalhes técnicos.
- Os números exatos ficam guardados e são arredondados **só na hora de mostrar**:
  - dias: inteiro;
  - kg: 1 casa decimal abaixo de 10 kg, inteiro a partir de 10 kg.

## O que a criança lê
- **Colheita única (batch):** "O rabanete ficou pronto para colher em cerca de 23 dias. Em um espaço de 1 metro por 1 metro, foram colhidos cerca de 1,8 kg."
- **Colheita repetida (spread):** "O pé de pepino cresceu por 161 dias e deu frutos várias vezes. O estudo não diz quando apareceu o primeiro pepino."
  Aqui `Age At Sample Harvest` é a **duração total do cultivo estudado**, não o tempo até a primeira colheita.
- **Outra área:** "Num espaço de 2 metros por 2 metros, a colheita estimada é de cerca de 7,3 kg."
- Sempre com a fonte discreta: *Fonte: NASA OSDR OSD-895 · estufa na Antártida (Terra)*.

## Ciência × jogo
Dias de jogo, água e energia (`GAME` em `public/game.js`) são **balanceamento do jogo**, e não medições.
A barra de progresso da cúpula conta dias de jogo (🎮) e **não representa o crescimento diário real da planta**.
