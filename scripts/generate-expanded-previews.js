const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

function h(seedKey, tokenId) {
  return BigInt(ethers.solidityPackedKeccak256(["string", "uint256"], [seedKey, tokenId]));
}

function pickBackground(seed) {
  const idx = Number(seed % 6n);
  if (idx === 0) return "6ca0dc";
  if (idx === 1) return "8dbfe8";
  if (idx === 2) return "b8d2e8";
  if (idx === 3) return "d0b090";
  if (idx === 4) return "9bb0c8";
  return "7f92a8";
}

function pickSuit(seed) {
  const idx = Number((seed / 97n) % 6n);
  if (idx === 0) return "1f2328";
  if (idx === 1) return "213547";
  if (idx === 2) return "2f3e46";
  if (idx === 3) return "3c4454";
  if (idx === 4) return "4a235a";
  return "263238";
}

function pickTie(seed) {
  const idx = Number((seed / 71n) % 6n);
  if (idx === 0) return "4f8cff";
  if (idx === 1) return "24a148";
  if (idx === 2) return "e53935";
  if (idx === 3) return "f4b400";
  if (idx === 4) return "6f42c1";
  return "00a3a3";
}

function pickSkin(seed) {
  const idx = Number(seed % 5n);
  if (idx === 0) return "f1c27d";
  if (idx === 1) return "d63f36";
  if (idx === 2) return "63b35f";
  if (idx === 3) return "a7b0ba";
  return "faf8f4";
}

function pickEye(seed) {
  const idx = Number((seed / 131n) % 8n);
  if (idx === 0) return "2b3fd1";
  if (idx === 1) return "4b8f29";
  if (idx === 2) return "7d5534";
  if (idx === 3) return "5b6678";
  if (idx === 4) return "1f7a8c";
  if (idx === 5) return "8a4fff";
  if (idx === 6) return "b5651d";
  return "1d3557";
}

function pickHair(seed) {
  const idx = Number((seed / 151n) % 6n);
  if (idx === 0) return "111111";
  if (idx === 1) return "3e2723";
  if (idx === 2) return "5d4037";
  if (idx === 3) return "6d4c41";
  if (idx === 4) return "212121";
  return "7b5e57";
}

function renderHair(seed, hair) {
  const style = Number((seed / 11n) % 4n);
  if (style === 0) return "";
  if (style === 1) {
    return `<rect x="7" y="3" width="10" height="2" fill="#${hair}"/><rect x="6" y="4" width="1" height="9" fill="#${hair}"/><rect x="17" y="4" width="1" height="9" fill="#${hair}"/>`;
  }
  if (style === 2) {
    return `<rect x="6" y="2" width="12" height="4" fill="#${hair}"/><rect x="5" y="4" width="1" height="4" fill="#${hair}"/><rect x="18" y="4" width="1" height="4" fill="#${hair}"/>`;
  }
  return `<rect x="7" y="3" width="10" height="2" fill="#${hair}"/><rect x="6" y="4" width="2" height="8" fill="#${hair}"/>`;
}

function renderAccessory(seed) {
  const acc = Number((seed / 31n) % 4n);
  if (acc === 0) return "";
  if (acc === 1) {
    return '<rect x="8" y="7" width="3" height="2" fill="#101216"/><rect x="13" y="7" width="3" height="2" fill="#101216"/><rect x="11" y="7" width="2" height="1" fill="#3a3f47"/>';
  }
  if (acc === 2) {
    return '<rect x="8" y="7" width="3" height="2" fill="#de2b2b"/><rect x="13" y="7" width="3" height="2" fill="#2b6bff"/><rect x="11" y="7" width="2" height="1" fill="#d3d7de"/>';
  }
  return '<rect x="9" y="2" width="6" height="1" fill="#f2e189"/><rect x="8" y="3" width="8" height="1" fill="#f2e189"/>';
}

function renderSvg(tokenId) {
  const seed = h("STONK_ART_EXPANDED", tokenId);
  const bg = pickBackground(seed);
  const suit = pickSuit(seed);
  const tie = pickTie(seed);
  const skin = pickSkin(seed);
  const eye = pickEye(seed);
  const hair = pickHair(seed);
  const hairSvg = renderHair(seed, hair);
  const accessorySvg = renderAccessory(seed);

  return `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="0 0 24 24" width="720" height="720"><rect width="24" height="24" fill="#${bg}"/><rect x="7" y="4" width="10" height="12" fill="#${skin}"/><rect x="9" y="16" width="6" height="3" fill="#${skin}"/><rect x="8" y="8" width="3" height="2" fill="#f4f4f4"/><rect x="13" y="8" width="3" height="2" fill="#f4f4f4"/><rect x="9" y="8" width="1" height="1" fill="#${eye}"/><rect x="14" y="8" width="1" height="1" fill="#${eye}"/><rect x="10" y="13" width="4" height="1" fill="#101010"/>${hairSvg}${accessorySvg}<rect x="4" y="18" width="16" height="6" fill="#${suit}"/><rect x="10" y="18" width="4" height="2" fill="#f0f0f0"/><rect x="11" y="19" width="2" height="5" fill="#${tie}"/><rect x="11" y="23" width="2" height="1" fill="#${tie}"/><rect x="10" y="23" width="1" height="1" fill="#151515"/><rect x="13" y="23" width="1" height="1" fill="#151515"/></svg>`;
}

function main() {
  const idsRaw = process.env.TOKEN_IDS || "445,512,777,1337,2024,4444";
  const ids = idsRaw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 445 && n <= 4444);

  if (!ids.length) {
    throw new Error("Provide TOKEN_IDS between 445 and 4444.");
  }

  const outDir = path.resolve(process.cwd(), "previews-expanded");
  fs.mkdirSync(outDir, { recursive: true });

  for (const tokenId of ids) {
    const file = path.join(outDir, `stonk-broker-${tokenId}.svg`);
    fs.writeFileSync(file, renderSvg(tokenId), "utf8");
    console.log(file);
  }
}

main();
