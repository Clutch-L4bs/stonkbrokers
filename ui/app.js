(function () {
  const { ethers } = window;
  const cfg = window.STONK_CONFIG;

  if (!cfg) {
    throw new Error("Missing config.js. Copy ui/config.example.js to ui/config.js and fill addresses.");
  }

  /* ── ABI ─────────────────────────────────────────── */
  const nftAbi = [
    "function MINT_PRICE() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function MAX_SUPPLY() view returns (uint256)",
    "function mint(uint256 quantity) payable",
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function tokenWallet(uint256 tokenId) view returns (address)",
    "function fundedToken(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string memory)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function isApprovedForAll(address owner,address operator) view returns (bool)",
    "function approve(address to,uint256 tokenId)",
  ];
  const erc20Abi = ["function balanceOf(address account) view returns (uint256)"];
  const faucetAbi = [
    "function claim()",
    "function canClaim(address user) view returns (bool)",
    "function nextClaimTime(address user) view returns (uint256)",
    "function claimAmountWei() view returns (uint256)",
  ];
  const marketplaceAbi = [
    "function nextListingId() view returns (uint256)",
    "function nextSwapId() view returns (uint256)",
    "function listings(uint256) view returns (uint256 id,address seller,address nft,uint256 tokenId,uint8 kind,address paymentToken,uint256 price,bool active)",
    "function swaps(uint256) view returns (uint256 id,address maker,address offeredNft,uint256 offeredTokenId,address requestedNft,uint256 requestedTokenId,bool active)",
    "function createEthListing(address nft,uint256 tokenId,uint256 price) returns (uint256)",
    "function createTokenListing(address nft,uint256 tokenId,address paymentToken,uint256 price) returns (uint256)",
    "function cancelListing(uint256 listingId)",
    "function buyWithEth(uint256 listingId) payable",
    "function buyWithToken(uint256 listingId)",
    "function createSwapOffer(address offeredNft,uint256 offeredTokenId,address requestedNft,uint256 requestedTokenId) returns (uint256)",
    "function cancelSwapOffer(uint256 swapId)",
    "function acceptSwapOffer(uint256 swapId)",
  ];

  /* ── DOM refs ────────────────────────────────────── */
  const connectBtn = document.getElementById("connectBtn");
  const switchBtn = document.getElementById("switchBtn");
  const faucetClaimBtn = document.getElementById("faucetClaimBtn");
  const mintBtn = document.getElementById("mintBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const faucetLink = document.getElementById("faucetLink");
  const contractLink = document.getElementById("contractLink");
  const contractAddr = document.getElementById("contractAddr");
  const qtyInput = document.getElementById("qty");
  const qtyMinus = document.getElementById("qtyMinus");
  const qtyPlus = document.getElementById("qtyPlus");
  const walletLabel = document.getElementById("walletLabel");
  const netDot = document.getElementById("netDot");
  const connectStatus = document.getElementById("connectStatus");
  const faucetStatus = document.getElementById("faucetStatus");
  const mintInfo = document.getElementById("mintInfo");
  const mintStatus = document.getElementById("mintStatus");
  const tokenList = document.getElementById("tokenList");
  const bgCollage = document.getElementById("bgCollage");
  const supplyText = document.getElementById("supplyText");
  const supplyFill = document.getElementById("supplyFill");
  const heroPreviewImg = document.getElementById("heroPreviewImg");
  const appLoader = document.getElementById("appLoader");
  const nftModalBackdrop = document.getElementById("nftModalBackdrop");
  const nftModalClose = document.getElementById("nftModalClose");
  const nftModalImage = document.getElementById("nftModalImage");
  const nftModalTokenId = document.getElementById("nftModalTokenId");
  const nftModalFundedToken = document.getElementById("nftModalFundedToken");
  const nftModalBalance = document.getElementById("nftModalBalance");
  const nftModalWallet = document.getElementById("nftModalWallet");
  const nftModalShareX = document.getElementById("nftModalShareX");
  const nftModalCopyImage = document.getElementById("nftModalCopyImage");
  const nftModalDownloadImage = document.getElementById("nftModalDownloadImage");
  const nftModalWalletLink = document.getElementById("nftModalWalletLink");
  const nftModalShareHint = document.getElementById("nftModalShareHint");
  const nftModalRecipient = document.getElementById("nftModalRecipient");
  const nftModalAmount = document.getElementById("nftModalAmount");
  const nftModalSend = document.getElementById("nftModalSend");
  const nftModalSendStatus = document.getElementById("nftModalSendStatus");
  const marketListCollection = document.getElementById("marketListCollection");
  const marketListTokenId = document.getElementById("marketListTokenId");
  const marketListType = document.getElementById("marketListType");
  const marketPaymentTokenField = document.getElementById("marketPaymentTokenField");
  const marketListPaymentToken = document.getElementById("marketListPaymentToken");
  const marketListPrice = document.getElementById("marketListPrice");
  const marketCreateListingBtn = document.getElementById("marketCreateListingBtn");
  const marketCreateStatus = document.getElementById("marketCreateStatus");
  const marketListingId = document.getElementById("marketListingId");
  const marketLoadListingBtn = document.getElementById("marketLoadListingBtn");
  const marketListingPreview = document.getElementById("marketListingPreview");
  const marketBuyListingBtn = document.getElementById("marketBuyListingBtn");
  const marketCancelListingBtn = document.getElementById("marketCancelListingBtn");
  const marketListingStatus = document.getElementById("marketListingStatus");
  const marketSwapOfferedCollection = document.getElementById("marketSwapOfferedCollection");
  const marketSwapOfferedTokenId = document.getElementById("marketSwapOfferedTokenId");
  const marketSwapRequestedCollection = document.getElementById("marketSwapRequestedCollection");
  const marketSwapRequestedTokenId = document.getElementById("marketSwapRequestedTokenId");
  const marketCreateSwapBtn = document.getElementById("marketCreateSwapBtn");
  const marketSwapCreateStatus = document.getElementById("marketSwapCreateStatus");
  const marketSwapId = document.getElementById("marketSwapId");
  const marketLoadSwapBtn = document.getElementById("marketLoadSwapBtn");
  const marketSwapPreview = document.getElementById("marketSwapPreview");
  const marketAcceptSwapBtn = document.getElementById("marketAcceptSwapBtn");
  const marketCancelSwapBtn = document.getElementById("marketCancelSwapBtn");
  const marketSwapStatus = document.getElementById("marketSwapStatus");
  const marketRefreshBtn = document.getElementById("marketRefreshBtn");
  const marketFeed = document.getElementById("marketFeed");
  const marketModalBackdrop = document.getElementById("marketModalBackdrop");
  const marketModalClose = document.getElementById("marketModalClose");
  const marketModalImage = document.getElementById("marketModalImage");
  const marketModalType = document.getElementById("marketModalType");
  const marketModalEntryId = document.getElementById("marketModalEntryId");
  const marketModalCollection = document.getElementById("marketModalCollection");
  const marketModalTokenId = document.getElementById("marketModalTokenId");
  const marketModalStatus = document.getElementById("marketModalStatus");
  const marketModalPrice = document.getElementById("marketModalPrice");
  const marketModalOwner = document.getElementById("marketModalOwner");
  const marketModalWallet = document.getElementById("marketModalWallet");
  const marketModalFundedToken = document.getElementById("marketModalFundedToken");
  const marketModalWalletBal = document.getElementById("marketModalWalletBal");
  const marketModalExplorerLink = document.getElementById("marketModalExplorerLink");

  let provider;
  let signer;
  let account;
  let nftRead;
  let nftWrite;
  let originalRead;
  let legacyExpandedRead;
  let faucetRead;
  let faucetWrite;
  let marketRead;
  let marketWrite;
  let walletEventsBound = false;
  let isMinting = false;
  let cachedPrice = null;
  let hasUserInitiatedConnect = false;
  const UI_MAX_MINTS_PER_WALLET = 2;
  let walletRemainingMints = UI_MAX_MINTS_PER_WALLET;
  let selectedNft = null;
  let loadedListing = null;
  let loadedSwap = null;
  let ownedBrokers = [];
  const marketImageCache = new Map();
  const erc20MetaAbi = [
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function allowance(address owner,address spender) view returns (uint256)",
    "function approve(address spender,uint256 amount) returns (bool)",
  ];
  const walletAbi = [
    "function executeTokenTransfer(address token,address to,uint256 amount) returns (bytes memory)",
  ];

  /* ── Token label -> CSS class mapping ────────────── */
  const TOKEN_CLASSES = {
    TSLA: "tsla", AMZN: "amzn", PLTR: "pltr", NFLX: "nflx", AMD: "amd",
  };
  function tokenCssClass(label) {
    return TOKEN_CLASSES[label.toUpperCase()] || "unknown";
  }

  /* ── Helpers ─────────────────────────────────────── */
  function short(addr) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setStatus(el, text, type, allowHtml = false) {
    if (!el) return;
    el.className = "status";
    if (type === "error") el.classList.add("error");
    else if (type === "ok") el.classList.add("ok");
    else if (type === "pending") el.classList.add("pending");
    if (allowHtml) {
      el.innerHTML = text || "";
    } else {
      el.textContent = text || "";
    }
  }

  function setModalSendStatus(text, type) {
    if (!nftModalSendStatus) return;
    nftModalSendStatus.className = "nft-send-status";
    if (type === "error") nftModalSendStatus.classList.add("error");
    else if (type === "ok") nftModalSendStatus.classList.add("ok");
    else if (type === "pending") nftModalSendStatus.classList.add("pending");
    nftModalSendStatus.textContent = text || "";
  }

  function setShareHint(text) {
    if (!nftModalShareHint) return;
    nftModalShareHint.textContent = text || "";
  }

  function setButtonLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.dataset.origLabel = btn.textContent;
      btn.innerHTML = `<span class="spinner"></span>${label || "..."}`;
    } else {
      btn.textContent = btn.dataset.origLabel || btn.textContent;
    }
  }

  function expectedChainHex() {
    return (cfg.chainIdHex || "").toLowerCase();
  }

  function expandedMintAddress() {
    return cfg.expandedNftAddress || cfg.nftAddress;
  }

  function legacyExpandedAddress() {
    return cfg.legacyExpandedNftAddress || "";
  }

  function legacyExpandedLastTokenId() {
    return Number(cfg.legacyExpandedLastTokenId || 0);
  }

  function originalAddress() {
    return cfg.originalNftAddress || "";
  }

  function marketplaceAddress() {
    return cfg.marketplaceAddress || "";
  }

  function collectionAddressByKey(key, tokenId = 0) {
    return key === "original" ? originalAddress() : expandedAddressForTokenId(tokenId);
  }

  function expandedContractForTokenId(tokenId) {
    const id = Number(tokenId || 0);
    const legacyEnd = legacyExpandedLastTokenId();
    if (legacyExpandedAddress() && legacyExpandedRead && legacyEnd > 0 && id > 444 && id <= legacyEnd) {
      return legacyExpandedRead;
    }
    return nftRead;
  }

  function expandedAddressForTokenId(tokenId) {
    const id = Number(tokenId || 0);
    const legacyEnd = legacyExpandedLastTokenId();
    if (legacyExpandedAddress() && legacyEnd > 0 && id > 444 && id <= legacyEnd) {
      return legacyExpandedAddress();
    }
    return expandedMintAddress();
  }

  function expectedChainDecimal() {
    const hex = expectedChainHex();
    return hex ? Number.parseInt(hex, 16) : undefined;
  }

  function faucetUrlSafe() {
    const url = cfg.faucetUrl || "https://faucet.testnet.chain.robinhood.com";
    return url.startsWith("http://") || url.startsWith("https://")
      ? url
      : "https://faucet.testnet.chain.robinhood.com";
  }

  function faucetContractAddress() {
    return cfg.faucetContractAddress || "";
  }

  function formatCooldown(seconds) {
    const s = Math.max(0, Number(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }

  async function getWalletEthBalance() {
    if (!provider || !account) return 0n;
    return provider.getBalance(account);
  }

  function showFaucetPrompt(targetEl, reason) {
    const url = faucetUrlSafe();
    const message = `${reason} <a href="${url}" target="_blank" rel="noreferrer">Get testnet ETH from faucet</a>.`;
    setStatus(targetEl, message, "error", true);
  }

  /* ── Supply bar ──────────────────────────────────── */
  function updateSupplyBar(minted, max) {
    const m = Number(minted);
    const mx = Number(max) || 4444;
    if (supplyText) supplyText.textContent = `${m} / ${mx}`;
    if (supplyFill) supplyFill.style.width = `${Math.min((m / mx) * 100, 100)}%`;
  }

  /* ── Network status dot ──────────────────────────── */
  async function updateNetDot() {
    if (!netDot) return;
    try {
      if (!window.ethereum) { netDot.className = "net-dot"; return; }
      const p = new ethers.BrowserProvider(window.ethereum);
      const net = await p.getNetwork();
      const hex = `0x${net.chainId.toString(16)}`.toLowerCase();
      if (hex === expectedChainHex()) {
        netDot.className = "net-dot ok";
      } else {
        netDot.className = "net-dot wrong";
      }
    } catch (_e) {
      netDot.className = "net-dot";
    }
  }

  function hideLoader() {
    if (!appLoader) return;
    appLoader.classList.add("hidden");
  }

  /* ── Dynamic cost display ────────────────────────── */
  function updateCostDisplay() {
    if (!mintInfo) return;
    const qty = Math.max(1, Math.min(UI_MAX_MINTS_PER_WALLET, Number(qtyInput.value) || 1));
    const limitLabel = `Expanded wallet remaining: ${walletRemainingMints}/${UI_MAX_MINTS_PER_WALLET}`;
    if (cachedPrice) {
      const total = cachedPrice * BigInt(qty);
      const totalEth = ethers.formatEther(total);
      const unitEth = ethers.formatEther(cachedPrice);
      mintInfo.innerHTML = `
        <span>${qty} &times; ${unitEth} ETH =</span>
        <span class="total-cost">${totalEth} ETH</span>
        <span style="color:var(--muted)">Original #1-#444 is minted out</span>
        <span style="color:var(--muted)">${limitLabel}</span>
      `;
    } else {
      mintInfo.innerHTML = `<span style="color:var(--muted)">Connect wallet to see expanded mint price</span><span style="color:var(--muted)">Original #1-#444 is minted out</span><span style="color:var(--muted)">${limitLabel}</span>`;
    }
  }

  function setWalletRemainingFromOwned(ownedCount) {
    walletRemainingMints = Math.max(0, UI_MAX_MINTS_PER_WALLET - Number(ownedCount || 0));
    updateCostDisplay();
  }

  /* ── Network check ───────────────────────────────── */
  async function requireRobinhoodNetwork() {
    await ensureProvider();
    const network = await provider.getNetwork();
    const currentHex = `0x${network.chainId.toString(16)}`.toLowerCase();
    const expected = expectedChainHex();
    if (currentHex !== expected) {
      throw new Error(`Wrong network. Switch wallet to ${cfg.chainName} (${expected}).`);
    }
  }

  /* ── Links ───────────────────────────────────────── */
  function configureLinks() {
    if (faucetLink) {
      faucetLink.href = cfg.faucetUrl || "https://faucet.testnet.chain.robinhood.com";
    }
    if (faucetClaimBtn && !faucetContractAddress()) {
      faucetClaimBtn.disabled = true;
    }
    const mintAddress = expandedMintAddress();
    if (contractLink && contractAddr && mintAddress) {
      const explorer = (cfg.blockExplorerUrl || "").replace(/\/$/, "");
      contractLink.href = explorer ? `${explorer}/address/${mintAddress}` : "#";
      contractAddr.textContent = short(mintAddress);
    }
  }

  /* ── Collage (spread across full 444) ────────────── */
  function renderCollage() {
    if (!bgCollage) return;
    const items = [];
    // Pick 100 evenly spread IDs across 1-444
    for (let i = 0; i < 100; i++) {
      const id = Math.floor((i / 100) * 444) + 1;
      const rotation = ((i * 13) % 7) - 3;
      items.push(
        `<img style="--r:${rotation}deg" src="/previews/stonk-broker-${id}.svg" loading="lazy" alt="" />`
      );
    }
    bgCollage.innerHTML = items.join("");
  }

  /* ── Hero preview rotation ───────────────────────── */
  function rotateHeroPreview() {
    if (!heroPreviewImg) return;
    const ids = [7, 19, 33, 47, 72, 88, 101, 133, 166, 207, 259, 301, 337, 389, 444];
    let idx = 0;
    heroPreviewImg.style.transition = "opacity 0.3s ease";
    setInterval(() => {
      idx = (idx + 1) % ids.length;
      heroPreviewImg.style.opacity = "0";
      setTimeout(() => {
        heroPreviewImg.src = `/previews/stonk-broker-${ids[idx]}.svg`;
        heroPreviewImg.alt = `Stonk Broker #${ids[idx]}`;
        heroPreviewImg.style.opacity = "1";
      }, 300);
    }, 3000);
  }

  /* ── Provider ────────────────────────────────────── */
  async function ensureProvider() {
    if (!window.ethereum) {
      throw new Error("No wallet found. Install MetaMask or another EVM wallet.");
    }
    provider = new ethers.BrowserProvider(window.ethereum);
    const mintAddress = expandedMintAddress();
    if (!mintAddress) {
      throw new Error("Missing expanded NFT contract address in config.");
    }
    nftRead = new ethers.Contract(mintAddress, nftAbi, provider);
    if (originalAddress()) {
      originalRead = new ethers.Contract(originalAddress(), nftAbi, provider);
    }
    if (legacyExpandedAddress()) {
      legacyExpandedRead = new ethers.Contract(legacyExpandedAddress(), nftAbi, provider);
    }
    if (faucetContractAddress()) {
      faucetRead = new ethers.Contract(faucetContractAddress(), faucetAbi, provider);
    }
    if (marketplaceAddress()) {
      marketRead = new ethers.Contract(marketplaceAddress(), marketplaceAbi, provider);
    }
    if (account) {
      try {
        signer = await provider.getSigner(account);
        nftWrite = nftRead.connect(signer);
        if (faucetRead) faucetWrite = faucetRead.connect(signer);
        if (marketRead) marketWrite = marketRead.connect(signer);
      } catch (_err) {
        signer = undefined;
        nftWrite = undefined;
        faucetWrite = undefined;
        marketWrite = undefined;
      }
    }
  }

  async function ensureWritableContract() {
    await ensureProvider();
    if (!account) throw new Error("Connect wallet first.");
    signer = await provider.getSigner(account);
    nftWrite = nftRead.connect(signer);
    if (faucetRead) faucetWrite = faucetRead.connect(signer);
    if (marketRead) marketWrite = marketRead.connect(signer);
    return nftWrite;
  }

  /* ── Wallet ──────────────────────────────────────── */
  async function connectWallet() {
    hasUserInitiatedConnect = true;
    await ensureProvider();
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();
    nftWrite = nftRead.connect(signer);
    walletLabel.innerHTML = `<span class="net-dot ok" id="netDot"></span> ${short(account)}`;
    walletLabel.classList.add("connected");
    setStatus(connectStatus, "");
    await refreshMintInfo();
    await refreshFaucetStatus();
    const ethBalance = await getWalletEthBalance();
    if (ethBalance === 0n) {
      showFaucetPrompt(connectStatus, "No Robinhood testnet ETH detected in your wallet.");
    }
    updateNetDot();
  }

  function bindWalletEvents() {
    if (walletEventsBound || !window.ethereum || !window.ethereum.on) return;
    walletEventsBound = true;

    window.ethereum.on("accountsChanged", async (accounts) => {
      try {
        if (!hasUserInitiatedConnect) {
          // Do not auto-connect from wallet background events; connect only on user action.
          return;
        }
        if (!accounts || accounts.length === 0) {
          account = undefined;
          signer = undefined;
          nftWrite = undefined;
          faucetWrite = undefined;
          setWalletRemainingFromOwned(0);
          walletLabel.innerHTML = `<span class="net-dot" id="netDot"></span> Not connected`;
          walletLabel.classList.remove("connected");
          showEmptyState();
          await refreshFaucetStatus();
          setStatus(connectStatus, "Wallet disconnected.", "pending");
          return;
        }
        account = accounts[0];
        await ensureProvider();
        signer = await provider.getSigner(account);
        nftWrite = nftRead.connect(signer);
        walletLabel.innerHTML = `<span class="net-dot ok" id="netDot"></span> ${short(account)}`;
        walletLabel.classList.add("connected");
        setStatus(connectStatus, "Account changed.", "ok");
        await refreshMintInfo();
        await refreshFaucetStatus();
        await loadOwnedTokens();
      } catch (err) {
        setStatus(connectStatus, err.message || err, "error");
      }
    });

    window.ethereum.on("chainChanged", async () => {
      try {
        if (!hasUserInitiatedConnect) {
          // Ignore wallet-driven chain events until user explicitly connects.
          return;
        }
        await ensureProvider();
        if (account) {
          signer = await provider.getSigner(account);
          nftWrite = nftRead.connect(signer);
        }
        await refreshMintInfo();
        await refreshFaucetStatus();
        if (account) await loadOwnedTokens();
        updateNetDot();
        setStatus(connectStatus, "Network updated.", "ok");
      } catch (err) {
        setStatus(connectStatus, err.message || err, "error");
      }
    });
  }

  async function connectOnRobinhoodNetwork() {
    await switchNetwork();
    await connectWallet();
    await requireRobinhoodNetwork();
  }

  async function switchNetwork() {
    await ensureProvider();
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: expectedChainHex() }],
      });
    } catch (err) {
      if (err && err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: expectedChainHex(),
            chainName: cfg.chainName,
            rpcUrls: [cfg.rpcUrl],
            nativeCurrency: cfg.nativeCurrency,
            blockExplorerUrls: cfg.blockExplorerUrl ? [cfg.blockExplorerUrl] : [],
          }],
        });
      } else {
        throw err;
      }
    }
    updateNetDot();
    setStatus(connectStatus, "Network switched.", "ok");
  }

  /* ── Mint info ───────────────────────────────────── */
  async function refreshMintInfo() {
    try {
      await requireRobinhoodNetwork();
      const reads = [nftRead.MINT_PRICE(), nftRead.totalSupply()];
      if (legacyExpandedRead) reads.push(legacyExpandedRead.totalSupply());
      const [price, expandedSupply, legacySupply = 0n] = await Promise.all(reads);
      cachedPrice = price;
      updateSupplyBar(444 + Number(expandedSupply) + Number(legacySupply), 4444);
      updateCostDisplay();
    } catch (_err) {
      await refreshPublicMintInfo();
    }
  }

  async function refreshPublicMintInfo() {
    try {
      // Read-only RPC fetch so total minted shows before wallet connection.
      const publicProvider = new ethers.JsonRpcProvider(cfg.rpcUrl);
      const publicNft = new ethers.Contract(expandedMintAddress(), nftAbi, publicProvider);
      const reads = [publicNft.MINT_PRICE(), publicNft.totalSupply()];
      if (legacyExpandedAddress()) {
        const publicLegacy = new ethers.Contract(legacyExpandedAddress(), nftAbi, publicProvider);
        reads.push(publicLegacy.totalSupply());
      }
      const [price, expandedSupply, legacySupply = 0n] = await Promise.all(reads);
      cachedPrice = price;
      updateSupplyBar(444 + Number(expandedSupply) + Number(legacySupply), 4444);
    } catch (_error) {
      // Keep UI responsive even if public RPC is temporarily unavailable.
    } finally {
      updateCostDisplay();
    }
  }

  async function refreshFaucetStatus() {
    if (!faucetStatus || !faucetClaimBtn) return;
    const addr = faucetContractAddress();
    if (!addr) {
      faucetClaimBtn.disabled = true;
      setStatus(faucetStatus, "Faucet not configured yet.", "pending");
      return;
    }
    try {
      const readProvider = provider || new ethers.JsonRpcProvider(cfg.rpcUrl);
      const reader = faucetRead || new ethers.Contract(addr, faucetAbi, readProvider);
      const amountWei = cfg.faucetClaimAmountWei
        ? BigInt(cfg.faucetClaimAmountWei)
        : await reader.claimAmountWei();

      if (!account) {
        faucetClaimBtn.disabled = true;
        setStatus(
          faucetStatus,
          `Connect wallet to claim ${ethers.formatEther(amountWei)} ETH (once every 24h).`,
          "pending"
        );
        return;
      }

      const [claimable, nextTime] = await Promise.all([
        reader.canClaim(account),
        reader.nextClaimTime(account),
      ]);
      if (claimable) {
        faucetClaimBtn.disabled = false;
        setStatus(
          faucetStatus,
          `Eligible now: claim ${ethers.formatEther(amountWei)} ETH for minting.`,
          "ok"
        );
      } else {
        faucetClaimBtn.disabled = true;
        const now = Math.floor(Date.now() / 1000);
        const wait = Math.max(0, Number(nextTime) - now);
        setStatus(
          faucetStatus,
          `Next claim in ${formatCooldown(wait)} (one claim per wallet every 24h).`,
          "pending"
        );
      }
    } catch (err) {
      faucetClaimBtn.disabled = true;
      setStatus(faucetStatus, err.message || String(err), "error");
    }
  }

  async function claimFromFaucet() {
    if (!faucetClaimBtn) return;
    try {
      await ensureWritableContract();
      await requireRobinhoodNetwork();
      if (!faucetWrite) throw new Error("Faucet not configured.");
      setButtonLoading(faucetClaimBtn, true, "Claiming...");
      setStatus(faucetStatus, `<span class="spinner"></span> Sending faucet claim...`, "pending", true);
      const tx = await faucetWrite.claim();
      setStatus(faucetStatus, `<span class="spinner"></span> Confirming: ${short(tx.hash)}`, "pending", true);
      await tx.wait();
      setStatus(faucetStatus, `Faucet claim confirmed: ${short(tx.hash)}`, "ok");
      await refreshFaucetStatus();
    } catch (err) {
      setStatus(faucetStatus, err.message || String(err), "error");
    } finally {
      setButtonLoading(faucetClaimBtn, false);
    }
  }

  /* ── Mint ────────────────────────────────────────── */
  async function mint() {
    if (isMinting) return;
    isMinting = true;
    setButtonLoading(mintBtn, true, "Minting...");
    try {
      const writable = await ensureWritableContract();
      await requireRobinhoodNetwork();
      const quantity = Math.max(1, Math.min(UI_MAX_MINTS_PER_WALLET, Number(qtyInput.value) || 1));
      const expandedOwned = Number(await nftRead.balanceOf(account));
      const remaining = Math.max(0, UI_MAX_MINTS_PER_WALLET - expandedOwned);
      setWalletRemainingFromOwned(expandedOwned);
      if (remaining <= 0) {
        throw new Error(`Limit reached: maximum ${UI_MAX_MINTS_PER_WALLET} mints per wallet.`);
      }
      if (quantity > remaining) {
        throw new Error(`Limit: you can mint up to ${remaining} more from this wallet.`);
      }
      const price = cachedPrice || (await nftRead.MINT_PRICE());
      const value = price * BigInt(quantity);
      const ethBalance = await getWalletEthBalance();
      if (ethBalance < value) {
        showFaucetPrompt(
          mintStatus,
          `Insufficient Robinhood testnet ETH for this mint (${ethers.formatEther(value)} ETH required).`
        );
        window.open(faucetUrlSafe(), "_blank", "noopener,noreferrer");
        return;
      }
      setStatus(mintStatus, `<span class="spinner"></span> Sending transaction...`, "pending", true);
      const tx = await writable.mint(quantity, { value });
      setStatus(mintStatus, `<span class="spinner"></span> Confirming: ${short(tx.hash)}`, "pending", true);
      await tx.wait();
      setStatus(mintStatus, `Mint confirmed! Tx: ${short(tx.hash)}`, "ok");
      await refreshMintInfo();
      await loadOwnedTokens();
    } catch (err) {
      setStatus(mintStatus, err.message || err, "error");
    } finally {
      isMinting = false;
      setButtonLoading(mintBtn, false);
    }
  }

  /* ── Empty state ─────────────────────────────────── */
  function showEmptyState() {
    if (!tokenList) return;
    tokenList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">BROKER</div>
        <div>No Stonk Brokers yet. Mint one to get started!</div>
      </div>
    `;
  }

  async function openNftModal(nft) {
    if (!nftModalBackdrop || !nftModalImage) return;
    selectedNft = nft;
    const resolvedSrc = await resolveNftImage(nft.tokenId);
    selectedNft.resolvedImageSrc = resolvedSrc;
    nftModalImage.src = resolvedSrc;
    nftModalImage.alt = `Stonk Broker #${nft.tokenId}`;
    if (nftModalTokenId) nftModalTokenId.textContent = `#${nft.tokenId}`;
    if (nftModalFundedToken) nftModalFundedToken.textContent = nft.tokenLabel;
    if (nftModalBalance) nftModalBalance.textContent = nft.displayBalance;
    if (nftModalWallet) nftModalWallet.textContent = nft.wallet;
    if (nftModalRecipient) nftModalRecipient.value = "";
    if (nftModalAmount) nftModalAmount.value = "";
    setModalSendStatus("");
    setShareHint("");

    const explorerBase = (cfg.blockExplorerUrl || "").replace(/\/$/, "");
    const walletUrl = explorerBase ? `${explorerBase}/address/${nft.wallet}` : "#";
    if (nftModalWalletLink) {
      nftModalWalletLink.href = walletUrl;
      nftModalWalletLink.style.pointerEvents = explorerBase ? "auto" : "none";
      nftModalWalletLink.style.opacity = explorerBase ? "1" : "0.6";
    }

    nftModalBackdrop.classList.add("open");
    nftModalBackdrop.setAttribute("aria-hidden", "false");
  }

  async function resolveNftImage(tokenId) {
    const localPreview = previewImgForToken(tokenId);
    if (tokenId <= 444) return localPreview;
    try {
      const contract = tokenId <= 444 && originalRead ? originalRead : expandedContractForTokenId(tokenId);
      if (!contract) return localPreview;
      const tokenUri = await contract.tokenURI(tokenId);
      const jsonPrefix = "data:application/json;base64,";
      if (!tokenUri.startsWith(jsonPrefix)) return localPreview;
      const payload = tokenUri.slice(jsonPrefix.length);
      const json = JSON.parse(atob(payload));
      return json.image || localPreview;
    } catch (_error) {
      return localPreview;
    }
  }

  function closeNftModal() {
    if (!nftModalBackdrop) return;
    nftModalBackdrop.classList.remove("open");
    nftModalBackdrop.setAttribute("aria-hidden", "true");
    selectedNft = null;
    setModalSendStatus("");
    setShareHint("");
  }

  function nftImageUrl(tokenId) {
    const base = window.location.origin || "";
    return `${base}${previewImgForToken(tokenId)}`;
  }

  function shareSelectedNftOnX() {
    if (!selectedNft) return;
    const text =
      `Just minted Stonk Broker #${selectedNft.tokenId} on Robinhood Chain.\n` +
      `Funded token: $${selectedNft.tokenLabel}.\n` +
      `Mint yours: https://stonkbrokers.cash\n` +
      `Powered by Clutch Markets (@clutchmarkets)\n` +
      `#StonkBrokers #RobinhoodChain`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    // Download the image automatically so attaching it in X is faster.
    downloadSelectedNftImage(true);
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
    setShareHint("Caption opened on X and broker PNG downloaded. Attach the image to your post.");
  }

  async function copySelectedNftImageLink() {
    if (!selectedNft) return;
    const src = selectedNft.resolvedImageSrc || nftImageUrl(selectedNft.tokenId);
    // For on-chain data URIs, copy image to clipboard as PNG blob
    if (src.startsWith("data:image/")) {
      try {
        let svgText;
        if (src.includes(";base64,")) {
          svgText = atob(src.split(";base64,")[1]);
        } else {
          svgText = decodeURIComponent(src.split(",").slice(1).join(","));
        }
        const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
        const svgUrl = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = async function () {
          const canvas = document.createElement("canvas");
          canvas.width = 600;
          canvas.height = 600;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, 600, 600);
          URL.revokeObjectURL(svgUrl);
          canvas.toBlob(async function (blob) {
            if (!blob) { setShareHint("Could not generate image."); return; }
            try {
              await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
              setShareHint("Broker PNG copied to clipboard. Paste it directly in your X post.");
            } catch (_err) {
              setShareHint("Browser blocked clipboard write. Use the download button instead.");
            }
          }, "image/png");
        };
        img.onerror = function () {
          URL.revokeObjectURL(svgUrl);
          setShareHint("Could not render image. Use the download button instead.");
        };
        img.src = svgUrl;
        return;
      } catch (_err) {
        // Fall through
      }
    }
    // Hosted image: copy the URL
    try {
      await navigator.clipboard.writeText(src);
      setShareHint("Image link copied. Paste it in your X post.");
    } catch (_error) {
      setShareHint(`Copy failed. Use this link: ${src}`);
    }
  }

  function downloadSelectedNftImage(silent = false) {
    if (!selectedNft) return;
    const src = selectedNft.resolvedImageSrc || nftImageUrl(selectedNft.tokenId);
    const filename = `stonk-broker-${selectedNft.tokenId}`;

    // Handle data:image/svg+xml URIs (on-chain images)
    if (src.startsWith("data:image/svg+xml")) {
      try {
        let svgText;
        if (src.includes(";base64,")) {
          svgText = atob(src.split(";base64,")[1]);
        } else {
          svgText = decodeURIComponent(src.split(",").slice(1).join(","));
        }
        // Create a PNG via canvas for better X compatibility
        const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
        const svgUrl = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement("canvas");
          canvas.width = 600;
          canvas.height = 600;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, 600, 600);
          URL.revokeObjectURL(svgUrl);
          canvas.toBlob(function (blob) {
            if (!blob) return;
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `${filename}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            if (!silent) {
              setShareHint("Downloaded PNG. You can upload it directly in X compose.");
            }
          }, "image/png");
        };
        img.onerror = function () {
          // Fallback: download raw SVG
          URL.revokeObjectURL(svgUrl);
          const a = document.createElement("a");
          a.href = URL.createObjectURL(svgBlob);
          a.download = `${filename}.svg`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          if (!silent) setShareHint("Downloaded SVG. You can upload it directly in X compose.");
        };
        img.src = svgUrl;
        return;
      } catch (_err) {
        // Fall through to default behavior
      }
    }

    // Default: direct link download
    const a = document.createElement("a");
    a.href = src;
    a.download = `${filename}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (!silent) {
      setShareHint("Downloaded SVG. You can upload it directly in X compose.");
    }
  }

  async function refreshSelectedNftModalBalance() {
    if (!selectedNft || !provider || !nftModalBalance) return;
    const token = new ethers.Contract(selectedNft.tokenAddress, erc20MetaAbi, provider);
    const [rawBal, decimals] = await Promise.all([token.balanceOf(selectedNft.wallet), token.decimals()]);
    const displayBalance = ethers.formatUnits(rawBal, decimals);
    selectedNft.displayBalance = displayBalance;
    nftModalBalance.textContent = displayBalance;
  }

  async function sendSelectedNftTokens() {
    if (!selectedNft) {
      setModalSendStatus("No NFT selected.", "error");
      return;
    }
    if (!nftModalRecipient || !nftModalAmount) return;

    const recipient = (nftModalRecipient.value || "").trim();
    const amountText = (nftModalAmount.value || "").trim();

    if (!ethers.isAddress(recipient)) {
      setModalSendStatus("Recipient address is invalid.", "error");
      return;
    }
    if (!amountText || Number(amountText) <= 0) {
      setModalSendStatus("Enter a token amount greater than 0.", "error");
      return;
    }

    try {
      await requireRobinhoodNetwork();
      await ensureWritableContract();
      if (!signer) throw new Error("Connect wallet first.");

      const token = new ethers.Contract(selectedNft.tokenAddress, erc20MetaAbi, provider);
      const [decimals, walletBal] = await Promise.all([token.decimals(), token.balanceOf(selectedNft.wallet)]);
      const amountWei = ethers.parseUnits(amountText, decimals);
      if (amountWei > walletBal) {
        throw new Error("Amount exceeds wallet token balance.");
      }

      const tba = new ethers.Contract(selectedNft.wallet, walletAbi, signer);
      setButtonLoading(nftModalSend, true, "Sending...");
      setModalSendStatus("Sending token transfer transaction...", "pending");
      const tx = await tba.executeTokenTransfer(selectedNft.tokenAddress, recipient, amountWei);
      setModalSendStatus(`Pending: ${short(tx.hash)}`, "pending");
      await tx.wait();
      setModalSendStatus(`Transfer confirmed: ${short(tx.hash)}`, "ok");
      await refreshSelectedNftModalBalance();
      await loadOwnedTokens();
    } catch (error) {
      setModalSendStatus(error.message || String(error), "error");
    } finally {
      setButtonLoading(nftModalSend, false);
    }
  }

  /* ── Owned tokens ────────────────────────────────── */
  function chunkArray(values, size) {
    const chunks = [];
    for (let i = 0; i < values.length; i += size) {
      chunks.push(values.slice(i, i + size));
    }
    return chunks;
  }

  function cardKeyForBroker(collectionKey, tokenId) {
    return `${collectionKey}-${String(tokenId)}`;
  }

  async function fetchOwnedTokenIds(contract, owner, chunkSize = 20) {
    const count = Number(await contract.balanceOf(owner));
    if (count === 0) return [];

    const indexes = Array.from({ length: count }, (_, i) => i);
    const tokenIds = [];
    for (const group of chunkArray(indexes, chunkSize)) {
      const groupIds = await Promise.all(group.map((idx) => contract.tokenOfOwnerByIndex(owner, idx)));
      tokenIds.push(...groupIds.map((id) => Number(id)));
    }
    return tokenIds;
  }

  function bindOwnedTokenCardClicks() {
    if (!tokenList) return;
    tokenList.querySelectorAll(".nft-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && event.target.closest("a")) return;
        const tokenId = Number(card.getAttribute("data-token-id") || "0");
        const wallet = card.getAttribute("data-wallet") || "";
        const tokenLabel = card.getAttribute("data-token-label") || "";
        const displayBalance = card.getAttribute("data-balance") || "";
        const tokenAddress = card.getAttribute("data-token-address") || "";
        if (!tokenId || !wallet || !tokenAddress) return;
        openNftModal({ tokenId, wallet, tokenLabel, displayBalance, tokenAddress });
      });
    });
  }

  function renderOwnedTokenCardsFast(baseBrokers) {
    if (!tokenList) return;
    const cards = baseBrokers.map((broker) => {
      const tokenId = broker.tokenId;
      const cardKey = cardKeyForBroker(broker.collection, tokenId);
      return `
        <div class="nft-card" data-card-key="${cardKey}" data-token-id="${tokenId}" data-wallet="" data-token-label="" data-balance="" data-token-address="">
          <div class="nft-thumb">
            <img src="${previewImgForToken(tokenId)}"
                 alt="Stonk Broker #${tokenId}"
                 onerror="this.onerror=null;this.style.opacity='0.35';this.style.filter='grayscale(1)';this.alt='Broker preview loading';" />
          </div>
          <div class="nft-details">
            <div class="nft-id">Stonk Broker #${tokenId}</div>
            <div class="nft-meta">
              <span class="token-badge unknown">Loading</span>
              &nbsp; <span class="balance-val">...</span> tokens<br/>
              Wallet: <code>loading...</code>
            </div>
          </div>
        </div>
      `;
    });
    tokenList.innerHTML = `
      <div id="ownedHydrateStatus" class="status pending">Hydrating broker icons and wallet data...</div>
      <div class="nft-grid">${cards.join("")}</div>
    `;
    bindOwnedTokenCardClicks();
  }

  function hydrateOwnedCard(broker, details) {
    if (!tokenList) return;
    const key = cardKeyForBroker(broker.collection, broker.tokenId);
    const card = tokenList.querySelector(`.nft-card[data-card-key="${key}"]`);
    if (!card) return;

    const labels = cfg.stockTokenLabels || {};
    const tokenLabel = labels[details.fundedToken] || labels[details.fundedToken.toLowerCase()] || short(details.fundedToken);
    const badgeClass = tokenCssClass(tokenLabel);
    const explorer = cfg.blockExplorerUrl
      ? `${cfg.blockExplorerUrl.replace(/\/$/, "")}/address/${details.wallet}`
      : "";
    const explorerLink = explorer ? `<a href="${explorer}" target="_blank" rel="noreferrer">view wallet</a>` : "";

    card.setAttribute("data-wallet", details.wallet);
    card.setAttribute("data-token-label", tokenLabel);
    card.setAttribute("data-balance", details.displayBalance);
    card.setAttribute("data-token-address", details.fundedToken);

    const meta = card.querySelector(".nft-meta");
    if (meta) {
      meta.innerHTML = `
        <span class="token-badge ${badgeClass}">${escapeHtml(tokenLabel)}</span>
        &nbsp; <span class="balance-val">${escapeHtml(details.displayBalance)}</span> tokens<br/>
        Wallet: <code>${short(details.wallet)}</code>
        ${explorerLink ? ` &middot; ${explorerLink}` : ""}
      `;
    }
  }

  async function resolveCardImageFromTokenUri(contract, tokenId) {
    try {
      const tokenUri = await contract.tokenURI(tokenId);
      if (tokenUri.startsWith("data:image/svg+xml;base64,") || tokenUri.startsWith("data:image/svg+xml;utf8,")) {
        return tokenUri;
      }
      const jsonPrefix = "data:application/json;base64,";
      if (!tokenUri.startsWith(jsonPrefix)) return null;
      const payload = tokenUri.slice(jsonPrefix.length);
      const json = JSON.parse(atob(payload));
      return json.image || null;
    } catch (_err) {
      return null;
    }
  }

  async function resolveTokenImageByAddress(nftAddress, tokenId) {
    const key = `${String(nftAddress).toLowerCase()}-${String(tokenId)}`;
    if (marketImageCache.has(key)) {
      return marketImageCache.get(key);
    }
    try {
      const readProvider = getReadProvider();
      const nftReadAny = new ethers.Contract(nftAddress, nftAbi, readProvider);
      const tokenUri = await nftReadAny.tokenURI(tokenId);
      let image = null;
      if (tokenUri.startsWith("data:image/svg+xml;base64,") || tokenUri.startsWith("data:image/svg+xml;utf8,")) {
        image = tokenUri;
      } else if (tokenUri.startsWith("data:application/json;base64,")) {
        const payload = tokenUri.slice("data:application/json;base64,".length);
        const json = JSON.parse(atob(payload));
        image = json.image || null;
      }
      marketImageCache.set(key, image);
      return image;
    } catch (_err) {
      marketImageCache.set(key, null);
      return null;
    }
  }

  async function hydrateMarketFeedThumbnails() {
    if (!marketFeed) return;
    const feedStatus = document.getElementById("marketFeedStatus");
    const imgs = Array.from(marketFeed.querySelectorAll("img.market-thumb-img[data-nft][data-token-id]"));
    const targets = imgs
      .map((img) => ({
        el: img,
        nft: img.getAttribute("data-nft") || "",
        tokenId: Number(img.getAttribute("data-token-id") || "0"),
      }))
      .filter((t) => t.nft && t.tokenId > 444);
    if (!targets.length) return;
    if (feedStatus) {
      setStatus(feedStatus, `Hydrating listing images (0/${targets.length})...`, "pending");
    }

    const chunks = chunkArray(targets, 10);
    let hydrated = 0;
    for (const group of chunks) {
      const resolved = await Promise.all(
        group.map(async (item) => ({
          item,
          image: await resolveTokenImageByAddress(item.nft, item.tokenId),
        }))
      );
      for (const row of resolved) {
        if (row.image && row.item.el && row.item.el.isConnected) {
          row.item.el.onerror = null;
          row.item.el.src = row.image;
        }
      }
      hydrated += group.length;
      if (feedStatus) {
        setStatus(feedStatus, `Hydrating listing images (${hydrated}/${targets.length})...`, "pending");
      }
    }
    if (feedStatus) {
      setStatus(feedStatus, "Listing images loaded.", "ok");
      setTimeout(() => {
        if (feedStatus.isConnected) feedStatus.textContent = "";
      }, 1400);
    }
  }

  async function hydrateOwnedTokens(baseBrokers, detailChunkSize = 12) {
    const labels = cfg.stockTokenLabels || {};
    const chunks = chunkArray(baseBrokers, detailChunkSize);
    let hydrated = 0;
    const total = baseBrokers.length;
    const statusEl = tokenList ? tokenList.querySelector("#ownedHydrateStatus") : null;
    if (statusEl) {
      setStatus(statusEl, `Hydrating broker icons and wallet data (0/${total})...`, "pending");
    }
    for (const group of chunks) {
      const detailRows = await Promise.all(group.map(async (broker) => {
        const tokenId = broker.tokenId;
        const contract = broker.collection === "original"
          ? originalRead
          : broker.collection === "expandedLegacy"
            ? legacyExpandedRead
            : nftRead;
        const [wallet, fundedToken] = await Promise.all([
          contract.tokenWallet(tokenId),
          contract.fundedToken(tokenId),
        ]);
        const stock = new ethers.Contract(fundedToken, erc20Abi, provider);
        const balance = await stock.balanceOf(wallet);
        const displayBalance = ethers.formatUnits(balance, 18);
        const tokenLabel = labels[fundedToken] || labels[fundedToken.toLowerCase()] || short(fundedToken);
        const tokenUriImage = broker.collection === "expanded" || broker.collection === "expandedLegacy"
          ? await resolveCardImageFromTokenUri(contract, tokenId)
          : null;
        return { broker, wallet, fundedToken, displayBalance, tokenLabel, tokenUriImage };
      }));

      for (const row of detailRows) {
        hydrateOwnedCard(row.broker, row);
        if (row.tokenUriImage) {
          const key = cardKeyForBroker(row.broker.collection, row.broker.tokenId);
          const card = tokenList ? tokenList.querySelector(`.nft-card[data-card-key="${key}"]`) : null;
          const img = card ? card.querySelector(".nft-thumb img") : null;
          if (img) {
            img.onerror = null;
            img.src = row.tokenUriImage;
            img.style.opacity = "1";
            img.style.filter = "none";
            img.alt = `Stonk Broker #${row.broker.tokenId}`;
          }
        }
        const target = ownedBrokers.find(
          (b) => b.collection === row.broker.collection && b.tokenId === row.broker.tokenId
        );
        if (target) {
          target.tokenLabel = row.tokenLabel;
        }
      }
      hydrated += detailRows.length;
      if (statusEl) {
        setStatus(statusEl, `Hydrating broker icons and wallet data (${hydrated}/${total})...`, "pending");
      }
      refreshOwnedBrokerSelectors();
    }
    if (statusEl) {
      setStatus(statusEl, `Broker icons and wallet data loaded (${total}/${total}).`, "ok");
      setTimeout(() => {
        if (statusEl.isConnected) statusEl.textContent = "";
      }, 1800);
    }
  }

  async function loadOwnedTokens() {
    if (!account) {
      ownedBrokers = [];
      refreshOwnedBrokerSelectors();
      if (tokenList) {
        tokenList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">LOCK</div>
            <div>Connect your wallet to view your Stonk Brokers.</div>
          </div>
        `;
      }
      return;
    }
    try {
      await requireRobinhoodNetwork();
    } catch (err) {
      if (tokenList) tokenList.textContent = err.message || "Wrong network.";
      return;
    }

    tokenList.innerHTML = `<div style="padding:16px;text-align:center"><span class="spinner"></span> Loading your brokers...</div>`;
    try {
      ownedBrokers = [];
      const [expandedCount, legacyExpandedCount, originalCount] = await Promise.all([
        nftRead.balanceOf(account).then((v) => Number(v)),
        legacyExpandedRead ? legacyExpandedRead.balanceOf(account).then((v) => Number(v)) : Promise.resolve(0),
        originalRead ? originalRead.balanceOf(account).then((v) => Number(v)) : Promise.resolve(0),
      ]);
      const totalCount = expandedCount + legacyExpandedCount + originalCount;
      setWalletRemainingFromOwned(expandedCount);
      if (totalCount === 0) {
        refreshOwnedBrokerSelectors();
        showEmptyState();
        return;
      }

      const collections = [];
      if (originalRead) collections.push({ key: "original", contract: originalRead });
      if (legacyExpandedRead) collections.push({ key: "expandedLegacy", contract: legacyExpandedRead });
      collections.push({ key: "expanded", contract: nftRead });

      const tokenIdBatches = await Promise.all(
        collections.map(async (collection) => {
          const tokenIds = await fetchOwnedTokenIds(collection.contract, account, 20);
          return tokenIds.map((tokenId) => ({ collection: collection.key, tokenId }));
        })
      );
      const baseBrokers = tokenIdBatches.flat().sort((a, b) => a.tokenId - b.tokenId);
      ownedBrokers = baseBrokers.map((b) => ({
        collection: b.collection,
        tokenId: b.tokenId,
        tokenLabel: "",
      }));

      refreshOwnedBrokerSelectors();
      renderOwnedTokenCardsFast(baseBrokers);
      hydrateOwnedTokens(baseBrokers, 12).catch(() => {
        // Keep fast-rendered cards visible if hydration partially fails.
      });
    } catch (err) {
      ownedBrokers = [];
      refreshOwnedBrokerSelectors();
      tokenList.textContent = `Error: ${err.message || err}`;
    }
  }

  function populateMarketplaceTokenSelect() {
    if (!marketListPaymentToken) return;
    const labels = cfg.stockTokenLabels || {};
    const entries = Object.keys(labels);
    const options = ['<option value="">Select stock token</option>'];
    for (const addr of entries) {
      options.push(`<option value="${addr}">${labels[addr]} (${short(addr)})</option>`);
    }
    marketListPaymentToken.innerHTML = options.join("");
  }

  function collectionNameByAddress(addr) {
    if (!addr) return "Unknown";
    const a = addr.toLowerCase();
    if (a === originalAddress().toLowerCase()) return "Original";
    if (legacyExpandedAddress() && a === legacyExpandedAddress().toLowerCase()) return "Expanded";
    if (a === expandedMintAddress().toLowerCase()) return "Expanded";
    return short(addr);
  }

  function ensureMarketplaceConfigured() {
    if (!marketRead) {
      throw new Error("Marketplace address missing in ui/config.js");
    }
  }

  function nftContractForCollection(collectionAddress, writable = false) {
    const runner = writable ? signer : provider;
    return new ethers.Contract(collectionAddress, nftAbi, runner);
  }

  async function ensureNftApprovalForMarketplace(collectionAddress, tokenId, statusEl) {
    if (!account) throw new Error("Connect wallet first.");
    const marketAddr = marketplaceAddress();
    if (!marketAddr) throw new Error("Marketplace address missing in ui/config.js");

    const nftReadContract = nftContractForCollection(collectionAddress, false);
    const owner = await nftReadContract.ownerOf(tokenId);
    if (owner.toLowerCase() !== account.toLowerCase()) {
      throw new Error(`You do not own broker #${tokenId} in this collection.`);
    }

    const [approvedForToken, approvedForAll] = await Promise.all([
      nftReadContract.getApproved(tokenId),
      nftReadContract.isApprovedForAll(account, marketAddr),
    ]);

    if (approvedForAll || approvedForToken.toLowerCase() === marketAddr.toLowerCase()) {
      return;
    }

    if (!signer) throw new Error("Connect wallet first.");
    const nftWriteContract = nftContractForCollection(collectionAddress, true);
    setStatus(statusEl, `<span class="spinner"></span> Approving broker #${tokenId} for marketplace...`, "pending", true);
    const approveTx = await nftWriteContract.approve(marketAddr, tokenId);
    await approveTx.wait();
  }

  function getPublicMarketplaceReader() {
    const addr = marketplaceAddress();
    if (!addr) throw new Error("Marketplace address missing in ui/config.js");
    const publicProvider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    return new ethers.Contract(addr, marketplaceAbi, publicProvider);
  }

  function renderOwnedBrokerSelect(selectEl, collectionKey, placeholder) {
    if (!selectEl) return;
    const filtered = ownedBrokers
      .filter((b) => {
        if (collectionKey === "expanded") {
          return b.collection === "expanded" || b.collection === "expandedLegacy";
        }
        return b.collection === collectionKey;
      })
      .sort((a, b) => a.tokenId - b.tokenId);
    const options = [`<option value="">${placeholder}</option>`];
    for (const broker of filtered) {
      const suffix = broker.tokenLabel ? ` • ${broker.tokenLabel}` : "";
      options.push(`<option value="${broker.tokenId}">#${broker.tokenId}${suffix}</option>`);
    }
    selectEl.innerHTML = options.join("");
    selectEl.disabled = filtered.length === 0;
  }

  function refreshOwnedBrokerSelectors() {
    const listingCollection = marketListCollection ? marketListCollection.value : "expanded";
    const offeredCollection = marketSwapOfferedCollection ? marketSwapOfferedCollection.value : "expanded";
    renderOwnedBrokerSelect(marketListTokenId, listingCollection, "Select owned broker");
    renderOwnedBrokerSelect(marketSwapOfferedTokenId, offeredCollection, "Select owned broker");
  }

  function updateListingTypeUi() {
    if (!marketListType || !marketListPaymentToken) return;
    const isEth = marketListType.value === "eth";
    marketListPaymentToken.disabled = isEth;
    if (marketPaymentTokenField) {
      marketPaymentTokenField.style.display = isEth ? "none" : "block";
    }
    if (isEth) {
      marketListPaymentToken.value = "";
    }
  }

  async function createListing() {
    try {
      await ensureWritableContract();
      await requireRobinhoodNetwork();
      ensureMarketplaceConfigured();
      if (!marketWrite) throw new Error("Connect wallet first.");

      const tokenId = Number(marketListTokenId.value || "0");
      const collection = collectionAddressByKey(marketListCollection.value, tokenId);
      const listingType = marketListType.value;
      if (!Number.isInteger(tokenId) || tokenId <= 0) throw new Error("Select one of your brokers.");

      await ensureNftApprovalForMarketplace(collection, tokenId, marketCreateStatus);

      setStatus(marketCreateStatus, `<span class="spinner"></span> Creating listing...`, "pending", true);
      let tx;
      if (listingType === "eth") {
        const ethPrice = marketListPrice.value.trim();
        if (!ethPrice || Number(ethPrice) <= 0) throw new Error("Enter ETH price.");
        tx = await marketWrite.createEthListing(collection, tokenId, ethers.parseEther(ethPrice));
      } else {
        const tokenAddress = (marketListPaymentToken.value || "").trim();
        const labels = cfg.stockTokenLabels || {};
        const tokenLabel = labels[tokenAddress] || labels[tokenAddress.toLowerCase()];
        if (!tokenAddress || !ethers.isAddress(tokenAddress)) throw new Error("Select valid payment token.");
        if (!tokenLabel) throw new Error("Unknown payment token.");
        const tokenPrice = marketListPrice.value.trim();
        if (!tokenPrice || Number(tokenPrice) <= 0) throw new Error("Enter token price.");
        tx = await marketWrite.createTokenListing(collection, tokenId, tokenAddress, ethers.parseUnits(tokenPrice, 18));
      }
      await tx.wait();
      setStatus(marketCreateStatus, `Listing created: ${short(tx.hash)}`, "ok");
      await refreshMarketplaceFeed();
      await loadOwnedTokens();
    } catch (err) {
      setStatus(marketCreateStatus, err.message || String(err), "error");
    }
  }

  async function loadListingById() {
    try {
      await ensureProvider();
      await requireRobinhoodNetwork();
      ensureMarketplaceConfigured();
      const id = Number(marketListingId.value || "0");
      if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid listing ID.");
      const listing = await marketRead.listings(id);
      loadedListing = listing;
      if (Number(listing.id) === 0) {
        setStatus(marketListingPreview, "Listing not found.", "error");
        return;
      }
      const kind = Number(listing.kind) === 1 ? "ETH" : Number(listing.kind) === 2 ? "ERC20" : "None";
      const priceText =
        Number(listing.kind) === 1 ? `${ethers.formatEther(listing.price)} ETH` :
          `${ethers.formatUnits(listing.price, 18)} tokens`;
      setStatus(
        marketListingPreview,
        `Listing #${listing.id} • ${collectionNameByAddress(listing.nft)} #${listing.tokenId} • ${kind} • ${priceText} • ${listing.active ? "ACTIVE" : "INACTIVE"}`,
        listing.active ? "ok" : "pending"
      );
    } catch (err) {
      setStatus(marketListingPreview, err.message || String(err), "error");
    }
  }

  async function buyLoadedListing() {
    try {
      await ensureWritableContract();
      await requireRobinhoodNetwork();
      ensureMarketplaceConfigured();
      const id = Number(marketListingId.value || "0");
      if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid listing ID.");
      const listing = await marketRead.listings(id);
      if (!listing.active) throw new Error("Listing is inactive.");

      setStatus(marketListingStatus, `<span class="spinner"></span> Executing buy...`, "pending", true);
      let tx;
      if (Number(listing.kind) === 1) {
        tx = await marketWrite.buyWithEth(id, { value: listing.price });
      } else if (Number(listing.kind) === 2) {
        const payToken = new ethers.Contract(listing.paymentToken, erc20MetaAbi, signer);
        const allowance = await payToken.allowance(account, marketplaceAddress());
        if (allowance < listing.price) {
          setStatus(marketListingStatus, `<span class="spinner"></span> Approving payment token...`, "pending", true);
          const approveTx = await payToken.approve(marketplaceAddress(), listing.price);
          await approveTx.wait();
        }
        setStatus(marketListingStatus, `<span class="spinner"></span> Buying with token...`, "pending", true);
        tx = await marketWrite.buyWithToken(id);
      } else {
        throw new Error("Unsupported listing kind.");
      }
      await tx.wait();
      setStatus(marketListingStatus, `Buy confirmed: ${short(tx.hash)}`, "ok");
      await refreshMarketplaceFeed();
      await loadOwnedTokens();
      await loadListingById();
    } catch (err) {
      setStatus(marketListingStatus, err.message || String(err), "error");
    }
  }

  async function cancelListingById() {
    try {
      await ensureWritableContract();
      await requireRobinhoodNetwork();
      ensureMarketplaceConfigured();
      const id = Number(marketListingId.value || "0");
      if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid listing ID.");
      setStatus(marketListingStatus, `<span class="spinner"></span> Canceling listing...`, "pending", true);
      const tx = await marketWrite.cancelListing(id);
      await tx.wait();
      setStatus(marketListingStatus, `Listing canceled: ${short(tx.hash)}`, "ok");
      await refreshMarketplaceFeed();
      await loadOwnedTokens();
      await loadListingById();
    } catch (err) {
      setStatus(marketListingStatus, err.message || String(err), "error");
    }
  }

  async function createSwap() {
    try {
      await ensureWritableContract();
      await requireRobinhoodNetwork();
      ensureMarketplaceConfigured();
      const offeredId = Number(marketSwapOfferedTokenId.value || "0");
      const requestedId = Number(marketSwapRequestedTokenId.value || "0");
      const offeredCollection = collectionAddressByKey(marketSwapOfferedCollection.value, offeredId);
      const requestedCollection = collectionAddressByKey(marketSwapRequestedCollection.value, requestedId);
      if (!Number.isInteger(offeredId) || offeredId <= 0) throw new Error("Select one of your brokers to offer.");
      if (!Number.isInteger(requestedId) || requestedId <= 0) throw new Error("Invalid requested token ID.");

      await ensureNftApprovalForMarketplace(offeredCollection, offeredId, marketSwapCreateStatus);

      setStatus(marketSwapCreateStatus, `<span class="spinner"></span> Creating swap...`, "pending", true);
      const tx = await marketWrite.createSwapOffer(
        offeredCollection,
        offeredId,
        requestedCollection,
        requestedId
      );
      await tx.wait();
      setStatus(marketSwapCreateStatus, `Swap created: ${short(tx.hash)}`, "ok");
      await refreshMarketplaceFeed();
      await loadOwnedTokens();
    } catch (err) {
      setStatus(marketSwapCreateStatus, err.message || String(err), "error");
    }
  }

  async function loadSwapById() {
    try {
      await ensureProvider();
      await requireRobinhoodNetwork();
      ensureMarketplaceConfigured();
      const id = Number(marketSwapId.value || "0");
      if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid swap ID.");
      const swap = await marketRead.swaps(id);
      loadedSwap = swap;
      if (Number(swap.id) === 0) {
        setStatus(marketSwapPreview, "Swap not found.", "error");
        return;
      }
      setStatus(
        marketSwapPreview,
        `Swap #${swap.id} • Offer: ${collectionNameByAddress(swap.offeredNft)} #${swap.offeredTokenId} • Wants: ${collectionNameByAddress(swap.requestedNft)} #${swap.requestedTokenId} • ${swap.active ? "ACTIVE" : "INACTIVE"}`,
        swap.active ? "ok" : "pending"
      );
    } catch (err) {
      setStatus(marketSwapPreview, err.message || String(err), "error");
    }
  }

  async function acceptSwapById() {
    try {
      await ensureWritableContract();
      await requireRobinhoodNetwork();
      ensureMarketplaceConfigured();
      const id = Number(marketSwapId.value || "0");
      if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid swap ID.");
      setStatus(marketSwapStatus, `<span class="spinner"></span> Accepting swap...`, "pending", true);
      const tx = await marketWrite.acceptSwapOffer(id);
      await tx.wait();
      setStatus(marketSwapStatus, `Swap accepted: ${short(tx.hash)}`, "ok");
      await refreshMarketplaceFeed();
      await loadOwnedTokens();
      await loadSwapById();
    } catch (err) {
      setStatus(marketSwapStatus, err.message || String(err), "error");
    }
  }

  async function cancelSwapById() {
    try {
      await ensureWritableContract();
      await requireRobinhoodNetwork();
      ensureMarketplaceConfigured();
      const id = Number(marketSwapId.value || "0");
      if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid swap ID.");
      setStatus(marketSwapStatus, `<span class="spinner"></span> Canceling swap...`, "pending", true);
      const tx = await marketWrite.cancelSwapOffer(id);
      await tx.wait();
      setStatus(marketSwapStatus, `Swap canceled: ${short(tx.hash)}`, "ok");
      await refreshMarketplaceFeed();
      await loadOwnedTokens();
      await loadSwapById();
    } catch (err) {
      setStatus(marketSwapStatus, err.message || String(err), "error");
    }
  }

  function previewImgForToken(tokenId) {
    const id = Number(tokenId);
    if (id <= 444) return `/previews/stonk-broker-${id}.svg`;
    return `/previews-expanded/stonk-broker-${id}.svg`;
  }

  function stockLabelForAddress(addr) {
    const labels = cfg.stockTokenLabels || {};
    return labels[addr] || labels[(addr || "").toLowerCase()] || "";
  }

  function getReadProvider() {
    return provider || new ethers.JsonRpcProvider(cfg.rpcUrl);
  }

  async function openMarketItemModal(item) {
    if (!marketModalBackdrop || !marketModalImage) return;

    const tokenId = Number(item.tokenId || "0");
    const nft = item.nft || "";
    const explorerBase = (cfg.blockExplorerUrl || "").replace(/\/$/, "");

    marketModalImage.src = previewImgForToken(tokenId);
    marketModalImage.alt = `Stonk Broker #${tokenId}`;
    if (marketModalType) marketModalType.textContent = item.type || "-";
    if (marketModalEntryId) marketModalEntryId.textContent = item.id || "-";
    if (marketModalCollection) marketModalCollection.textContent = collectionNameByAddress(nft);
    if (marketModalTokenId) marketModalTokenId.textContent = tokenId ? `#${tokenId}` : "-";
    if (marketModalStatus) marketModalStatus.textContent = item.active === "true" ? "ACTIVE" : "INACTIVE";
    if (marketModalPrice) marketModalPrice.textContent = item.priceText || "-";
    if (marketModalOwner) marketModalOwner.textContent = item.ownerText || "-";
    if (marketModalWallet) marketModalWallet.textContent = "Loading...";
    if (marketModalFundedToken) marketModalFundedToken.textContent = "Loading...";
    if (marketModalWalletBal) marketModalWalletBal.textContent = "Loading...";
    if (marketModalExplorerLink) {
      marketModalExplorerLink.href = explorerBase && nft && tokenId
        ? `${explorerBase}/token/${nft}?a=${tokenId}`
        : "#";
      marketModalExplorerLink.style.pointerEvents = explorerBase ? "auto" : "none";
      marketModalExplorerLink.style.opacity = explorerBase ? "1" : "0.6";
    }

    marketModalBackdrop.classList.add("open");
    marketModalBackdrop.setAttribute("aria-hidden", "false");

    try {
      const onchainImage = await resolveTokenImageByAddress(nft, tokenId);
      if (onchainImage && marketModalImage && marketModalImage.isConnected) {
        marketModalImage.onerror = null;
        marketModalImage.src = onchainImage;
      }
      const readProvider = getReadProvider();
      const nftReadAny = new ethers.Contract(nft, nftAbi, readProvider);
      const [wallet, fundedTkn] = await Promise.all([nftReadAny.tokenWallet(tokenId), nftReadAny.fundedToken(tokenId)]);
      if (marketModalWallet) marketModalWallet.textContent = wallet;
      const tokenLabel = stockLabelForAddress(fundedTkn);
      if (marketModalFundedToken) marketModalFundedToken.textContent = tokenLabel ? `${tokenLabel} (${short(fundedTkn)})` : fundedTkn;

      const token = new ethers.Contract(fundedTkn, erc20MetaAbi, readProvider);
      const [rawBal, decimals] = await Promise.all([token.balanceOf(wallet), token.decimals()]);
      if (marketModalWalletBal) marketModalWalletBal.textContent = ethers.formatUnits(rawBal, decimals);
    } catch (_err) {
      if (marketModalWallet) marketModalWallet.textContent = "Unavailable";
      if (marketModalFundedToken) marketModalFundedToken.textContent = "Unavailable";
      if (marketModalWalletBal) marketModalWalletBal.textContent = "Unavailable";
    }
  }

  function closeMarketItemModal() {
    if (!marketModalBackdrop) return;
    marketModalBackdrop.classList.remove("open");
    marketModalBackdrop.setAttribute("aria-hidden", "true");
  }

  async function refreshMarketplaceFeed() {
    if (!marketFeed) return;
    const filterActive = document.getElementById("marketFilterActive");
    const onlyActive = filterActive ? filterActive.checked : true;
    const feedStatus = document.getElementById("marketFeedStatus");
    try {
      // Strictly avoid wallet RPC until the user explicitly connects.
      // This prevents unsolicited wallet connection prompts on page load.
      let reader = getPublicMarketplaceReader();
      if (hasUserInitiatedConnect && account) {
        try {
          await ensureProvider();
          reader = marketRead || reader;
        } catch (_err) {
          // Fall back to public RPC if wallet provider is unavailable.
        }
      }
      marketFeed.innerHTML = `<div class="market-log-empty"><span class="spinner"></span> Loading order book...</div>`;
      if (feedStatus) setStatus(feedStatus, "");

      const [nextListingId, nextSwapId] = await Promise.all([reader.nextListingId(), reader.nextSwapId()]);
      const listingEnd = Number(nextListingId) - 1;
      const swapEnd = Number(nextSwapId) - 1;
      const items = [];

      for (let id = Math.max(1, listingEnd - 24); id <= listingEnd; id++) {
        const l = await reader.listings(id);
        if (Number(l.id) === 0) continue;
        if (onlyActive && !l.active) continue;
        const isEth = Number(l.kind) === 1;
        const priceText = isEth
          ? `${ethers.formatEther(l.price)} ETH`
          : `${ethers.formatUnits(l.price, 18)} ${stockLabelForAddress(l.paymentToken) || "tokens"}`;
        const col = collectionNameByAddress(l.nft);
        const thumb = previewImgForToken(l.tokenId);
        const buyBtn = l.active
          ? `<button class="btn-xs buy" data-market-action="buy-listing" data-id="${l.id}">Buy</button>`
          : "";
        const cancelBtn = l.active && account && l.seller.toLowerCase() === account.toLowerCase()
          ? `<button class="btn-xs" data-market-action="cancel-listing" data-id="${l.id}">Cancel</button>`
          : "";
        items.push(`
          <div class="market-log-item"
            data-item-type="Listing"
            data-item-id="${l.id}"
            data-item-active="${l.active}"
            data-item-nft="${l.nft}"
            data-item-token-id="${l.tokenId}"
            data-item-price-text="${escapeHtml(priceText)}"
            data-item-owner-text="${escapeHtml(short(l.seller))}">
            <div class="market-log-thumb">
              <img class="market-thumb-img" data-nft="${l.nft}" data-token-id="${l.tokenId}" src="${thumb}" alt="#${l.tokenId}" onerror="this.style.display='none'" />
            </div>
            <div class="market-log-info">
              <div class="log-title">${col} #${l.tokenId}</div>
              <div class="log-detail">${priceText} &middot; Seller: ${short(l.seller)}</div>
            </div>
            <div class="market-log-actions">
              <span class="market-log-badge listing">Listing #${l.id}</span>
              <span class="market-log-badge ${l.active ? "active" : "inactive"}">${l.active ? "Active" : "Filled"}</span>
              ${buyBtn}${cancelBtn}
            </div>
          </div>`);
      }

      for (let id = Math.max(1, swapEnd - 24); id <= swapEnd; id++) {
        const s = await reader.swaps(id);
        if (Number(s.id) === 0) continue;
        if (onlyActive && !s.active) continue;
        const offCol = collectionNameByAddress(s.offeredNft);
        const reqCol = collectionNameByAddress(s.requestedNft);
        const offeredThumb = previewImgForToken(s.offeredTokenId);
        const requestedThumb = previewImgForToken(s.requestedTokenId);
        const acceptBtn = s.active
          ? `<button class="btn-xs accept" data-market-action="accept-swap" data-id="${s.id}">Accept</button>`
          : "";
        const cancelBtn = s.active && account && s.maker.toLowerCase() === account.toLowerCase()
          ? `<button class="btn-xs" data-market-action="cancel-swap" data-id="${s.id}">Cancel</button>`
          : "";
        items.push(`
          <div class="market-log-item"
            data-item-type="Swap"
            data-item-id="${s.id}"
            data-item-active="${s.active}"
            data-item-nft="${s.offeredNft}"
            data-item-token-id="${s.offeredTokenId}"
            data-item-price-text="${escapeHtml(`Wants ${reqCol} #${s.requestedTokenId}`)}"
            data-item-owner-text="${escapeHtml(short(s.maker))}">
            <div class="market-log-thumbs">
              <div class="market-log-thumb">
                <img class="market-thumb-img" data-nft="${s.offeredNft}" data-token-id="${s.offeredTokenId}" src="${offeredThumb}" alt="Offer #${s.offeredTokenId}" onerror="this.style.display='none'" />
                <span class="market-log-thumb-label">Offer</span>
              </div>
              <div class="market-log-thumb">
                <img class="market-thumb-img" data-nft="${s.requestedNft}" data-token-id="${s.requestedTokenId}" src="${requestedThumb}" alt="Ask #${s.requestedTokenId}" onerror="this.style.display='none'" />
                <span class="market-log-thumb-label">Ask</span>
              </div>
            </div>
            <div class="market-log-info">
              <div class="log-title">${offCol} #${s.offeredTokenId} &rarr; ${reqCol} #${s.requestedTokenId}</div>
              <div class="log-detail">Maker: ${short(s.maker)}</div>
            </div>
            <div class="market-log-actions">
              <span class="market-log-badge swap">Swap #${s.id}</span>
              <span class="market-log-badge ${s.active ? "active" : "inactive"}">${s.active ? "Active" : "Done"}</span>
              ${acceptBtn}${cancelBtn}
            </div>
          </div>`);
      }

      if (!items.length) {
        marketFeed.innerHTML = `<div class="market-log-empty">${onlyActive ? "No active listings or swaps yet." : "No marketplace activity yet."}</div>`;
        return;
      }
      marketFeed.innerHTML = items.reverse().join("");
      bindFeedPreviewClicks();
      bindFeedActions();
      hydrateMarketFeedThumbnails().catch(() => {
        // Keep feed visible even if thumbnail hydration fails.
      });
    } catch (err) {
      marketFeed.innerHTML = `<div class="market-log-empty">Failed to load: ${escapeHtml(err.message || String(err))}</div>`;
      if (feedStatus) setStatus(feedStatus, "Market feed unavailable. Check RPC connectivity.", "error");
    }
  }

  function bindFeedActions() {
    if (!marketFeed) return;
    marketFeed.querySelectorAll("[data-market-action]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const action = btn.dataset.marketAction;
        const id = Number(btn.dataset.id || "0");
        if (!id) return;
        btn.disabled = true;
        btn.textContent = "...";
        try {
          await ensureWritableContract();
          await requireRobinhoodNetwork();
          ensureMarketplaceConfigured();
          if (action === "buy-listing") {
            const listing = await marketRead.listings(id);
            if (!listing.active) throw new Error("Listing no longer active.");
            if (Number(listing.kind) === 1) {
              const tx = await marketWrite.buyWithEth(id, { value: listing.price });
              await tx.wait();
            } else if (Number(listing.kind) === 2) {
              const payToken = new ethers.Contract(listing.paymentToken, erc20MetaAbi, signer);
              const allowance = await payToken.allowance(account, marketplaceAddress());
              if (allowance < listing.price) {
                const approveTx = await payToken.approve(marketplaceAddress(), listing.price);
                await approveTx.wait();
              }
              const tx = await marketWrite.buyWithToken(id);
              await tx.wait();
            }
          } else if (action === "cancel-listing") {
            const tx = await marketWrite.cancelListing(id);
            await tx.wait();
          } else if (action === "accept-swap") {
            const tx = await marketWrite.acceptSwapOffer(id);
            await tx.wait();
          } else if (action === "cancel-swap") {
            const tx = await marketWrite.cancelSwapOffer(id);
            await tx.wait();
          }
          await refreshMarketplaceFeed();
          await loadOwnedTokens();
        } catch (err) {
          btn.textContent = "Error";
          btn.disabled = false;
          const feedStatus = document.getElementById("marketFeedStatus");
          if (feedStatus) setStatus(feedStatus, err.message || String(err), "error");
        }
      });
    });
  }

  function bindFeedPreviewClicks() {
    if (!marketFeed) return;
    marketFeed.querySelectorAll(".market-log-item").forEach((row) => {
      row.addEventListener("click", async (event) => {
        if (event.target instanceof HTMLElement && event.target.closest("[data-market-action]")) return;
        const item = {
          type: row.getAttribute("data-item-type") || "",
          id: row.getAttribute("data-item-id") || "",
          active: row.getAttribute("data-item-active") || "false",
          nft: row.getAttribute("data-item-nft") || "",
          tokenId: row.getAttribute("data-item-token-id") || "",
          priceText: row.getAttribute("data-item-price-text") || "",
          ownerText: row.getAttribute("data-item-owner-text") || "",
        };
        await openMarketItemModal(item);
      });
    });
  }

  /* ── Quantity stepper ────────────────────────────── */
  function clampQty() {
    let v = Number(qtyInput.value) || 1;
    v = Math.max(1, Math.min(UI_MAX_MINTS_PER_WALLET, v));
    qtyInput.value = v;
    updateCostDisplay();
  }
  if (qtyMinus) {
    qtyMinus.addEventListener("click", () => {
      qtyInput.value = Math.max(1, (Number(qtyInput.value) || 1) - 1);
      updateCostDisplay();
    });
  }
  if (qtyPlus) {
    qtyPlus.addEventListener("click", () => {
      qtyInput.value = Math.min(UI_MAX_MINTS_PER_WALLET, (Number(qtyInput.value) || 1) + 1);
      updateCostDisplay();
    });
  }
  if (qtyInput) {
    qtyInput.addEventListener("input", clampQty);
    qtyInput.addEventListener("change", clampQty);
  }

  /* ── Event listeners ─────────────────────────────── */
  connectBtn.addEventListener("click", async () => {
    setButtonLoading(connectBtn, true, "Connecting...");
    try {
      await connectOnRobinhoodNetwork();
      await loadOwnedTokens();
      await refreshMarketplaceFeed();
    } catch (err) {
      setStatus(connectStatus, err.message || err, "error");
    } finally {
      setButtonLoading(connectBtn, false);
    }
  });

  switchBtn.addEventListener("click", async () => {
    setButtonLoading(switchBtn, true, "Switching...");
    try {
      await switchNetwork();
      await refreshMintInfo();
      await refreshFaucetStatus();
      await refreshMarketplaceFeed();
    } catch (err) {
      setStatus(connectStatus, err.message || err, "error");
    } finally {
      setButtonLoading(switchBtn, false);
    }
  });

  mintBtn.addEventListener("click", () => mint());

  if (faucetClaimBtn) {
    faucetClaimBtn.addEventListener("click", claimFromFaucet);
  }

  refreshBtn.addEventListener("click", async () => {
    setButtonLoading(refreshBtn, true, "Loading...");
    try {
      await loadOwnedTokens();
      await refreshFaucetStatus();
      await refreshMarketplaceFeed();
      setStatus(mintStatus, "");
    } catch (err) {
      setStatus(mintStatus, err.message || err, "error");
    } finally {
      setButtonLoading(refreshBtn, false);
    }
  });

  if (nftModalClose) {
    nftModalClose.addEventListener("click", closeNftModal);
  }
  if (nftModalBackdrop) {
    nftModalBackdrop.addEventListener("click", (event) => {
      if (event.target === nftModalBackdrop) {
        closeNftModal();
      }
    });
  }
  if (nftModalShareX) {
    nftModalShareX.addEventListener("click", shareSelectedNftOnX);
  }
  if (nftModalCopyImage) {
    nftModalCopyImage.addEventListener("click", copySelectedNftImageLink);
  }
  if (nftModalDownloadImage) {
    nftModalDownloadImage.addEventListener("click", downloadSelectedNftImage);
  }
  if (nftModalSend) {
    nftModalSend.addEventListener("click", sendSelectedNftTokens);
  }
  if (marketCreateListingBtn) {
    marketCreateListingBtn.addEventListener("click", createListing);
  }
  if (marketListCollection) {
    marketListCollection.addEventListener("change", refreshOwnedBrokerSelectors);
  }
  if (marketSwapOfferedCollection) {
    marketSwapOfferedCollection.addEventListener("change", refreshOwnedBrokerSelectors);
  }
  if (marketListType) {
    marketListType.addEventListener("change", updateListingTypeUi);
  }
  if (marketLoadListingBtn) {
    marketLoadListingBtn.addEventListener("click", loadListingById);
  }
  if (marketBuyListingBtn) {
    marketBuyListingBtn.addEventListener("click", buyLoadedListing);
  }
  if (marketCancelListingBtn) {
    marketCancelListingBtn.addEventListener("click", cancelListingById);
  }
  if (marketCreateSwapBtn) {
    marketCreateSwapBtn.addEventListener("click", createSwap);
  }
  if (marketLoadSwapBtn) {
    marketLoadSwapBtn.addEventListener("click", loadSwapById);
  }
  if (marketAcceptSwapBtn) {
    marketAcceptSwapBtn.addEventListener("click", acceptSwapById);
  }
  if (marketCancelSwapBtn) {
    marketCancelSwapBtn.addEventListener("click", cancelSwapById);
  }
  if (marketRefreshBtn) {
    marketRefreshBtn.addEventListener("click", refreshMarketplaceFeed);
  }
  if (marketModalClose) {
    marketModalClose.addEventListener("click", closeMarketItemModal);
  }
  if (marketModalBackdrop) {
    marketModalBackdrop.addEventListener("click", (event) => {
      if (event.target === marketModalBackdrop) {
        closeMarketItemModal();
      }
    });
  }
  const marketFilterActive = document.getElementById("marketFilterActive");
  if (marketFilterActive) {
    marketFilterActive.addEventListener("change", refreshMarketplaceFeed);
  }
  document.querySelectorAll(".market-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.marketTab;
      document.querySelectorAll(".market-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".market-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const panel = document.querySelector(`[data-market-panel="${target}"]`);
      if (panel) panel.classList.add("active");
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNftModal();
      closeMarketItemModal();
    }
  });

  /* ── Init ────────────────────────────────────────── */
  configureLinks();
  populateMarketplaceTokenSelect();
  refreshOwnedBrokerSelectors();
  updateListingTypeUi();
  bindWalletEvents();
  renderCollage();
  rotateHeroPreview();
  updateCostDisplay();
  showEmptyState();
  // Keep initial load fully read-only and non-interactive with wallet.
  // No wallet RPC calls until user presses Connect/Switch.
  refreshPublicMintInfo();
  refreshFaucetStatus();
  refreshMarketplaceFeed();
  hideLoader();
})();
