// ZUNO — arte complementar. Quase toda a arte vem das telas originais (pasta assets/).
// Aqui só fica o rabanete, que não aparece nas telas, desenhado no mesmo estilo (contorno escuro grosso).
'use strict';
const ART = {};

ART.rabanete = () => `<svg viewBox="0 0 100 90" class="svgplant">
  <g stroke="#173d22" stroke-width="3.5" stroke-linejoin="round">
    <path d="M50 46 C30 40 18 18 30 8 C42 10 48 28 50 46Z" fill="#5fd34a"/>
    <path d="M50 46 C70 40 82 18 70 8 C58 10 52 28 50 46Z" fill="#5fd34a"/>
    <path d="M50 46 C44 28 46 10 50 2 C56 10 56 28 50 46Z" fill="#8cec5f"/>
  </g>
  <path d="M38 20 L46 34 M62 20 L54 34" stroke="#2e8f2a" stroke-width="2"/>
  <ellipse cx="50" cy="64" rx="20" ry="18" fill="#e8336b" stroke="#5a0f2a" stroke-width="3.5"/>
  <ellipse cx="42" cy="58" rx="6" ry="4" fill="#ff9dbc"/>
  <path d="M50 82 L50 89" stroke="#5a0f2a" stroke-width="3" stroke-linecap="round"/>
</svg>`;
