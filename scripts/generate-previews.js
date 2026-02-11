const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

function pickColor(tokenId, layer) {
  const palette = Number(
    BigInt(hre.ethers.solidityPackedKeccak256(["uint256", "uint256"], [tokenId, layer])) % 6n
  );

  if (layer === 0) {
    if (palette === 0) return "4f8cff";
    if (palette === 1) return "24a148";
    if (palette === 2) return "e53935";
    if (palette === 3) return "f4b400";
    if (palette === 4) return "6f42c1";
    return "00a3a3";
  }
  if (layer === 1) {
    if (palette === 0) return "1f2328";
    if (palette === 1) return "213547";
    if (palette === 2) return "2f3e46";
    if (palette === 3) return "3c4454";
    if (palette === 4) return "4a235a";
    return "263238";
  }
  if (layer === 2) {
    if (palette === 0) return "f1c27d";
    if (palette === 1) return "e0ac69";
    if (palette === 2) return "c68642";
    if (palette === 3) return "8d5524";
    if (palette === 4) return "ffdbac";
    return "d9a066";
  }
  if (palette === 0) return "111111";
  if (palette === 1) return "3e2723";
  if (palette === 2) return "5d4037";
  if (palette === 3) return "6d4c41";
  if (palette === 4) return "212121";
  return "7b5e57";
}

function pickBackground(tokenId) {
  const idx = Number(
    BigInt(hre.ethers.solidityPackedKeccak256(["string", "uint256"], ["STONK_BG", tokenId])) % 5n
  );
  if (idx === 0) return "6ca0dc";
  if (idx === 1) return "8dbfe8";
  if (idx === 2) return "b8d2e8";
  if (idx === 3) return "d0b090";
  return "9bb0c8";
}

function pickEyeColor(tokenId) {
  const palette = Number(
    BigInt(hre.ethers.solidityPackedKeccak256(["string", "uint256"], ["STONK_EYE_COLOR", tokenId])) % 8n
  );
  if (palette === 0) return "2b3fd1";
  if (palette === 1) return "4b8f29";
  if (palette === 2) return "7d5534";
  if (palette === 3) return "5b6678";
  if (palette === 4) return "1f7a8c";
  if (palette === 5) return "8a4fff";
  if (palette === 6) return "b5651d";
  return "1d3557";
}

function stockGrant(tokenId) {
  const seed = BigInt(
    hre.ethers.solidityPackedKeccak256(["string", "uint256"], ["STONK_BROKERS", tokenId])
  );
  const wholeTokens = (seed % 991n) + 10n;
  return wholeTokens;
}

function renderHair(tokenId, hair) {
  const style = Number(
    BigInt(hre.ethers.solidityPackedKeccak256(["string", "uint256"], ["STONK_HAIR_STYLE", tokenId])) % 6n
  );
  if (style === 0) {
    return `<rect x="7" y="3" width="10" height="2" fill="#${hair}"/><rect x="6" y="4" width="1" height="10" fill="#${hair}"/><rect x="17" y="4" width="1" height="10" fill="#${hair}"/><rect x="6" y="10" width="2" height="7" fill="#${hair}"/>`;
  }
  if (style === 1) {
    return `<rect x="7" y="3" width="10" height="2" fill="#${hair}"/><rect x="6" y="4" width="1" height="8" fill="#${hair}"/><rect x="17" y="4" width="1" height="11" fill="#${hair}"/><rect x="15" y="3" width="2" height="1" fill="#${hair}"/>`;
  }
  if (style === 2) {
    return `<rect x="6" y="3" width="12" height="3" fill="#${hair}"/><rect x="6" y="4" width="1" height="9" fill="#${hair}"/><rect x="17" y="4" width="1" height="9" fill="#${hair}"/>`;
  }
  if (style === 3) {
    return `<rect x="8" y="3" width="8" height="2" fill="#${hair}"/><rect x="7" y="4" width="1" height="6" fill="#${hair}"/><rect x="16" y="4" width="1" height="6" fill="#${hair}"/>`;
  }
  if (style === 4) {
    return `<rect x="7" y="3" width="10" height="2" fill="#${hair}"/><rect x="6" y="4" width="1" height="10" fill="#${hair}"/><rect x="17" y="4" width="1" height="10" fill="#${hair}"/><rect x="8" y="5" width="1" height="2" fill="#${hair}"/><rect x="14" y="5" width="1" height="2" fill="#${hair}"/>`;
  }
  return `<rect x="7" y="2" width="10" height="3" fill="#${hair}"/><rect x="6" y="4" width="1" height="11" fill="#${hair}"/><rect x="17" y="4" width="1" height="11" fill="#${hair}"/>`;
}

function renderIdSignature(tokenId) {
  let sig = "";
  for (let i = 0; i < 9; i++) {
    if (((tokenId >> i) & 1) === 1) {
      sig += `<rect x="${10 + i}" y="23" width="1" height="1" fill="#171717"/>`;
    }
  }
  return sig;
}

function oneOfOneIndex(tokenId) {
  const special = [7, 19, 33, 47, 58, 72, 88, 101, 117, 133, 149, 166, 188, 207, 233, 259, 301, 337, 389, 444];
  const idx = special.indexOf(tokenId);
  return idx === -1 ? 0 : idx + 1;
}

function oneOfOneSuitColor(index) {
  if (index % 4 === 0) return "1f1f1f";
  if (index % 4 === 1) return "7a6220";
  if (index % 4 === 2) return "4f3f14";
  return "9b7a2e";
}

function oneOfOneTieColor(index) {
  if (index % 3 === 0) return "f5d36b";
  if (index % 3 === 1) return "ffe08a";
  return "e9bf52";
}

function oneOfOneBackground(index) {
  if (index % 5 === 0) return "5e7aa8";
  if (index % 5 === 1) return "7b95c0";
  if (index % 5 === 2) return "8aa6cf";
  if (index % 5 === 3) return "a4bde0";
  return "738ab1";
}

function oneOfOneSkinColor(index) {
  if (index % 3 === 0) return "f6d26a";
  if (index % 3 === 1) return "e8c15a";
  return "d9ad47";
}

function oneOfOneFaceOverlay(index) {
  if (index === 0) return "";
  return '<rect x="7" y="7" width="10" height="3" fill="#101216"/><rect x="8" y="8" width="3" height="1" fill="#1b1f26"/><rect x="13" y="8" width="3" height="1" fill="#1b1f26"/><rect x="11" y="8" width="2" height="1" fill="#0f1115"/><rect x="9" y="8" width="1" height="2" fill="#59d37b"/><rect x="8" y="9" width="3" height="1" fill="#86efac"/><rect x="14" y="8" width="1" height="2" fill="#59d37b"/><rect x="13" y="9" width="3" height="1" fill="#86efac"/>';
}

function renderSvg(tokenId) {
  const specialIdx = oneOfOneIndex(tokenId);
  const tie = specialIdx === 0 ? pickColor(tokenId, 0) : oneOfOneTieColor(specialIdx);
  const suit = specialIdx === 0 ? pickColor(tokenId, 1) : oneOfOneSuitColor(specialIdx);
  const skin = specialIdx === 0 ? pickColor(tokenId, 2) : oneOfOneSkinColor(specialIdx);
  const hair = pickColor(tokenId, 3);
  const eye = specialIdx === 0 ? pickEyeColor(tokenId) : "7cf08a";
  const bg = specialIdx === 0 ? pickBackground(tokenId) : oneOfOneBackground(specialIdx);
  const hairSvg = renderHair(tokenId, hair);
  const signature = renderIdSignature(tokenId);
  const specialFaceOverlay = oneOfOneFaceOverlay(specialIdx);
  const traitSeed = BigInt(
    hre.ethers.solidityPackedKeccak256(["string", "uint256"], ["STONK_BROKER_TRAITS", tokenId])
  );

  const hasRimlessGlasses = specialIdx === 0 && traitSeed % 3n === 0n;
  const hasHeadset = specialIdx === 0 && (traitSeed / 7n) % 4n === 0n;
  const hasEarpiece = specialIdx === 0 && (traitSeed / 11n) % 4n === 0n;
  const mouthStyle = Number((traitSeed / 13n) % 5n);
  const hasTieClip = specialIdx === 0 && (traitSeed / 19n) % 2n === 0n;
  const hasLapelPin = specialIdx === 0 && (traitSeed / 23n) % 3n === 0n;

  const glasses = hasRimlessGlasses
    ? '<rect x="8" y="7" width="3" height="3" fill="none" stroke="#d8e1ea" stroke-width="0.4"/><rect x="13" y="7" width="3" height="3" fill="none" stroke="#d8e1ea" stroke-width="0.4"/><rect x="11" y="8" width="2" height="1" fill="#d8e1ea"/>'
    : "";
  const headset = hasHeadset
    ? '<rect x="5" y="8" width="2" height="3" fill="#7f8ea3"/><rect x="5" y="7" width="3" height="1" fill="#cfd8e3"/><rect x="6" y="10" width="1" height="2" fill="#cfd8e3"/><rect x="6" y="11" width="3" height="1" fill="#cfd8e3"/><rect x="9" y="11" width="1" height="1" fill="#7f8ea3"/>'
    : "";
  const earpiece = hasEarpiece ? '<rect x="17" y="10" width="1" height="1" fill="#8fb8ff"/>' : "";
  const mouth =
    mouthStyle === 0
      ? '<rect x="10" y="13" width="4" height="1" fill="#101010"/>'
      : mouthStyle === 1
        ? '<rect x="10" y="13" width="4" height="1" fill="#101010"/><rect x="11" y="14" width="2" height="1" fill="#101010"/>'
        : mouthStyle === 2
          ? '<rect x="10" y="13" width="4" height="1" fill="#101010"/><rect x="11" y="12" width="2" height="1" fill="#101010"/>'
          : mouthStyle === 3
            ? '<rect x="10" y="13" width="4" height="1" fill="#101010"/>'
            : '<rect x="11" y="13" width="2" height="2" fill="#101010"/>';
  const tieClip = hasTieClip ? '<rect x="11" y="20" width="2" height="1" fill="#d8d8d8"/>' : "";
  const lapelPin = hasLapelPin ? '<rect x="15" y="20" width="1" height="1" fill="#f2c94c"/>' : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="0 0 24 24" width="720" height="720"><rect width="24" height="24" fill="#${bg}"/>${signature}<rect x="7" y="4" width="10" height="12" fill="#${skin}"/><rect x="9" y="16" width="6" height="3" fill="#${skin}"/>${hairSvg}<rect x="8" y="8" width="3" height="2" fill="#f4f4f4"/><rect x="13" y="8" width="3" height="2" fill="#f4f4f4"/><rect x="9" y="8" width="1" height="1" fill="#${eye}"/><rect x="14" y="8" width="1" height="1" fill="#${eye}"/><rect x="11" y="10" width="2" height="2" fill="#ba9a95"/>${specialFaceOverlay}${mouth}<rect x="4" y="18" width="16" height="6" fill="#${suit}"/><rect x="8" y="18" width="8" height="4" fill="#${suit}"/><rect x="10" y="18" width="4" height="2" fill="#f0f0f0"/><rect x="11" y="19" width="2" height="5" fill="#${tie}"/><rect x="11" y="23" width="2" height="1" fill="#${tie}"/><rect x="3" y="19" width="1" height="5" fill="#000"/><rect x="20" y="19" width="1" height="5" fill="#000"/>${glasses}${headset}${earpiece}${tieClip}${lapelPin}</svg>`;
}

function writePreview(tokenId, outDir) {
  const svg = renderSvg(tokenId);
  const grant = stockGrant(tokenId);
  const file = path.join(outDir, `stonk-broker-${tokenId}.svg`);
  fs.writeFileSync(file, svg, "utf8");
  return { file, grant };
}

async function main() {
  const tokenId = Number(process.env.TOKEN_ID || "1");
  const generateAll = process.env.GENERATE_ALL === "true";
  const outDir = path.resolve(process.cwd(), "previews");

  fs.mkdirSync(outDir, { recursive: true });

  if (generateAll) {
    for (let i = 1; i <= 444; i++) {
      writePreview(i, outDir);
    }
    console.log(`Generated all 444 previews in ${outDir}`);
    return;
  }

  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 444) {
    throw new Error("TOKEN_ID must be between 1 and 444.");
  }

  const result = writePreview(tokenId, outDir);
  console.log(`Generated preview: ${result.file}`);
  console.log(`Token #${tokenId} initial RHOOD grant (whole tokens): ${result.grant.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
