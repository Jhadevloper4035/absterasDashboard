import puppeteer from 'puppeteer';
import { existsSync } from 'node:fs';

export async function renderPdf(html) {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium-browser') ? '/usr/bin/chromium-browser' : undefined);
  const browser = await puppeteer.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-crash-reporter', '--disable-features=Crashpad', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } }));
  } finally {
    await browser.close();
  }
}
