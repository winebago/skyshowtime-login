// index.js – debug-ready
const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();

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
    console.log('🌐 Načítám přihlašovací stránku...');
    await page.goto('https://www.skyshowtime.com/cz/signin', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    const acceptCookies = await page.$('#onetrust-accept-btn-handler');
    if (acceptCookies) {
      await acceptCookies.click();
      await page.waitForTimeout(1000);
      console.log('🍪 Přijaty cookies');
    }

    console.log('📨 Zadávám přihlašovací údaje...');
    await page.type('input[name="userIdentifier"]', SKY_EMAIL, { delay: 50 });
    await page.type('input[name="password"]', SKY_PASSWORD, { delay: 50 });

    const checkbox = await page.$('input[name="rememberMe"]');
    if (checkbox) await checkbox.click();

    await page.evaluate(() => {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'isWeb';
      hidden.value = 'true';
      document.querySelector('form')?.appendChild(hidden);
    });

    const loginButton = await page.$('[data-testid="sign-in-form__submit"]');
    if (loginButton) {
      await loginButton.click();
      console.log('🔐 Klik na tlačítko přihlášení');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    } else {
      console.log('❌ Nenašel jsem tlačítko přihlášení');
    }

    // Kliknutí na profil (fallback pro ladění)
    const profileBtn = await page.$('.profiles__avatar--image');
    if (profileBtn) {
      await profileBtn.click();
      console.log('👤 Kliknuto na profil');
      await page.waitForTimeout(3000);
    } else {
      console.log('❌ Nenašel jsem profil');
    }

    const html = await page.content();
    fs.writeFileSync('after-login.html', html, 'utf8');
    await page.screenshot({ path: 'screenshot.png', fullPage: true });
    console.log('✅ Uložena stránka a screenshot');
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

app.get('/debug', (req, res) => {
  const filePath = path.join(__dirname, 'after-login.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ Nepodařilo se načíst HTML:', err);
      res.status(500).send('Chyba při načítání HTML');
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(data);
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ Server běží na portu', PORT);
});
