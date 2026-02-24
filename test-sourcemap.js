import puppeteer from 'puppeteer';
import handler from 'serve-handler';
import http from 'http';

const server = http.createServer((request, response) => {
  return handler(request, response, { public: 'dist' });
});

server.listen(4000, async () => {
  console.log('Running at http://localhost:4000');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
       console.log('PAGE ERROR:', msg.text());
       msg.args().forEach(arg => console.log(arg.toString()));
    }
  });

  page.on('pageerror', error => {
    console.log('UNCAUGHT EXCEPTION:', error.message);
    console.log('STACK:', error.stack);
  });

  await page.goto('http://localhost:4000/trading-admin', { waitUntil: 'networkidle0' });
  await browser.close();
  server.close();
});
