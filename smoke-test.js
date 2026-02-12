/**
 * Smoke Test for Stonk Brokers UI
 * Tests front-end functionality without wallet actions requiring private keys
 * 
 * Run with: node smoke-test.js
 * Requires: npm install puppeteer
 */

const puppeteer = require('puppeteer');

const TEST_URL = 'http://127.0.0.1:8080/ui/';
const TIMEOUT = 30000;

// Test results collector
const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(severity, test, message) {
  const entry = { severity, test, message };
  if (severity === 'PASS') results.passed.push(entry);
  else if (severity === 'FAIL') results.failed.push(entry);
  else if (severity === 'WARN') results.warnings.push(entry);
  
  console.log(`[${severity}] ${test}: ${message}`);
}

async function runSmokeTest() {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  try {
    console.log('\n=== Starting Smoke Test ===\n');
    
    // Test 1: Page loads without blank/error
    console.log('Test 1: Page Load');
    const response = await page.goto(TEST_URL, { 
      waitUntil: 'networkidle2',
      timeout: TIMEOUT 
    });
    
    if (response.status() === 200) {
      log('PASS', 'Page Load', `HTTP 200 - Page loaded successfully`);
    } else {
      log('FAIL', 'Page Load', `HTTP ${response.status()} - Expected 200`);
    }
    
    // Wait for app loader to disappear
    await page.waitForFunction(
      () => {
        const loader = document.getElementById('appLoader');
        return loader && loader.classList.contains('hidden');
      },
      { timeout: 10000 }
    ).catch(() => {
      log('WARN', 'Page Load', 'App loader did not hide within 10s');
    });
    
    // Test 2: Key sections visible
    console.log('\nTest 2: Key Sections Visibility');
    
    const sections = {
      'Hero Section': '.hero',
      'Mint Section': '#mintBtn',
      'Network Section': '#switchBtn',
      'My Stonk Brokers': '#tokenList',
      'Marketplace': '.market-tabs'
    };
    
    for (const [name, selector] of Object.entries(sections)) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isIntersectingViewport();
        if (isVisible) {
          log('PASS', 'Section Visibility', `${name} is visible`);
        } else {
          log('WARN', 'Section Visibility', `${name} exists but not in viewport`);
        }
      } else {
        log('FAIL', 'Section Visibility', `${name} (${selector}) not found`);
      }
    }
    
    // Test 3: Hero section content
    console.log('\nTest 3: Hero Section Content');
    const heroTitle = await page.$eval('.hero h1', el => el.textContent).catch(() => null);
    if (heroTitle && heroTitle.includes('Pixel')) {
      log('PASS', 'Hero Content', `Title present: "${heroTitle.trim()}"`);
    } else {
      log('FAIL', 'Hero Content', `Title missing or incorrect: "${heroTitle}"`);
    }
    
    const heroPreview = await page.$('.hero-preview img');
    if (heroPreview) {
      const src = await page.evaluate(el => el.src, heroPreview);
      log('PASS', 'Hero Content', `Preview image present: ${src}`);
    } else {
      log('FAIL', 'Hero Content', 'Preview image not found');
    }
    
    // Test 4: Marketplace tabs switch correctly
    console.log('\nTest 4: Marketplace Tab Switching');
    
    const tabs = await page.$$('.market-tab');
    if (tabs.length >= 4) {
      log('PASS', 'Marketplace Tabs', `Found ${tabs.length} tabs`);
      
      // Test switching to each tab
      const tabNames = ['feed', 'sell', 'swap', 'manage'];
      for (const tabName of tabNames) {
        await page.click(`[data-market-tab="${tabName}"]`);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const isActive = await page.$eval(
          `[data-market-tab="${tabName}"]`,
          el => el.classList.contains('active')
        );
        
        const panelVisible = await page.$eval(
          `[data-market-panel="${tabName}"]`,
          el => el.classList.contains('active')
        );
        
        if (isActive && panelVisible) {
          log('PASS', 'Tab Switching', `"${tabName}" tab switches correctly`);
        } else {
          log('FAIL', 'Tab Switching', `"${tabName}" tab failed - active:${isActive}, panel:${panelVisible}`);
        }
      }
    } else {
      log('FAIL', 'Marketplace Tabs', `Expected 4 tabs, found ${tabs.length}`);
    }
    
    // Test 5: Feed renders
    console.log('\nTest 5: Marketplace Feed');
    await page.click('[data-market-tab="feed"]');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const feedElement = await page.$('#marketFeed');
    if (feedElement) {
      const feedContent = await page.$eval('#marketFeed', el => el.textContent);
      if (feedContent.includes('Connect wallet') || feedContent.includes('No active')) {
        log('PASS', 'Marketplace Feed', `Feed renders with message: "${feedContent.trim().substring(0, 50)}..."`);
      } else {
        log('WARN', 'Marketplace Feed', `Feed has unexpected content: "${feedContent.trim().substring(0, 50)}..."`);
      }
    } else {
      log('FAIL', 'Marketplace Feed', 'Feed element not found');
    }
    
    // Test 6: Modal functionality (NFT modal)
    console.log('\nTest 6: NFT Modal Open/Close');
    
    const nftModalBackdrop = await page.$('#nftModalBackdrop');
    if (nftModalBackdrop) {
      const initiallyHidden = await page.$eval(
        '#nftModalBackdrop',
        el => !el.classList.contains('open')
      );
      
      if (initiallyHidden) {
        log('PASS', 'NFT Modal', 'Modal initially hidden');
      } else {
        log('FAIL', 'NFT Modal', 'Modal should be hidden initially');
      }
      
      // Check if close button exists
      const closeBtn = await page.$('#nftModalClose');
      if (closeBtn) {
        log('PASS', 'NFT Modal', 'Close button present');
      } else {
        log('FAIL', 'NFT Modal', 'Close button not found');
      }
    } else {
      log('FAIL', 'NFT Modal', 'Modal backdrop not found');
    }
    
    // Test 7: Market modal
    console.log('\nTest 7: Market Modal Open/Close');
    
    const marketModalBackdrop = await page.$('#marketModalBackdrop');
    if (marketModalBackdrop) {
      const initiallyHidden = await page.$eval(
        '#marketModalBackdrop',
        el => !el.classList.contains('open')
      );
      
      if (initiallyHidden) {
        log('PASS', 'Market Modal', 'Modal initially hidden');
      } else {
        log('FAIL', 'Market Modal', 'Modal should be hidden initially');
      }
      
      const closeBtn = await page.$('#marketModalClose');
      if (closeBtn) {
        log('PASS', 'Market Modal', 'Close button present');
      }
    } else {
      log('FAIL', 'Market Modal', 'Modal backdrop not found');
    }
    
    // Test 8: Check for runtime errors
    console.log('\nTest 8: Runtime Errors');
    
    if (consoleErrors.length === 0 && pageErrors.length === 0) {
      log('PASS', 'Runtime Errors', 'No console or page errors detected');
    } else {
      if (consoleErrors.length > 0) {
        consoleErrors.forEach((err, i) => {
          log('FAIL', 'Console Error', `${err}`);
        });
      }
      if (pageErrors.length > 0) {
        pageErrors.forEach((err, i) => {
          log('FAIL', 'Page Error', `${err}`);
        });
      }
    }
    
    // Test 9: Interactive elements present
    console.log('\nTest 9: Interactive Elements');
    
    const interactiveElements = {
      'Connect Wallet Button': '#connectBtn',
      'Mint Button': '#mintBtn',
      'Switch Network Button': '#switchBtn',
      'Refresh Button': '#refreshBtn',
      'Quantity Stepper': '.qty-stepper'
    };
    
    for (const [name, selector] of Object.entries(interactiveElements)) {
      const element = await page.$(selector);
      if (element) {
        log('PASS', 'Interactive Elements', `${name} present`);
      } else {
        log('FAIL', 'Interactive Elements', `${name} (${selector}) not found`);
      }
    }
    
    // Test 10: Background and styling
    console.log('\nTest 10: Visual Elements');
    
    const bgCollage = await page.$('#bgCollage');
    if (bgCollage) {
      log('PASS', 'Visual Elements', 'Background collage element present');
    } else {
      log('WARN', 'Visual Elements', 'Background collage not found');
    }
    
    const brandLogo = await page.$('.brand-logo img');
    if (brandLogo) {
      log('PASS', 'Visual Elements', 'Brand logo present');
    } else {
      log('FAIL', 'Visual Elements', 'Brand logo not found');
    }
    
  } catch (error) {
    log('FAIL', 'Test Execution', `Fatal error: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  // Print summary
  console.log('\n=== Test Summary ===\n');
  console.log(`✓ PASSED: ${results.passed.length}`);
  console.log(`✗ FAILED: ${results.failed.length}`);
  console.log(`⚠ WARNINGS: ${results.warnings.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n=== Failed Tests ===');
    results.failed.forEach(r => {
      console.log(`[${r.severity}] ${r.test}: ${r.message}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n=== Warnings ===');
    results.warnings.forEach(r => {
      console.log(`[${r.severity}] ${r.test}: ${r.message}`);
    });
  }
  
  console.log('\n=== End of Smoke Test ===\n');
  
  // Exit with error code if tests failed
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run the test
runSmokeTest().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
