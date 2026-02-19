const puppeteer = require('puppeteer');

async function debugProdConsole() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[CONSOLE ${type.toUpperCase()}] ${text}`);
    });

    console.log('\n=== Step 1: Navigate to production options ===');
    await page.goto('https://www.stonkbrokers.cash/options', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    console.log('✓ Page loaded');
    
    console.log('\n=== Step 2: Wait 5 seconds ===');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n=== Step 3: Run diagnostic commands ===\n');
    
    // Command 1: Check loaded scripts
    console.log('--- Command 1: Check loaded scripts ---');
    const scriptsResult = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      console.log('Scripts:', scripts.length, scripts.filter(s => s.includes('options')));
      return {
        totalScripts: scripts.length,
        optionsScripts: scripts.filter(s => s.includes('options')),
        allScripts: scripts
      };
    });
    
    console.log('Total scripts:', scriptsResult.totalScripts);
    console.log('Options-related scripts:', scriptsResult.optionsScripts);
    console.log('All script URLs:', scriptsResult.allScripts.slice(0, 10));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: 'console-1-scripts.png', fullPage: false });
    console.log('✓ Screenshot 1 saved\n');
    
    // Command 2: Search for vault addresses
    console.log('--- Command 2: Search for vault addresses ---');
    const addressResult = await page.evaluate(() => {
      const allScripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('');
      const match055 = allScripts.includes('055d84908672b9be53275963862614aEA9CDB98B');
      const match631 = allScripts.includes('631f9371Fd6B2C85F8f61d19A90547eE67Fa61A2');
      console.log('Has vault addr (055d84...):', match055, 'Has factory addr (631f93...):', match631);
      
      // Also search for any 0x addresses
      const addresses = allScripts.match(/0x[a-fA-F0-9]{40}/g) || [];
      const uniqueAddresses = [...new Set(addresses)];
      
      return {
        hasVaultAddr: match055,
        hasFactoryAddr: match631,
        foundAddresses: uniqueAddresses.slice(0, 10)
      };
    });
    
    console.log('Has vault address (055d84...):', addressResult.hasVaultAddr);
    console.log('Has factory address (631f93...):', addressResult.hasFactoryAddr);
    console.log('Found addresses in scripts:', addressResult.foundAddresses);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: 'console-2-addresses.png', fullPage: false });
    console.log('✓ Screenshot 2 saved\n');
    
    // Command 3: Test nextOfferId RPC call
    console.log('--- Command 3: Test nextOfferId RPC call ---');
    const rpcResult = await page.evaluate(async () => {
      const data = '0x5f5d0655';
      try {
        const response = await fetch('https://rpc.testnet.chain.robinhood.com', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{
              to: '0x055d84908672b9be53275963862614aEA9CDB98B',
              data: data
            }, 'latest'],
            id: 1
          })
        });
        
        const result = await response.json();
        console.log('nextOfferId:', result);
        
        return {
          success: true,
          status: response.status,
          result: result
        };
      } catch (error) {
        console.error('RPC call failed:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('RPC call success:', rpcResult.success);
    console.log('RPC status:', rpcResult.status);
    console.log('RPC result:', JSON.stringify(rpcResult.result, null, 2));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: 'console-3-rpc.png', fullPage: false });
    console.log('✓ Screenshot 3 saved\n');
    
    // Additional diagnostic: Check if contract exists
    console.log('--- Additional: Check if contract has code ---');
    const codeCheck = await page.evaluate(async () => {
      try {
        const response = await fetch('https://rpc.testnet.chain.robinhood.com', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getCode',
            params: ['0x055d84908672b9be53275963862614aEA9CDB98B', 'latest'],
            id: 1
          })
        });
        
        const result = await response.json();
        console.log('Contract code check:', result);
        
        return {
          success: true,
          result: result.result,
          hasCode: result.result && result.result !== '0x'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('Contract code check success:', codeCheck.success);
    console.log('Has contract code:', codeCheck.hasCode);
    console.log('Code length:', codeCheck.result ? codeCheck.result.length : 0);
    
    // Check for getLogs approach
    console.log('\n--- Additional: Check for getLogs/events approach ---');
    const logsCheck = await page.evaluate(() => {
      const allScripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('');
      
      return {
        hasGetLogs: allScripts.includes('getLogs') || allScripts.includes('eth_getLogs'),
        hasReadContract: allScripts.includes('readContract'),
        hasOfferCreated: allScripts.includes('OfferCreated'),
        hasEventListener: allScripts.includes('event') && allScripts.includes('logs')
      };
    });
    
    console.log('Uses getLogs:', logsCheck.hasGetLogs);
    console.log('Uses readContract:', logsCheck.hasReadContract);
    console.log('Has OfferCreated event:', logsCheck.hasOfferCreated);
    console.log('Has event listener pattern:', logsCheck.hasEventListener);
    
    console.log('\n✅ Diagnostics complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await browser.close();
  }
}

debugProdConsole().catch(console.error);
