/**
 * Gera os ícones do app a partir de public/logo-mark.svg.
 *
 * Uso: npm run icons
 *
 * Produz:
 *   public/favicon.ico        (16/32/48/256, PNG embutido)
 *   public/apple-touch-icon.png (180x180, fundo sólido — iOS não lida bem com alpha)
 *   public/og-image.png       (1200x630, cartão de compartilhamento)
 *
 * Requer o Chromium do Playwright. O blend "multiply" da marca só rende
 * corretamente num motor de renderização real, por isso rasterizamos aqui em
 * vez de usar uma conversão SVG->PNG puramente vetorial.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (p) => resolve(root, 'public', p);

const markSvg = readFileSync(pub('logo-mark.svg'), 'utf8');
const INK = '#0B1220';

/** Envolve um markup numa página de tamanho exato, sem margens. */
const page = (w, h, body, bg = 'transparent') => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;background:${bg};overflow:hidden}
  body{display:flex;align-items:center;justify-content:center}
  svg{display:block}
</style></head><body>${body}</body></html>`;

/** Rasteriza um HTML no tamanho pedido e devolve o PNG. */
async function shot(browser, html, width, height) {
  const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  const buf = await p.screenshot({ omitBackground: true, type: 'png' });
  await p.close();
  return buf;
}

/** Monta um .ico contendo PNGs (formato aceito por todos os navegadores atuais). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: ícone
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 representa 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // paleta
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

try {
  // favicon.ico — várias resoluções para abas, atalhos e barra de favoritos.
  const sizes = [16, 32, 48, 256];
  const images = [];
  for (const size of sizes) {
    const svg = markSvg.replace('width="64" height="64"', `width="${size}" height="${size}"`);
    images.push({ size, data: await shot(browser, page(size, size, svg), size, size) });
  }
  writeFileSync(pub('favicon.ico'), buildIco(images));
  console.log('✓ public/favicon.ico');

  // apple-touch-icon — fundo sólido da marca, marca com respiro nas bordas.
  const apple = await shot(
    browser,
    page(
      180,
      180,
      `<div style="width:180px;height:180px;background:${INK};display:flex;align-items:center;justify-content:center">
         ${markSvg.replace('width="64" height="64"', 'width="132" height="132"')}
       </div>`,
    ),
    180,
    180,
  );
  writeFileSync(pub('apple-touch-icon.png'), apple);
  console.log('✓ public/apple-touch-icon.png');

  // og-image — cartão usado em links compartilhados (WhatsApp, Slack, LinkedIn).
  const og = await shot(
    browser,
    page(
      1200,
      630,
      `<div style="width:1200px;height:630px;background:
          radial-gradient(900px 520px at 78% 12%, rgba(240,135,58,.22), transparent 62%),
          radial-gradient(720px 460px at 12% 92%, rgba(46,155,212,.20), transparent 60%),
          ${INK};
        display:flex;flex-direction:column;justify-content:center;gap:34px;padding:0 92px;
        font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#fff">
         <div style="display:flex;align-items:center;gap:26px">
           ${markSvg.replace('width="64" height="64"', 'width="104" height="104"')}
           <div>
             <div style="font-size:54px;font-weight:800;letter-spacing:-1.5px;line-height:1">Lumini</div>
             <div style="font-size:17px;font-weight:600;letter-spacing:7px;color:#F0873A;margin-top:8px">IT SOLUTIONS</div>
           </div>
         </div>
         <div>
           <div style="font-size:60px;font-weight:800;letter-spacing:-2px;line-height:1.1;max-width:940px">
             Central de Gestão de Pessoas
           </div>
           <div style="font-size:27px;font-weight:600;color:#94A3B8;margin-top:20px">
             Funcionários · Equipes · Escalas &amp; Plantões · Férias · Acessos
           </div>
         </div>
       </div>`,
    ),
    1200,
    630,
  );
  writeFileSync(pub('og-image.png'), og);
  console.log('✓ public/og-image.png');
} finally {
  await browser.close();
}
