/**
 * Landing Page Screenshot Capture
 * Captures screenshot of the home page at http://localhost:3000
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEST_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = './landing-screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureLandingPage() {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });
  
  const page = await browser.newPage();
  
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  try {
    console.log('\n=== Landing Page Screenshot Capture ===\n');
    
    console.log('Navigating to http://localhost:3000...');
    const response = await page.goto(TEST_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    if (response.status() !== 200) {
      console.error(`❌ Page returned HTTP ${response.status()}`);
    } else {
      console.log('✓ Page loaded successfully (HTTP 200)');
    }
    
    console.log('Waiting 3 seconds for animations and content...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Capture full page screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'landing-page-full.png'),
      fullPage: true
    });
    console.log('✓ Saved: landing-screenshots/landing-page-full.png');
    
    // Capture viewport screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'landing-page-viewport.png'),
      fullPage: false
    });
    console.log('✓ Saved: landing-screenshots/landing-page-viewport.png');
    
    // Analyze page content
    const analysis = await page.evaluate(() => {
      const body = document.body;
      const links = Array.from(document.querySelectorAll('a'));
      const buttons = Array.from(document.querySelectorAll('button'));
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const images = Array.from(document.querySelectorAll('img'));
      
      return {
        title: document.title,
        bodyText: body.innerText.substring(0, 500),
        linkCount: links.length,
        buttonCount: buttons.length,
        headingCount: headings.length,
        imageCount: images.length,
        links: links.slice(0, 10).map(a => ({
          text: a.innerText.trim(),
          href: a.href
        })),
        buttons: buttons.slice(0, 10).map(b => b.innerText.trim()),
        headings: headings.slice(0, 5).map(h => ({
          tag: h.tagName,
          text: h.innerText.trim()
        })),
        backgroundColor: window.getComputedStyle(body).backgroundColor,
        color: window.getComputedStyle(body).color,
        fontFamily: window.getComputedStyle(body).fontFamily
      };
    });
    
    console.log('\n=== Page Analysis ===\n');
    console.log('Title:', analysis.title);
    console.log('Links:', analysis.linkCount);
    console.log('Buttons:', analysis.buttonCount);
    console.log('Headings:', analysis.headingCount);
    console.log('Images:', analysis.imageCount);
    console.log('\nBackground:', analysis.backgroundColor);
    console.log('Text Color:', analysis.color);
    console.log('Font:', analysis.fontFamily);
    
    // Generate report
    const report = `# Landing Page Analysis Report

**Generated:** ${new Date().toISOString()}  
**URL:** ${TEST_URL}

---

## Screenshots

1. Full page: \`landing-screenshots/landing-page-full.png\`
2. Viewport: \`landing-screenshots/landing-page-viewport.png\`

---

## Page Details

**Title:** ${analysis.title}

**Elements:**
- Links: ${analysis.linkCount}
- Buttons: ${analysis.buttonCount}
- Headings: ${analysis.headingCount}
- Images: ${analysis.imageCount}

**Styling:**
- Background: ${analysis.backgroundColor}
- Text Color: ${analysis.color}
- Font: ${analysis.fontFamily}

---

## Top Links

${analysis.links.map(l => `- **${l.text}** → ${l.href}`).join('\n')}

---

## Buttons

${analysis.buttons.map(b => `- ${b}`).join('\n')}

---

## Headings

${analysis.headings.map(h => `- **${h.tag}:** ${h.text}`).join('\n')}

---

## Console Messages

${consoleLogs.length > 0 ? consoleLogs.slice(0, 10).map(c => `[${c.type}] ${c.text}`).join('\n') : 'No console messages.'}

---

## Errors

${pageErrors.length > 0 ? pageErrors.map(e => `- ${e}`).join('\n') : 'No errors detected.'}
`;

    fs.writeFileSync('landing-page-report.md', report);
    console.log('\n✓ Report saved: landing-page-report.md');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n=== Capture Complete ===\n');
}

captureLandingPage().catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});
