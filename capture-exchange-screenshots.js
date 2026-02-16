/**
 * Exchange Page Screenshot Capture Script
 * Captures screenshots of all Exchange tabs (Swap, Pools, Positions)
 * 
 * Run with: node capture-exchange-screenshots.js
 * Requires: puppeteer (already installed)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEST_URL = 'http://localhost:3000/exchange';
const SCREENSHOT_DIR = './exchange-screenshots';

// Create screenshots directory if it doesn't exist
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureExchangeScreenshots() {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });
  
  const page = await browser.newPage();
  
  // Collect console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  
  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  const observations = {
    swap: {},
    pools: {},
    positions: {},
    errors: [],
    console: []
  };

  try {
    console.log('\n=== Exchange Page Screenshot Capture ===\n');
    
    // Step 1: Navigate to the exchange page
    console.log('Step 1: Navigating to http://localhost:3000/exchange...');
    const response = await page.goto(TEST_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    if (response.status() !== 200) {
      console.error(`❌ Page returned HTTP ${response.status()}`);
      observations.errors.push(`HTTP ${response.status()} error`);
    } else {
      console.log('✓ Page loaded successfully (HTTP 200)');
    }
    
    // Step 2: Wait for page to fully load
    console.log('\nStep 2: Waiting 3 seconds for page to fully load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Capture Swap tab (default)
    console.log('\nStep 3: Capturing Swap tab screenshot...');
    
    // Check if Swap tab is active
    const swapTabActive = await page.evaluate(() => {
      const swapTab = document.querySelector('[data-tab="swap"]');
      return swapTab ? swapTab.classList.contains('active') : false;
    }).catch(() => false);
    
    // Analyze Swap tab
    observations.swap = await analyzeTab(page, 'Swap');
    
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, '1-swap-tab.png'),
      fullPage: true
    });
    console.log('✓ Saved: exchange-screenshots/1-swap-tab.png');
    
    // Step 4: Click Pools tab
    console.log('\nStep 4: Clicking on Pools tab...');
    const poolsTabSelector = '[data-tab="pools"], button:has-text("Pools"), .tab:has-text("Pools")';
    
    try {
      // Try multiple selectors
      const poolsClicked = await page.evaluate(() => {
        // Try finding by text content
        const buttons = Array.from(document.querySelectorAll('button, .tab, [role="tab"]'));
        const poolsBtn = buttons.find(el => el.textContent?.trim().toLowerCase() === 'pools');
        if (poolsBtn) {
          poolsBtn.click();
          return true;
        }
        return false;
      });
      
      if (poolsClicked) {
        console.log('✓ Clicked Pools tab');
      } else {
        console.log('⚠ Could not find Pools tab button');
        observations.errors.push('Pools tab button not found');
      }
    } catch (error) {
      console.log('⚠ Error clicking Pools tab:', error.message);
      observations.errors.push(`Pools tab click error: ${error.message}`);
    }
    
    // Step 5: Wait and capture Pools tab
    console.log('\nStep 5: Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    observations.pools = await analyzeTab(page, 'Pools');
    
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, '2-pools-tab.png'),
      fullPage: true
    });
    console.log('✓ Saved: exchange-screenshots/2-pools-tab.png');
    
    // Step 6: Click Positions tab
    console.log('\nStep 6: Clicking on Positions tab...');
    
    try {
      const positionsClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, .tab, [role="tab"]'));
        const posBtn = buttons.find(el => el.textContent?.trim().toLowerCase() === 'positions');
        if (posBtn) {
          posBtn.click();
          return true;
        }
        return false;
      });
      
      if (positionsClicked) {
        console.log('✓ Clicked Positions tab');
      } else {
        console.log('⚠ Could not find Positions tab button');
        observations.errors.push('Positions tab button not found');
      }
    } catch (error) {
      console.log('⚠ Error clicking Positions tab:', error.message);
      observations.errors.push(`Positions tab click error: ${error.message}`);
    }
    
    // Step 7: Wait and capture Positions tab
    console.log('\nStep 7: Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    observations.positions = await analyzeTab(page, 'Positions');
    
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, '3-positions-tab.png'),
      fullPage: true
    });
    console.log('✓ Saved: exchange-screenshots/3-positions-tab.png');
    
    // Collect final errors
    observations.console = consoleLogs;
    observations.errors.push(...pageErrors);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    observations.errors.push(`Fatal: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  // Generate detailed report
  generateReport(observations);
  
  console.log('\n=== Screenshot Capture Complete ===\n');
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);
  console.log('Report saved to: exchange-analysis-report.md\n');
}

async function analyzeTab(page, tabName) {
  const analysis = {
    tabName,
    visible: false,
    layout: {},
    elements: {},
    styling: {},
    issues: []
  };
  
  try {
    // Check if tab content is visible
    analysis.visible = await page.evaluate(() => {
      const body = document.body;
      return body && body.offsetHeight > 0;
    });
    
    // Analyze layout
    analysis.layout = await page.evaluate(() => {
      const body = document.body;
      const panels = document.querySelectorAll('[class*="panel"], [class*="Panel"]');
      const inputs = document.querySelectorAll('input, select, textarea');
      const buttons = document.querySelectorAll('button');
      
      return {
        bodyHeight: body.offsetHeight,
        bodyWidth: body.offsetWidth,
        panelCount: panels.length,
        inputCount: inputs.length,
        buttonCount: buttons.length
      };
    });
    
    // Check for specific elements
    analysis.elements = await page.evaluate(() => {
      const hasHeader = !!document.querySelector('header, [role="banner"]');
      const hasTabs = !!document.querySelector('[role="tablist"], .tabs, [class*="tab"]');
      const hasInputs = !!document.querySelector('input[type="text"], input[type="number"]');
      const hasDropdowns = !!document.querySelector('select, [role="combobox"]');
      const hasButtons = !!document.querySelector('button');
      const hasTable = !!document.querySelector('table, [role="table"]');
      
      return {
        header: hasHeader,
        tabs: hasTabs,
        inputs: hasInputs,
        dropdowns: hasDropdowns,
        buttons: hasButtons,
        table: hasTable
      };
    });
    
    // Check styling
    analysis.styling = await page.evaluate(() => {
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);
      
      return {
        backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color,
        fontFamily: computedStyle.fontFamily,
        fontSize: computedStyle.fontSize
      };
    });
    
    // Check for empty states or errors
    const pageText = await page.evaluate(() => document.body.innerText);
    
    if (pageText.toLowerCase().includes('error')) {
      analysis.issues.push('Page contains error text');
    }
    if (pageText.toLowerCase().includes('not found')) {
      analysis.issues.push('Page contains "not found" text');
    }
    if (pageText.length < 50) {
      analysis.issues.push('Very little content on page');
    }
    
  } catch (error) {
    analysis.issues.push(`Analysis error: ${error.message}`);
  }
  
  return analysis;
}

function generateReport(observations) {
  const report = `# Exchange Page Analysis Report

**Generated:** ${new Date().toISOString()}  
**URL:** http://localhost:3000/exchange

---

## Screenshots Captured

1. ✓ Swap tab: \`exchange-screenshots/1-swap-tab.png\`
2. ✓ Pools tab: \`exchange-screenshots/2-pools-tab.png\`
3. ✓ Positions tab: \`exchange-screenshots/3-positions-tab.png\`

---

## Swap Tab Analysis

${formatTabAnalysis(observations.swap)}

---

## Pools Tab Analysis

${formatTabAnalysis(observations.pools)}

---

## Positions Tab Analysis

${formatTabAnalysis(observations.positions)}

---

## Errors Detected

${observations.errors.length > 0 ? observations.errors.map(e => `- ${e}`).join('\n') : 'No errors detected.'}

---

## Console Messages

${observations.console.length > 0 ? 
  observations.console.slice(0, 20).map(c => `[${c.type}] ${c.text}`).join('\n') : 
  'No console messages captured.'}

---

## Recommendations

${generateRecommendations(observations)}
`;

  fs.writeFileSync('exchange-analysis-report.md', report);
}

function formatTabAnalysis(analysis) {
  if (!analysis || !analysis.tabName) return 'No data available.';
  
  return `
### Layout
- Visible: ${analysis.visible ? '✓ Yes' : '❌ No'}
- Body dimensions: ${analysis.layout.bodyWidth}px × ${analysis.layout.bodyHeight}px
- Panels: ${analysis.layout.panelCount}
- Input fields: ${analysis.layout.inputCount}
- Buttons: ${analysis.layout.buttonCount}

### Elements Present
- Header: ${analysis.elements.header ? '✓' : '❌'}
- Tabs: ${analysis.elements.tabs ? '✓' : '❌'}
- Input fields: ${analysis.elements.inputs ? '✓' : '❌'}
- Dropdowns: ${analysis.elements.dropdowns ? '✓' : '❌'}
- Buttons: ${analysis.elements.buttons ? '✓' : '❌'}
- Table: ${analysis.elements.table ? '✓' : '❌'}

### Styling
- Background: ${analysis.styling.backgroundColor}
- Text color: ${analysis.styling.color}
- Font: ${analysis.styling.fontFamily}
- Font size: ${analysis.styling.fontSize}

### Issues
${analysis.issues.length > 0 ? analysis.issues.map(i => `- ⚠️ ${i}`).join('\n') : '- No issues detected'}
`;
}

function generateRecommendations(observations) {
  const recs = [];
  
  if (observations.errors.length > 0) {
    recs.push('- Fix page errors before proceeding with further testing');
  }
  
  if (!observations.swap.visible || !observations.pools.visible || !observations.positions.visible) {
    recs.push('- Some tabs may not be rendering correctly - check console for errors');
  }
  
  if (observations.swap.layout.inputCount === 0 && observations.swap.tabName === 'Swap') {
    recs.push('- Swap tab should have input fields for token amounts');
  }
  
  if (recs.length === 0) {
    recs.push('- All tabs appear to be functioning correctly');
    recs.push('- Review screenshots for visual quality and styling');
  }
  
  return recs.join('\n');
}

// Run the capture
captureExchangeScreenshots().catch(error => {
  console.error('Screenshot capture failed:', error);
  process.exit(1);
});
