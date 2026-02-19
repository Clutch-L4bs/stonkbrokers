/**
 * Generate colorful SVG token logos for 20 new tokens.
 * Each has a unique gradient, icon shape, and symbol.
 */
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "../apps/web/public/tokens");
fs.mkdirSync(OUT, { recursive: true });

const TOKENS = [
  { sym: "NEON",  c1: "#00f5d4", c2: "#00bbf9", icon: "bolt" },
  { sym: "BLAZE", c1: "#ff6b35", c2: "#ff0054", icon: "fire" },
  { sym: "PULSE", c1: "#9b5de5", c2: "#f15bb5", icon: "heart" },
  { sym: "CRYO",  c1: "#48bfe3", c2: "#5390d9", icon: "crystal" },
  { sym: "TURBO", c1: "#fee440", c2: "#f15bb5", icon: "rocket" },
  { sym: "FORGE", c1: "#ff6d00", c2: "#ff9e00", icon: "anvil" },
  { sym: "NOVA",  c1: "#7400b8", c2: "#6930c3", icon: "star" },
  { sym: "DRIFT", c1: "#80ed99", c2: "#57cc99", icon: "wave" },
  { sym: "EMBER", c1: "#e63946", c2: "#f4a261", icon: "flame" },
  { sym: "ZENITH",c1: "#264653", c2: "#2a9d8f", icon: "peak" },
  { sym: "FLUX",  c1: "#e9c46a", c2: "#f4a261", icon: "flow" },
  { sym: "PRISM", c1: "#ef476f", c2: "#ffd166", icon: "diamond" },
  { sym: "VOLT",  c1: "#06d6a0", c2: "#118ab2", icon: "zap" },
  { sym: "RUNE",  c1: "#073b4c", c2: "#118ab2", icon: "rune" },
  { sym: "TITAN", c1: "#e76f51", c2: "#264653", icon: "shield" },
  { sym: "SPARK", c1: "#f72585", c2: "#b5179e", icon: "sparkle" },
  { sym: "ORBIT", c1: "#4361ee", c2: "#3a0ca3", icon: "ring" },
  { sym: "HYPER", c1: "#4cc9f0", c2: "#4895ef", icon: "speed" },
  { sym: "VENOM", c1: "#2d6a4f", c2: "#95d5b2", icon: "fang" },
  { sym: "CHAOS", c1: "#d00000", c2: "#370617", icon: "spiral" },
];

const icons = {
  bolt: `<path d="M130 50 L100 120 L120 120 L90 170 L150 100 L125 100 Z" fill="white" opacity="0.9"/>`,
  fire: `<path d="M120 45 C120 45 145 85 145 115 C145 135 135 155 120 165 C105 155 95 135 95 115 C95 85 120 45 120 45Z M120 80 C110 100 105 115 115 125 C120 130 125 130 130 125 C135 115 130 100 120 80Z" fill="white" opacity="0.9"/>`,
  heart: `<path d="M120 160 C85 130 65 100 75 80 C85 60 105 60 120 80 C135 60 155 60 165 80 C175 100 155 130 120 160Z" fill="white" opacity="0.9"/>`,
  crystal: `<polygon points="120,45 155,100 140,165 100,165 85,100" fill="white" opacity="0.9"/>`,
  rocket: `<path d="M120 45 C120 45 160 80 160 130 L145 150 L120 140 L95 150 L80 130 C80 80 120 45 120 45Z M110 155 L120 170 L130 155" fill="white" opacity="0.9"/>`,
  anvil: `<path d="M80 110 L160 110 L155 130 L145 130 L145 155 L95 155 L95 130 L85 130 Z M100 80 L140 80 L150 110 L90 110Z" fill="white" opacity="0.9"/>`,
  star: `<polygon points="120,45 132,95 185,95 142,125 155,175 120,145 85,175 98,125 55,95 108,95" fill="white" opacity="0.9"/>`,
  wave: `<path d="M55 110 C75 80 95 80 115 110 C135 140 155 140 175 110 L175 130 C155 160 135 160 115 130 C95 100 75 100 55 130Z" fill="white" opacity="0.9"/>`,
  flame: `<path d="M120 45 C90 85 75 110 75 130 C75 155 95 175 120 175 C145 175 165 155 165 130 C165 110 150 85 120 45Z" fill="white" opacity="0.9"/><ellipse cx="120" cy="145" rx="20" ry="25" fill="${"url(#g)"}"/>`,
  peak: `<polygon points="120,50 170,160 70,160" fill="white" opacity="0.9"/><polygon points="120,85 148,160 92,160" fill="black" opacity="0.15"/>`,
  flow: `<path d="M60 90 Q90 60 120 90 Q150 120 180 90 L180 130 Q150 160 120 130 Q90 100 60 130Z" fill="white" opacity="0.9"/>`,
  diamond: `<polygon points="120,45 165,105 120,175 75,105" fill="white" opacity="0.9"/><polygon points="120,45 140,105 120,105" fill="white" opacity="0.6"/><polygon points="120,105 140,105 120,175" fill="white" opacity="0.4"/>`,
  zap: `<polygon points="135,45 100,115 120,115 85,175 155,95 130,95" fill="white" opacity="0.9"/>`,
  rune: `<path d="M100 50 L140 50 L140 80 L120 100 L140 120 L140 170 L100 170 L100 140 L120 120 L100 100 Z" fill="white" opacity="0.9" stroke="white" stroke-width="2"/>`,
  shield: `<path d="M120 45 L165 70 L165 120 C165 150 145 170 120 180 C95 170 75 150 75 120 L75 70Z" fill="white" opacity="0.9"/>`,
  sparkle: `<path d="M120 45 L125 100 L175 105 L125 110 L120 165 L115 110 L65 105 L115 100Z" fill="white" opacity="0.9"/>`,
  ring: `<circle cx="120" cy="110" r="50" fill="none" stroke="white" stroke-width="12" opacity="0.9"/><circle cx="120" cy="110" r="20" fill="white" opacity="0.5"/>`,
  speed: `<path d="M65 90 L175 90 L160 105 L65 105Z M80 115 L175 115 L160 130 L80 130Z M95 140 L175 140 L160 155 L95 155Z" fill="white" opacity="0.9"/>`,
  fang: `<path d="M90 60 L105 140 L120 100 L135 140 L150 60 C170 90 170 130 150 160 L120 175 L90 160 C70 130 70 90 90 60Z" fill="white" opacity="0.9"/>`,
  spiral: `<path d="M120 60 C150 60 170 80 170 110 C170 140 150 160 120 160 C90 160 75 140 80 115 C85 95 100 85 120 90 C135 95 140 110 130 120" fill="none" stroke="white" stroke-width="10" stroke-linecap="round" opacity="0.9"/>`,
};

for (const t of TOKENS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.c1}"/>
      <stop offset="100%" stop-color="${t.c2}"/>
    </linearGradient>
  </defs>
  <rect width="240" height="240" rx="32" fill="url(#g)"/>
  ${icons[t.icon] || icons.star}
  <text x="120" y="210" text-anchor="middle" fill="white" font-size="22" font-weight="bold" font-family="Arial,sans-serif" opacity="0.8">$${t.sym}</text>
</svg>`;

  const file = path.join(OUT, `${t.sym.toLowerCase()}.svg`);
  fs.writeFileSync(file, svg.trim());
  console.log(`  ✅ ${file}`);
}

console.log(`\nGenerated ${TOKENS.length} SVGs in ${OUT}`);
