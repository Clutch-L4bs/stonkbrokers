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
  ];
  const erc20Abi = ["function balanceOf(address account) view returns (uint256)"];

  /* ── DOM refs ────────────────────────────────────── */
  const connectBtn = document.getElementById("connectBtn");
  const switchBtn = document.getElementById("switchBtn");
  const mintBtn = document.getElementById("mintBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const faucetLink = document.getElementById("faucetLink");
  const thirdwebLink = document.getElementById("thirdwebLink");
  const contractLink = document.getElementById("contractLink");
  const contractAddr = document.getElementById("contractAddr");
  const qtyInput = document.getElementById("qty");
  const qtyMinus = document.getElementById("qtyMinus");
  const qtyPlus = document.getElementById("qtyPlus");
  const walletLabel = document.getElementById("walletLabel");
  const netDot = document.getElementById("netDot");
  const connectStatus = document.getElementById("connectStatus");
  const mintInfo = document.getElementById("mintInfo");
  const mintStatus = document.getElementById("mintStatus");
  const tokenList = document.getElementById("tokenList");
  const bgCollage = document.getElementById("bgCollage");
  const supplyText = document.getElementById("supplyText");
  const supplyFill = document.getElementById("supplyFill");
  const heroPreviewImg = document.getElementById("heroPreviewImg");
  const nftModalBackdrop = document.getElementById("nftModalBackdrop");
  const nftModalClose = document.getElementById("nftModalClose");
  const nftModalImage = document.getElementById("nftModalImage");
  const nftModalTokenId = document.getElementById("nftModalTokenId");
  const nftModalFundedToken = document.getElementById("nftModalFundedToken");
  const nftModalBalance = document.getElementById("nftModalBalance");
  const nftModalWallet = document.getElementById("nftModalWallet");
  const nftModalShareX = document.getElementById("nftModalShareX");
  const nftModalWalletLink = document.getElementById("nftModalWalletLink");
  const nftModalRecipient = document.getElementById("nftModalRecipient");
  const nftModalAmount = document.getElementById("nftModalAmount");
  const nftModalSend = document.getElementById("nftModalSend");
  const nftModalSendStatus = document.getElementById("nftModalSendStatus");

  let provider;
  let signer;
  let account;
  let nftRead;
  let nftWrite;
  let walletEventsBound = false;
  let isMinting = false;
  let cachedPrice = null;
  let hasUserInitiatedConnect = false;
  const UI_MAX_MINTS_PER_WALLET = 5;
  let walletRemainingMints = UI_MAX_MINTS_PER_WALLET;
  let selectedNft = null;
  const erc20MetaAbi = [
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
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

  function setStatus(el, text, type) {
    if (!el) return;
    el.className = "status";
    if (type === "error") el.classList.add("error");
    else if (type === "ok") el.classList.add("ok");
    else if (type === "pending") el.classList.add("pending");
    el.innerHTML = text || "";
  }

  function setModalSendStatus(text, type) {
    if (!nftModalSendStatus) return;
    nftModalSendStatus.className = "nft-send-status";
    if (type === "error") nftModalSendStatus.classList.add("error");
    else if (type === "ok") nftModalSendStatus.classList.add("ok");
    else if (type === "pending") nftModalSendStatus.classList.add("pending");
    nftModalSendStatus.textContent = text || "";
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

  function expectedChainDecimal() {
    const hex = expectedChainHex();
    return hex ? Number.parseInt(hex, 16) : undefined;
  }

  /* ── Supply bar ──────────────────────────────────── */
  function updateSupplyBar(minted, max) {
    const m = Number(minted);
    const mx = Number(max) || 444;
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

  /* ── Dynamic cost display ────────────────────────── */
  function updateCostDisplay() {
    if (!mintInfo) return;
    const qty = Math.max(1, Math.min(10, Number(qtyInput.value) || 1));
    const limitLabel = `Wallet remaining: ${walletRemainingMints}/${UI_MAX_MINTS_PER_WALLET}`;
    if (cachedPrice) {
      const total = cachedPrice * BigInt(qty);
      const totalEth = ethers.formatEther(total);
      const unitEth = ethers.formatEther(cachedPrice);
      mintInfo.innerHTML = `
        <span>${qty} &times; ${unitEth} ETH =</span>
        <span class="total-cost">${totalEth} ETH</span>
        <span style="color:var(--muted)">${limitLabel}</span>
      `;
    } else {
      mintInfo.innerHTML = `<span style="color:var(--muted)">Connect wallet to see price</span><span style="color:var(--muted)">${limitLabel}</span>`;
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
    if (thirdwebLink) {
      const base = cfg.thirdwebWalletUrl || "https://thirdweb.com/wallets";
      const params = new URLSearchParams();
      if (cfg.thirdwebClientId) params.set("clientId", cfg.thirdwebClientId);
      const chainId = expectedChainDecimal();
      if (chainId) params.set("chainId", String(chainId));
      thirdwebLink.href = params.toString() ? `${base}?${params.toString()}` : base;
    }
    if (contractLink && contractAddr && cfg.nftAddress) {
      const explorer = (cfg.blockExplorerUrl || "").replace(/\/$/, "");
      contractLink.href = explorer ? `${explorer}/address/${cfg.nftAddress}` : "#";
      contractAddr.textContent = short(cfg.nftAddress);
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
    nftRead = new ethers.Contract(cfg.nftAddress, nftAbi, provider);
    if (account) {
      try {
        signer = await provider.getSigner(account);
        nftWrite = nftRead.connect(signer);
      } catch (_err) {
        signer = undefined;
        nftWrite = undefined;
      }
    }
  }

  async function ensureWritableContract() {
    await ensureProvider();
    if (!account) throw new Error("Connect wallet first.");
    signer = await provider.getSigner(account);
    nftWrite = nftRead.connect(signer);
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
          setWalletRemainingFromOwned(0);
          walletLabel.innerHTML = `<span class="net-dot" id="netDot"></span> Not connected`;
          walletLabel.classList.remove("connected");
          showEmptyState();
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
        await loadOwnedTokens();
      } catch (err) {
        setStatus(connectStatus, err.message || err, "error");
      }
    });

    window.ethereum.on("chainChanged", async () => {
      try {
        await ensureProvider();
        if (account) {
          signer = await provider.getSigner(account);
          nftWrite = nftRead.connect(signer);
        }
        await refreshMintInfo();
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
      const [price, supply] = await Promise.all([nftRead.MINT_PRICE(), nftRead.totalSupply()]);
      cachedPrice = price;
      updateSupplyBar(supply, 444);
      updateCostDisplay();
    } catch (_err) {
      // Silently fail on init if wallet not connected
      updateCostDisplay();
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
      const quantity = Math.max(1, Math.min(10, Number(qtyInput.value) || 1));
      const ownedCount = Number(await nftRead.balanceOf(account));
      const remaining = Math.max(0, UI_MAX_MINTS_PER_WALLET - ownedCount);
      setWalletRemainingFromOwned(ownedCount);
      if (remaining <= 0) {
        throw new Error(`UI limit reached: maximum ${UI_MAX_MINTS_PER_WALLET} mints per wallet.`);
      }
      if (quantity > remaining) {
        throw new Error(`UI limit: you can mint up to ${remaining} more from this wallet.`);
      }
      const price = cachedPrice || (await nftRead.MINT_PRICE());
      const value = price * BigInt(quantity);
      setStatus(mintStatus, `<span class="spinner"></span> Sending transaction...`, "pending");
      const tx = await writable.mint(quantity, { value });
      setStatus(mintStatus, `<span class="spinner"></span> Confirming: ${short(tx.hash)}`, "pending");
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
        <div class="empty-icon">&#128188;</div>
        <div>No Stonk Brokers yet. Mint one to get started!</div>
      </div>
    `;
  }

  function openNftModal(nft) {
    if (!nftModalBackdrop || !nftModalImage) return;
    selectedNft = nft;

    nftModalImage.src = `/previews/stonk-broker-${nft.tokenId}.svg`;
    nftModalImage.alt = `Stonk Broker #${nft.tokenId}`;
    if (nftModalTokenId) nftModalTokenId.textContent = `#${nft.tokenId}`;
    if (nftModalFundedToken) nftModalFundedToken.textContent = nft.tokenLabel;
    if (nftModalBalance) nftModalBalance.textContent = nft.displayBalance;
    if (nftModalWallet) nftModalWallet.textContent = nft.wallet;
    if (nftModalRecipient) nftModalRecipient.value = "";
    if (nftModalAmount) nftModalAmount.value = "";
    setModalSendStatus("");

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

  function closeNftModal() {
    if (!nftModalBackdrop) return;
    nftModalBackdrop.classList.remove("open");
    nftModalBackdrop.setAttribute("aria-hidden", "true");
    selectedNft = null;
    setModalSendStatus("");
  }

  function shareSelectedNftOnX() {
    if (!selectedNft) return;
    const explorerBase = (cfg.blockExplorerUrl || "").replace(/\/$/, "");
    const contractUrl = explorerBase ? `${explorerBase}/address/${cfg.nftAddress}` : "";
    const text =
      `I just minted Stonk Broker #${selectedNft.tokenId} on Robinhood Chain Testnet. ` +
      `Wallet funded with ${selectedNft.tokenLabel}. #StonkBrokers #RobinhoodChain`;
    const tweetUrl =
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` +
      (contractUrl ? `&url=${encodeURIComponent(contractUrl)}` : "");
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
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
  async function loadOwnedTokens() {
    if (!account) {
      if (tokenList) {
        tokenList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">&#128274;</div>
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
      const count = Number(await nftRead.balanceOf(account));
      setWalletRemainingFromOwned(count);
      if (count === 0) {
        showEmptyState();
        return;
      }

      const cards = [];
      for (let i = 0; i < count; i++) {
        const tokenId = await nftRead.tokenOfOwnerByIndex(account, i);
        const wallet = await nftRead.tokenWallet(tokenId);
        const fundedTkn = await nftRead.fundedToken(tokenId);
        const stock = new ethers.Contract(fundedTkn, erc20Abi, provider);
        const balance = await stock.balanceOf(wallet);
        const displayBalance = ethers.formatUnits(balance, 18);
        const labels = cfg.stockTokenLabels || {};
        const tokenLabel = labels[fundedTkn] || labels[fundedTkn.toLowerCase()] || short(fundedTkn);
        const badgeClass = tokenCssClass(tokenLabel);
        const explorer = cfg.blockExplorerUrl
          ? `${cfg.blockExplorerUrl.replace(/\/$/, "")}/address/${wallet}`
          : "";
        const explorerLink = explorer
          ? `<a href="${explorer}" target="_blank" rel="noreferrer">view wallet</a>`
          : "";

        cards.push(`
          <div class="nft-card" data-token-id="${tokenId.toString()}" data-wallet="${escapeHtml(wallet)}" data-token-label="${escapeHtml(
          tokenLabel
        )}" data-balance="${escapeHtml(displayBalance)}" data-token-address="${escapeHtml(fundedTkn)}">
            <div class="nft-thumb">
              <img src="/previews/stonk-broker-${tokenId.toString()}.svg"
                   alt="Stonk Broker #${tokenId.toString()}"
                   onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:20px\\'>&#128188;</div>'" />
            </div>
            <div class="nft-details">
              <div class="nft-id">Stonk Broker #${tokenId.toString()}</div>
              <div class="nft-meta">
                <span class="token-badge ${badgeClass}">${tokenLabel}</span>
                &nbsp; <span class="balance-val">${displayBalance}</span> tokens<br/>
                Wallet: <code>${short(wallet)}</code>
                ${explorerLink ? ` &middot; ${explorerLink}` : ""}
              </div>
            </div>
          </div>
        `);
      }
      tokenList.innerHTML = `<div class="nft-grid">${cards.join("")}</div>`;

      tokenList.querySelectorAll(".nft-card").forEach((card) => {
        card.addEventListener("click", (event) => {
          if (event.target instanceof HTMLElement && event.target.closest("a")) return;
          const tokenId = Number(card.getAttribute("data-token-id") || "0");
          const wallet = card.getAttribute("data-wallet") || "";
          const tokenLabel = card.getAttribute("data-token-label") || "";
          const displayBalance = card.getAttribute("data-balance") || "";
          const tokenAddress = card.getAttribute("data-token-address") || "";
          if (!tokenId || !wallet) return;
          openNftModal({ tokenId, wallet, tokenLabel, displayBalance, tokenAddress });
        });
      });
    } catch (err) {
      tokenList.textContent = `Error: ${err.message || err}`;
    }
  }

  /* ── Quantity stepper ────────────────────────────── */
  function clampQty() {
    let v = Number(qtyInput.value) || 1;
    v = Math.max(1, Math.min(10, v));
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
      qtyInput.value = Math.min(10, (Number(qtyInput.value) || 1) + 1);
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
    } catch (err) {
      setStatus(connectStatus, err.message || err, "error");
    } finally {
      setButtonLoading(switchBtn, false);
    }
  });

  mintBtn.addEventListener("click", () => mint());

  refreshBtn.addEventListener("click", async () => {
    setButtonLoading(refreshBtn, true, "Loading...");
    try {
      await loadOwnedTokens();
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
  if (nftModalSend) {
    nftModalSend.addEventListener("click", sendSelectedNftTokens);
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNftModal();
    }
  });

  /* ── Init ────────────────────────────────────────── */
  configureLinks();
  bindWalletEvents();
  renderCollage();
  rotateHeroPreview();
  updateCostDisplay();
  showEmptyState();
  updateNetDot();
  refreshMintInfo();
})();
