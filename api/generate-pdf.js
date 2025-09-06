// api/generate-pdf.js
import { NextRequest, NextResponse } from 'next/server';

// Set maximum duration for this function
export const maxDuration = 30; // 30 seconds
export const dynamic = 'force-dynamic';

// Dynamic imports to prevent bundling issues
let puppeteer;
let chromium;

async function initializePuppeteer() {
  // Check if running locally or on Vercel
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Production: Use puppeteer-core with @sparticuz/chromium
    const puppeteerCore = await import('puppeteer-core');
    const chromiumPackage = await import('@sparticuz/chromium');

    puppeteer = puppeteerCore.default;
    chromium = chromiumPackage.default;
  } else {
    // Development: Use regular puppeteer
    const puppeteerFull = await import('puppeteer');
    puppeteer = puppeteerFull.default;
    chromium = null;
  }
}

function validateInput(input) {
  if (typeof input !== 'object' || input === null) return false;
  if (!input.query || typeof input.query.text !== 'string') return false;
  if (!input.result || !input.result.data) return false;
  return true;
}

function extractTopic(queryText) {
  if (!queryText) return 'report';
  const words = queryText.toLowerCase().split(/\s+/);
  const keywords = words.filter(w => w.length > 3);
  return keywords[0] || 'report';
}

function generateHTML(input) {
  const general_script = input?.reasoning?.general_script || [];
  const { concept, practiceAssignment, practiceTest, formula } = input.result?.data || {};

  const rawTimestamp = input.metadata?.timestamp || new Date().toISOString();
  const date = new Date(rawTimestamp).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short', 
    year: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const userQuery = input.query?.text || "Test Report";
  const logoURL = input.metadata?.logo || "https://acadza-check-new.s3.amazonaws.com/P2BIkQ0QMacadzalogolarge.svg";

  let html = `
  <html>
  <head>
    <meta charset="UTF-8">
    <title>${userQuery}</title>
    <script>
      window.MathJax = {
        tex: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
        svg: { fontCache: 'global' }
      };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        padding: 30px;
        color: #333;
        line-height: 1.4;
      }
      .query-block {
        font-size: 13px;
        margin: 4px 0 12px;
      }
      .section-label {
        font-size: 14px;
        font-weight: bold;
        margin: 10px 0 8px;
      }
      h1 {
        font-size: 18px;
        border-bottom: 1px solid #666;
        padding-bottom: 4px;
        margin-top: 16px;
      }
      h2 {
        font-size: 15px;
        margin-top: 14px;
        color: #003366;
      }
      p {
        font-size: 13px;
        margin: 6px 0;
      }
      ul {
        font-size: 13px;
        margin-left: 18px;
        padding-left: 10px;
        list-style-type: disc;
      }
      .callout {
        background-color: #eef7ff;
        border-left: 4px solid #1e90ff;
        padding: 8px;
        margin: 12px 0;
      }
      .quote {
        font-style: italic;
        font-size: 12px;
        margin-top: 14px;
        color: #555;
      }
      .quote-author {
        text-align: right;
        font-size: 11px;
        margin-top: 3px;
      }
      .test-box {
        border: 1.5px solid orange;
        padding: 14px;
        margin-top: 20px;
        background: #fff5e6;
        border-radius: 4px;
      }
      .test-link {
        display: inline-block;
        background: rgb(233, 102, 16);
        color: white;
        padding: 8px 14px;
        text-decoration: none;
        border-radius: 3px;
        font-weight: bold;
        margin-top: 10px;
      }
      .report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }
      .logo-line {
        display: flex;
        align-items: center;
      }
      .logo {
        height: 28px;
        margin-right: 8px;
        border-radius: 4px;
        background-color: white;
        padding: 2px;
      }
      .institution {
        font-weight: bold;
        font-size: 14px;
        color: black;
      }
      .timestamp {
        font-size: 12px;
        color: #555;
      }
      .header-divider {
        border: none;
        border-bottom: 1px solid #ccc;
        margin-bottom: 16px;
      }
      .footer {
        text-align: center;
        margin-top: 40px;
        font-size: 11px;
        color: #aaa;
      }
    </style>
  </head>
  <body>
    <div class="report-header">
      <div class="logo-line">
        <img src="${logoURL}" alt="Logo" class="logo">
        <span class="institution">Chanakya DOST</span>
      </div>
      <div class="timestamp">${date}</div>
    </div>
    <hr class="header-divider" />
    <div class="section-label">Query:</div>
    <p class="query-block">${userQuery}</p>
    <div class="section-label">Response:</div>
`;

  // General script content
  general_script.forEach(block => {
    if (block.heading) html += `<h1>${block.heading}</h1>`;
    if (block.subheading) html += `<h2>${block.subheading}</h2>`;
    if (block.paragraph) html += `<p>${block.paragraph}</p>`;
    if (block.bold) html += `<p><strong>${block.bold}</strong></p>`;
    if (block.bullet) {
      html += `<ul>`;
      block.bullet.forEach(b => html += `<li>${b}</li>`);
      html += `</ul>`;
    }
    if (block.latex) {
      const latex = block.latex.replace(/\\\[|\\\\]/g, '');
      html += `<p><span>\\(${latex}\\)</span></p>`;
    }
    if (block.callout) {
      html += `<div class="callout">${block.callout.content}</div>`;
    }
    if (block.quote) {
      html += `<div class="quote">"${block.quote.content}"</div>`;
      html += `<div class="quote-author">– ${block.quote.author}</div>`;
    }
  });

  // Cards section
  function renderCard(item, titleKey, linkKey, label) {
    return `
      <div class="test-box">
        <p>${item.script}</p>
        <a href="${item[linkKey]}" class="test-link">${label}: ${item[titleKey]}</a>
      </div>
    `;
  }

  if (concept?.length) html += renderCard(concept[0], 'conceptTitle', 'conceptLink', 'Concept');
  if (practiceAssignment?.length) html += renderCard(practiceAssignment[0], 'practiceAssignmentTitle', 'practiceAssignmentLink', 'Assignment');
  if (practiceTest?.length) html += renderCard(practiceTest[0], 'practiceTestTitle', 'practiceTestLink', 'Test');
  if (formula?.length) html += renderCard(formula[0], 'formulaTitle', 'formulaLink', 'Formula Sheet');

  html += `
    <div class="footer">© 2025 Acadza Technologies — Auto-generated report</div>
  </body>
  </html>
  `;

  return html;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    await initializePuppeteer();

    const input = await req.json();

    if (!input) {
      return NextResponse.json({ error: 'No input data provided' }, { status: 400 });
    }

    if (!validateInput(input)) {
      return NextResponse.json({ error: 'Invalid input format' }, { status: 400 });
    }

    const topic = extractTopic(input.query?.text);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${topic}_report_${timestamp}.pdf`;

    let browser;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Production configuration for Vercel
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--hide-scrollbars',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage'
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      // Local development configuration
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await browser.newPage();
    const html = generateHTML(input);

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Wait for MathJax to render
    await page.evaluateHandle(() => {
      return new Promise((resolve) => {
        if (window.MathJax?.typesetPromise) {
          MathJax.typesetPromise().then(resolve);
        } else if (window.MathJax?.startup?.promise) {
          MathJax.startup.promise.then(resolve);
        } else {
          const check = () => {
            if (window.MathJax?.startup?.promise) {
              window.MathJax.startup.promise.then(resolve);
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        }
      });
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '30px', bottom: '30px', left: '30px', right: '30px' }
    });

    await browser.close();

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error.message }, 
      { status: 500 }
    );
  }
}
