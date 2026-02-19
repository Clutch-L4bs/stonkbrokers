const fs = require("fs");
const path = require("path");
const OUT = path.resolve(__dirname, "../apps/web/public/tokens");
fs.mkdirSync(OUT, { recursive: true });

const TOKENS = [
  { sym: "APEX",   style: "hexGrid",    c1: "#ff3cac", c2: "#784ba0", c3: "#2b86c5" },
  { sym: "COMET",  style: "comet",      c1: "#ffd700", c2: "#ff6b00", c3: "#1a1a2e" },
  { sym: "DUSK",   style: "sunset",     c1: "#2c3e50", c2: "#e74c3c", c3: "#f39c12" },
  { sym: "ECHO2",  style: "rings",      c1: "#00d2ff", c2: "#3a7bd5", c3: "#0a0a23" },
  { sym: "FURY",   style: "slash",      c1: "#dc143c", c2: "#ff4500", c3: "#000000" },
  { sym: "GLYPH",  style: "glyph",      c1: "#8e44ad", c2: "#3498db", c3: "#ecf0f1" },
  { sym: "HAZE",   style: "smoke",      c1: "#667eea", c2: "#764ba2", c3: "#f093fb" },
  { sym: "ION",    style: "atom",       c1: "#00f260", c2: "#0575e6", c3: "#021b79" },
  { sym: "JADE",   style: "gem",        c1: "#11998e", c2: "#38ef7d", c3: "#0d3b2e" },
  { sym: "KRYPTO", style: "lock",       c1: "#f7971e", c2: "#ffd200", c3: "#1a1a1a" },
  { sym: "LYNX",   style: "claw",       c1: "#fc4a1a", c2: "#f7b733", c3: "#2c2c2c" },
  { sym: "MYST",   style: "eye",        c1: "#6441a5", c2: "#2a0845", c3: "#eaafc8" },
  { sym: "NEXUS",  style: "grid",       c1: "#00b4db", c2: "#0083b0", c3: "#e0e0e0" },
  { sym: "OMEGA",  style: "omega",      c1: "#c31432", c2: "#240b36", c3: "#f5f5f5" },
  { sym: "PYRO",   style: "blaze",      c1: "#ff512f", c2: "#f09819", c3: "#dd2476" },
  { sym: "QUAKE",  style: "crack",      c1: "#355c7d", c2: "#6c5b7b", c3: "#c06c84" },
  { sym: "RIFT",   style: "portal",     c1: "#a855f7", c2: "#ec4899", c3: "#0f172a" },
  { sym: "SHARD",  style: "shatter",    c1: "#43cea2", c2: "#185a9d", c3: "#ffffff" },
  { sym: "THORR",  style: "hammer",     c1: "#4a00e0", c2: "#8e2de2", c3: "#ffd700" },
  { sym: "ULTRA",  style: "burst",      c1: "#f12711", c2: "#f5af19", c3: "#000428" },
];

const styles = {
  hexGrid: (c1, c2, c3) => `
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/></linearGradient></defs>
    <rect width="240" height="240" rx="32" fill="url(#g)"/>
    <g opacity="0.15" stroke="white" stroke-width="1.5" fill="none">
      ${[0,1,2,3,4].map(r => [0,1,2].map(c => {
        const x = 40 + c * 60 + (r % 2) * 30;
        const y = 30 + r * 45;
        return `<polygon points="${x},${y-20} ${x+17},${y-10} ${x+17},${y+10} ${x},${y+20} ${x-17},${y+10} ${x-17},${y-10}"/>`;
      }).join("")).join("")}
    </g>
    <polygon points="120,55 155,75 155,115 120,135 85,115 85,75" fill="white" opacity="0.9" stroke="white" stroke-width="2"/>
    <polygon points="120,70 142,82 142,108 120,120 98,108 98,82" fill="${c2}" opacity="0.7"/>`,

  comet: (c1, c2, c3) => `
    <rect width="240" height="240" rx="32" fill="${c3}"/>
    <defs><radialGradient id="g" cx="65%" cy="35%" r="60%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="155" cy="85" r="100" fill="url(#g)" opacity="0.4"/>
    <circle cx="155" cy="85" r="25" fill="${c1}"/>
    <circle cx="155" cy="85" r="15" fill="white" opacity="0.8"/>
    <path d="M155 85 Q120 90 60 130 Q80 110 130 88Z" fill="${c1}" opacity="0.6"/>
    <path d="M155 85 Q130 100 70 155 Q90 130 140 95Z" fill="${c2}" opacity="0.4"/>`,

  sunset: (c1, c2, c3) => `
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="40%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/></linearGradient></defs>
    <rect width="240" height="240" rx="32" fill="url(#g)"/>
    <circle cx="120" cy="120" r="35" fill="${c3}" opacity="0.9"/>
    <circle cx="120" cy="120" r="25" fill="white" opacity="0.3"/>
    <path d="M0 150 Q60 130 120 140 Q180 150 240 135 L240 240 L0 240Z" fill="${c1}" opacity="0.3"/>
    <path d="M0 170 Q60 155 120 165 Q180 175 240 160 L240 240 L0 240Z" fill="${c1}" opacity="0.4"/>`,

  rings: (c1, c2, c3) => `
    <rect width="240" height="240" rx="32" fill="${c3}"/>
    <circle cx="120" cy="105" r="55" fill="none" stroke="${c1}" stroke-width="5" opacity="0.8"/>
    <circle cx="120" cy="105" r="40" fill="none" stroke="${c2}" stroke-width="4" opacity="0.6"/>
    <circle cx="120" cy="105" r="25" fill="none" stroke="${c1}" stroke-width="3" opacity="0.9"/>
    <circle cx="120" cy="105" r="10" fill="${c1}"/>
    <circle cx="120" cy="105" r="5" fill="white"/>`,

  slash: (c1, c2, c3) => `
    <rect width="240" height="240" rx="32" fill="${c3}"/>
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <path d="M80 40 L170 200 L160 200 L70 40Z" fill="url(#g)"/>
    <path d="M100 40 L190 200 L180 200 L90 40Z" fill="url(#g)" opacity="0.7"/>
    <path d="M60 40 L150 200 L140 200 L50 40Z" fill="url(#g)" opacity="0.5"/>`,

  glyph: (c1, c2, c3) => `
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <rect width="240" height="240" rx="32" fill="url(#g)"/>
    <path d="M120 50 L140 80 L170 80 L148 100 L156 130 L120 112 L84 130 L92 100 L70 80 L100 80Z" fill="${c3}" opacity="0.9"/>
    <circle cx="120" cy="95" r="12" fill="${c1}"/>
    <path d="M95 140 L120 155 L145 140 L145 170 L120 185 L95 170Z" fill="${c3}" opacity="0.7"/>`,

  smoke: (c1, c2, c3) => `
    <defs>
      <radialGradient id="g1" cx="30%" cy="40%" r="50%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c1}" stop-opacity="0"/></radialGradient>
      <radialGradient id="g2" cx="70%" cy="60%" r="50%"><stop offset="0%" stop-color="${c2}"/><stop offset="100%" stop-color="${c2}" stop-opacity="0"/></radialGradient>
      <radialGradient id="g3" cx="50%" cy="30%" r="40%"><stop offset="0%" stop-color="${c3}"/><stop offset="100%" stop-color="${c3}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="240" height="240" rx="32" fill="#0a0a1a"/>
    <circle cx="80" cy="100" r="100" fill="url(#g1)" opacity="0.7"/>
    <circle cx="170" cy="140" r="100" fill="url(#g2)" opacity="0.7"/>
    <circle cx="120" cy="70" r="80" fill="url(#g3)" opacity="0.5"/>
    <text x="120" y="130" text-anchor="middle" fill="white" font-size="40" font-weight="bold" font-family="Arial" opacity="0.9">H</text>`,

  atom: (c1, c2, c3) => `
    <rect width="240" height="240" rx="32" fill="${c3}"/>
    <circle cx="120" cy="110" r="12" fill="${c1}"/>
    <ellipse cx="120" cy="110" rx="55" ry="20" fill="none" stroke="${c1}" stroke-width="2.5" opacity="0.8"/>
    <ellipse cx="120" cy="110" rx="55" ry="20" fill="none" stroke="${c2}" stroke-width="2.5" opacity="0.8" transform="rotate(60 120 110)"/>
    <ellipse cx="120" cy="110" rx="55" ry="20" fill="none" stroke="${c1}" stroke-width="2.5" opacity="0.8" transform="rotate(-60 120 110)"/>
    <circle cx="120" cy="110" r="6" fill="white"/>`,

  gem: (c1, c2, c3) => `
    <rect width="240" height="240" rx="32" fill="${c3}"/>
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <polygon points="120,45 165,90 150,170 90,170 75,90" fill="url(#g)" opacity="0.95"/>
    <polygon points="120,45 142,90 120,90" fill="white" opacity="0.3"/>
    <polygon points="120,90 142,90 150,170 120,170" fill="white" opacity="0.15"/>
    <polygon points="75,90 120,90 90,170" fill="white" opacity="0.1"/>`,

  lock: (c1, c2, c3) => `
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <rect width="240" height="240" rx="32" fill="url(#g)"/>
    <rect x="85" y="95" width="70" height="65" rx="8" fill="${c3}"/>
    <path d="M95 95 L95 75 Q95 55 120 55 Q145 55 145 75 L145 95" fill="none" stroke="${c3}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="120" cy="122" r="8" fill="${c1}"/>
    <rect x="117" y="127" width="6" height="15" rx="2" fill="${c1}"/>`,

  claw: (c1, c2, c3) => `
    <rect width="240" height="240" rx="32" fill="${c3}"/>
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <path d="M80 50 Q85 100 95 150" stroke="url(#g)" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M110 45 Q115 100 120 160" stroke="url(#g)" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M140 50 Q145 100 155 150" stroke="url(#g)" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M170 60 Q170 110 175 140" stroke="url(#g)" stroke-width="10" fill="none" stroke-linecap="round"/>`,

  eye: (c1, c2, c3) => `
    <defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${c3}"/><stop offset="50%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></radialGradient></defs>
    <rect width="240" height="240" rx="32" fill="${c2}"/>
    <path d="M30 110 Q120 40 210 110 Q120 180 30 110Z" fill="${c1}" opacity="0.8"/>
    <circle cx="120" cy="110" r="35" fill="url(#g)"/>
    <circle cx="120" cy="110" r="15" fill="black"/>
    <circle cx="127" cy="103" r="6" fill="white" opacity="0.7"/>`,

  grid: (c1, c2, c3) => `
    <rect width="240" height="240" rx="32" fill="#0a1628"/>
    <g stroke="${c1}" stroke-width="0.5" opacity="0.3">
      ${Array.from({length: 12}, (_, i) => `<line x1="${20+i*18}" y1="20" x2="${20+i*18}" y2="220"/>`).join("")}
      ${Array.from({length: 12}, (_, i) => `<line x1="20" y1="${20+i*18}" x2="220" y2="${20+i*18}"/>`).join("")}
    </g>
    <path d="M60 160 L80 140 L100 150 L120 100 L140 110 L160 70 L180 80" fill="none" stroke="${c1}" stroke-width="3"/>
    <circle cx="120" cy="100" r="4" fill="${c1}"/><circle cx="160" cy="70" r="4" fill="${c1}"/>`,

  omega: (c1, c2, c3) => `
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <rect width="240" height="240" rx="32" fill="url(#g)"/>
    <path d="M80 150 Q80 70 120 60 Q160 70 160 150" fill="none" stroke="${c3}" stroke-width="10" stroke-linecap="round"/>
    <line x1="70" y1="150" x2="95" y2="150" stroke="${c3}" stroke-width="10" stroke-linecap="round"/>
    <line x1="145" y1="150" x2="170" y2="150" stroke="${c3}" stroke-width="10" stroke-linecap="round"/>`,

  blaze: (c1, c2, c3) => `
    <rect width="240" height="240" rx="32" fill="#1a0a00"/>
    <defs>
      <radialGradient id="g" cx="50%" cy="80%" r="60%"><stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c1}" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="120" cy="180" rx="80" ry="40" fill="url(#g)" opacity="0.5"/>
    <path d="M120 40 C90 80 75 110 80 140 C85 160 100 170 120 175 C140 170 155 160 160 140 C165 110 150 80 120 40Z" fill="${c1}" opacity="0.9"/>
    <path d="M120 70 C105 95 95 115 105 135 C110 145 115 148 120 150 C125 148 130 145 135 135 C145 115 135 95 120 70Z" fill="${c2}"/>
    <path d="M120 95 C112 110 108 125 115 135 C118 138 120 140 122 138 C128 130 125 115 120 95Z" fill="white" opacity="0.7"/>`,

  crack: (c1, c2, c3) => `
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/></linearGradient></defs>
    <rect width="240" height="240" rx="32" fill="url(#g)"/>
    <path d="M120 30 L115 70 L95 90 L105 120 L85 150 L100 170 L90 210" stroke="white" stroke-width="4" fill="none" opacity="0.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M115 70 L140 80" stroke="white" stroke-width="3" fill="none" opacity="0.6"/>
    <path d="M105 120 L130 115" stroke="white" stroke-width="3" fill="none" opacity="0.6"/>
    <path d="M85 150 L65 155" stroke="white" stroke-width="3" fill="none" opacity="0.6"/>`,

  portal: (c1, c2, c3) => `
    <rect width="240" height="240" rx="32" fill="${c3}"/>
    <defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="white" stop-opacity="0.8"/><stop offset="30%" stop-color="${c1}"/><stop offset="70%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/></radialGradient></defs>
    <circle cx="120" cy="105" r="55" fill="url(#g)"/>
    <circle cx="120" cy="105" r="40" fill="${c3}" opacity="0.3"/>
    <circle cx="120" cy="105" r="20" fill="white" opacity="0.15"/>
    ${[0,45,90,135,180,225,270,315].map(a => {
      const r = a * Math.PI / 180;
      return `<circle cx="${120+65*Math.cos(r)}" cy="${105+65*Math.sin(r)}" r="3" fill="${c1}" opacity="0.7"/>`;
    }).join("")}`,

  shatter: (c1, c2, c3) => `
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <rect width="240" height="240" rx="32" fill="url(#g)"/>
    <polygon points="120,50 160,75 170,120 140,160 100,160 70,120 80,75" fill="${c3}" opacity="0.9"/>
    <line x1="120" y1="50" x2="120" y2="110" stroke="${c1}" stroke-width="1.5" opacity="0.5"/>
    <line x1="160" y1="75" x2="120" y2="110" stroke="${c1}" stroke-width="1.5" opacity="0.5"/>
    <line x1="170" y1="120" x2="120" y2="110" stroke="${c1}" stroke-width="1.5" opacity="0.5"/>
    <line x1="140" y1="160" x2="120" y2="110" stroke="${c1}" stroke-width="1.5" opacity="0.5"/>
    <line x1="100" y1="160" x2="120" y2="110" stroke="${c1}" stroke-width="1.5" opacity="0.5"/>
    <line x1="70" y1="120" x2="120" y2="110" stroke="${c1}" stroke-width="1.5" opacity="0.5"/>
    <line x1="80" y1="75" x2="120" y2="110" stroke="${c1}" stroke-width="1.5" opacity="0.5"/>
    <circle cx="120" cy="110" r="6" fill="${c2}" opacity="0.8"/>`,

  hammer: (c1, c2, c3) => `
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <rect width="240" height="240" rx="32" fill="url(#g)"/>
    <rect x="112" y="65" width="16" height="100" rx="3" fill="${c3}" opacity="0.9"/>
    <rect x="80" y="55" width="80" height="30" rx="6" fill="${c3}" opacity="0.9"/>
    <path d="M120 165 L100 190 L140 190Z" fill="${c3}" opacity="0.6"/>`,

  burst: (c1, c2, c3) => `
    <rect width="240" height="240" rx="32" fill="${c3}"/>
    <defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c1}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="120" cy="110" r="80" fill="url(#g)" opacity="0.6"/>
    ${[0,30,60,90,120,150,180,210,240,270,300,330].map(a => {
      const r = a * Math.PI / 180;
      const x1 = 120 + 25 * Math.cos(r), y1 = 110 + 25 * Math.sin(r);
      const x2 = 120 + 65 * Math.cos(r), y2 = 110 + 65 * Math.sin(r);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${a%60===0?'white':c2}" stroke-width="${a%60===0?3:1.5}" opacity="${a%60===0?0.9:0.5}"/>`;
    }).join("")}
    <circle cx="120" cy="110" r="20" fill="${c1}"/>
    <circle cx="120" cy="110" r="10" fill="white" opacity="0.8"/>`,
};

for (const t of TOKENS) {
  const fn = styles[t.style];
  if (!fn) { console.log(`  ⚠️  No style: ${t.style}`); continue; }
  const inner = fn(t.c1, t.c2, t.c3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
${inner}
  <text x="120" y="212" text-anchor="middle" fill="white" font-size="20" font-weight="bold" font-family="Arial,sans-serif" opacity="0.85">$${t.sym}</text>
</svg>`;
  const file = path.join(OUT, `${t.sym.toLowerCase()}.svg`);
  fs.writeFileSync(file, svg.trim());
  console.log(`  ✅ ${t.sym.padEnd(8)} → ${file}`);
}
console.log(`\nGenerated ${TOKENS.length} SVGs`);
