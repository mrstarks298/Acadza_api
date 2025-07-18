const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Import the PDF generation logic
const puppeteer = require('puppeteer');

// Generate HTML function (same as in API)
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
        tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']] },
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

  // General script
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
      const latex = block.latex.replace(/\\\[|\\\]/g, '');
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

  // Cards
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

function validateInput(input) {
  if (typeof input !== 'object' || input === null) return false;
  if (!input.query || typeof input.query.text !== 'string') return false;
  if (!input.result || !input.result.data) return false;
  // Add more checks as needed for your structure
  return true;
}

// Create server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve index.html
  if (pathname === '/' || pathname === '/index.html') {
    try {
      const html = fs.readFileSync('index.html', 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('index.html not found');
    }
    return;
  }

  // PDF generation endpoint
  if (pathname === '/api/generate-pdf' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const input = JSON.parse(body);

        // Validate input format
        if (!validateInput(input)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid input.json format' }));
          return;
        }

        // Generate PDF
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        const html = generateHTML(input);

        await page.setContent(html, { waitUntil: 'networkidle0' });

        // Wait for MathJax
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

        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="report.pdf"'
        });
        res.end(pdfBuffer);

      } catch (error) {
        console.error('PDF generation error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PDF generation failed' }));
      }
    });
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📄 Open your browser and go to: http://localhost:${PORT}`);
});