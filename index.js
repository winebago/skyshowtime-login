// index.js
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const app = express();

// ZADRÁTOVANÉ PŘIHLAŠOVACÍ ÚDAJE
const SKY_EMAIL = 'tomas.vyskocil@seznam.cz';
const SKY_PASSWORD = 'Gebruq-rimwum-5nawzu';

async function loginAndGetToken() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  let jwtToken = null;

  page.on('request', request => {
    const headers = request.headers();
    if (headers['authorization'] && headers['authorization'].includes('Bearer')) {
      jwtToken = headers['authorization'];
      console.log('🎯 JWT zachycen:', jwtToken);
    }
  });

  try {
    await page.goto('https://www.skyshowtime.com/cz/signin', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 5000 });
    await page.click('#onetrust-accept-btn-handler');
    await page.waitForTimeout(1000);

    await page.type('input[name="userIdentifier"]', SKY_EMAIL);
    await page.type('input[name="password"]', SKY_PASSWORD);

    await page.evaluate(() => {
      const checkbox = document.querySelector('input[name="rememberMe"]');
      if (checkbox) checkbox.checked = false;
    });

    await page.evaluate(() => {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'isWeb';
      hidden.value = 'true';
      document.querySelector('form').appendChild(hidden);
    });

    await page.click('[data-testid="sign-in-form__submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    const html = await page.content();
    fs.writeFileSync('after-login.html', html, 'utf8');
  } catch (err) {
    console.error('❌ Chyba při přihlášení:', err);
  }

  await browser.close();
  return jwtToken;
}

app.get('/', (req, res) => {
  res.send('Vítej! Použij /sky-token pro získání JWT tokenu.');
});

app.get('/sky-token', async (req, res) => {
  try {
    const token = await loginAndGetToken();
    if (token) {
      res.json({ jwt: token });
    } else {
      res.status(404).json({ error: 'Token nebyl nalezen.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ Server běží na portu', PORT);
});
