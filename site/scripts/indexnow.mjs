// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver) about every page in the built sitemap.
// Google does not use IndexNow; it reads the sitemap submitted in Search Console.
import { readdirSync, readFileSync } from 'node:fs';
const host = 'postdelegate.com';
const key = readdirSync('public').find((file) => /^[0-9a-f]{32}\.txt$/.test(file))?.slice(0, -4);
if (!key) { console.error('No IndexNow key file in public/.'); process.exit(1); }
const urlList = readdirSync('dist').filter((file) => /^sitemap-\d+\.xml$/.test(file))
  .flatMap((file) => [...readFileSync(`dist/${file}`, 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]));
const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList }),
});
console.log(`IndexNow: submitted ${urlList.length} URLs, HTTP ${response.status}`);
if (!response.ok) process.exit(1);
