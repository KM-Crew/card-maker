/* 명함 공방 — 인쇄용 명함 + 디지털 명함
   디지털 명함 정보는 링크(URL) 안에만 담기고 서버에 저장되지 않습니다.
   로고 이미지는 이 기기(브라우저)에만 저장되고 링크에는 담기지 않습니다. */
'use strict';

const TEMPLATES = [
  { id: 'minimal', name: '미니멀' },
  { id: 'bold', name: '볼드' },
  { id: 'split', name: '반반' },
  { id: 'line', name: '라인' },
  { id: 'gradient', name: '그라데이션' },
  { id: 'classic', name: '클래식' },
  { id: 'band', name: '상단 띠' },
  { id: 'dark', name: '다크' },
  { id: 'circle', name: '동그라미' },
  { id: 'dots', name: '점무늬' },
  { id: 'tint', name: '파스텔' },
  { id: 'stamp', name: '도장' }
];
const COLORS = ['#1f2937', '#2f5cff', '#e0484d', '#0f9d6b', '#f59e0b', '#7c3aed'];
const FONTS = [
  { id: 'sans', name: '고딕', css: '"Pretendard", sans-serif' },
  { id: 'serif', name: '명조', css: '"Noto Serif KR", serif' },
  { id: 'round', name: '둥근', css: '"Gowun Dodum", sans-serif' }
];
const QR_COLORS = [
  { id: '#111111', name: '검정' },
  { id: 'accent', name: '명함 색' },
  { id: '#1e3a8a', name: '남색' },
  { id: '#5b3a29', name: '밤색' }
];
const QR_STYLES = [{ id: 'square', name: '네모' }, { id: 'dot', name: '동글' }];
const FIELDS = [
  ['name', '이름', 'text', '김하입'],
  ['title', '직함', 'text', '서비스 기획자'],
  ['org', '소속', 'text', 'KM-Crew'],
  ['phone', '전화', 'tel', '010-1234-5678'],
  ['email', '이메일', 'email', 'hello@example.com'],
  ['web', '웹사이트·SNS', 'url', 'instagram.com/hypevibe']
];
const DEFAULT = { name: '', title: '', org: '', phone: '', email: '', web: '', tpl: 'minimal', color: COLORS[0], font: 'sans', qrColor: '#111111', qrStyle: 'square', qrLogo: true };
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_LEN = 80;

/* 링크·저장소에서 온 값은 모두 검사해서 씀(색 값이 style 속성에 들어가므로 특히 중요) */
function cleanCard(c) {
  const out = Object.assign({}, DEFAULT);
  if (!c || typeof c !== 'object') return out;
  FIELDS.forEach(([k]) => { if (typeof c[k] === 'string') out[k] = c[k].replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, MAX_LEN); });
  if (TEMPLATES.some(t => t.id === c.tpl)) out.tpl = c.tpl;
  if (HEX.test(c.color)) out.color = c.color.toLowerCase();
  if (FONTS.some(f => f.id === c.font)) out.font = c.font;
  if (c.qrColor === 'accent' || HEX.test(c.qrColor)) out.qrColor = c.qrColor;
  if (QR_STYLES.some(s => s.id === c.qrStyle)) out.qrStyle = c.qrStyle;
  if (typeof c.qrLogo === 'boolean') out.qrLogo = c.qrLogo;
  return out;
}

let card = cleanCard(store.get('cm-card', {}));
const save = () => store.set('cm-card', card);
const fontCss = id => (FONTS.find(f => f.id === id) || FONTS[0]).css;

/* ---------- 색 계산(html2canvas가 color-mix를 못 읽어 미리 계산) ---------- */
const hexRgb = hx => [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16));
const rgbHex = a => '#' + a.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); }
function lum(hx) {
  const [r, g, b] = hexRgb(hx).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrastWhite = hx => 1.05 / (lum(hx) + 0.05);
/* QR이 잘 읽히도록 흰 바탕 대비 4.5 이상이 될 때까지 진하게 */
function qrInk(c) {
  let hx = c.qrColor === 'accent' ? c.color : c.qrColor;
  if (!HEX.test(hx)) hx = '#111111';
  let t = 0;
  while (contrastWhite(hx) < 4.5 && t < 1) { t += 0.1; hx = mix(hx, '#000000', 0.1); }
  return { ink: hx, adjusted: t > 0 };
}
function cardVars(c) {
  const dots = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><circle cx='6' cy='6' r='2.2' fill='${c.color}'/></svg>`;
  return [
    `--c:${c.color}`,
    `--c2:${mix(c.color, '#ff7ab6', 0.55)}`,
    `--cl:${mix(c.color, '#ffffff', 0.45)}`,
    `--tint:${mix(c.color, '#ffffff', 0.86)}`,
    `--dots:url(&quot;data:image/svg+xml,${encodeURIComponent(dots).replace(/'/g, '%27')}&quot;)`,
    `font-family:${fontCss(c.font).replace(/"/g, '&quot;')}`
  ].join(';');
}

/* ---------- 로고(이 기기에만 저장) ---------- */
let logo = store.get('cm-logo', '');
if (typeof logo !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(logo)) logo = '';
let logoImg = null;
function logoReady() {
  if (!logo) return Promise.resolve(null);
  if (logoImg && logoImg._src === logo) return logoImg.complete ? Promise.resolve(logoImg) : logoImg._p;
  const im = new Image();
  im._src = logo;
  im._p = new Promise(ok => { im.onload = () => ok(im); im.onerror = () => ok(null); });
  im.src = logo;
  logoImg = im;
  return im._p;
}
/* 큰 사진도 긴 변 320px로 줄여 저장(저장 공간 보호) */
function readLogo(file) {
  return new Promise((ok, no) => {
    if (!file || !/^image\//.test(file.type)) { no(new Error('type')); return; }
    if (file.size > 15 * 1024 * 1024) { no(new Error('size')); return; }
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 320 / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(im.naturalWidth * k));
      cv.height = Math.max(1, Math.round(im.naturalHeight * k));
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      let d = cv.toDataURL('image/png');
      if (d.length > 180000) d = cv.toDataURL('image/jpeg', 0.88);
      ok(d);
    };
    im.onerror = () => { URL.revokeObjectURL(url); no(new Error('decode')); };
    im.src = url;
  });
}

/* ---------- 링크 ---------- */
function cardUrl(c = card) {
  const data = { n: c.name, t: c.title, o: c.org, p: c.phone, e: c.email, w: c.web, s: c.tpl, c: c.color, f: c.font, q: c.qrColor, y: c.qrStyle };
  return location.href.split('#')[0] + '#/c?d=' + encodeData(data);
}
function fromUrlData(d) {
  if (!d || typeof d !== 'object') return null;
  return cleanCard({ name: d.n, title: d.t, org: d.o, phone: d.p, email: d.e, web: d.w, tpl: d.s, color: d.c, font: d.f, qrColor: d.q, qrStyle: d.y, qrLogo: false });
}
function webHref(w) { return /^https?:\/\//i.test(w) ? w : 'https://' + w; }
const initial = c => (c.name || '김').trim().charAt(0) || '김';

/* ---------- 명함 그리기 ---------- */
function frontHtml(c, placeholder = true, opt = {}) {
  const v = k => esc(c[k] || (placeholder ? FIELDS.find(f => f[0] === k)[3] : ''));
  const lg = opt.logo !== false && logo;
  return `
    <div class="bc front tpl-${c.tpl}${lg ? ' has-logo' : ''}" style="${cardVars(c)}">
      <div class="deco"></div>
      ${lg ? `<img class="logo" src="${logo}" alt="로고">` : ''}
      <div class="mark" aria-hidden="true">${esc(initial(c))}</div>
      <div class="who"><div class="org">${v('org')}</div><div class="name">${v('name')}</div><div class="title">${v('title')}</div></div>
      <div class="contact">
        ${(c.phone || placeholder) ? `<div>${v('phone')}</div>` : ''}
        ${(c.email || placeholder) ? `<div>${v('email')}</div>` : ''}
        ${(c.web || placeholder) ? `<div>${v('web')}</div>` : ''}
      </div>
    </div>`;
}
function backHtml(c, placeholder = true, opt = {}) {
  const lg = opt.logo !== false && logo;
  return `
    <div class="bc back tpl-${c.tpl}" style="${cardVars(c)}">
      <div class="backin">
        <div class="qr"></div>
        <div>${lg ? `<img class="blogo" src="${logo}" alt="로고">` : ''}<div class="org big">${esc(c.org || (placeholder ? 'KM-Crew' : ''))}</div><div class="hint">QR을 찍으면 디지털 명함이 열려요</div></div>
      </div>
    </div>`;
}

/* QR을 캔버스로 직접 그림: 색·모양(네모/동글)·가운데 로고 */
function qrCanvas(text, c, size = 360, withLogo = false) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  cv.className = 'qrcv';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', '디지털 명함 QR 코드');
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  if (!window.qrcode) { g.fillStyle = '#999'; g.font = `${size / 6}px sans-serif`; g.textAlign = 'center'; g.fillText('QR', size / 2, size / 2 + size / 18); cv.dataset.ok = '0'; return cv; }
  const img = withLogo && logoImg && logoImg.complete && logoImg.naturalWidth ? logoImg : null;
  let qr;
  try {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    qr = qrcode(0, img ? 'H' : 'M');
    qr.addData(text);
    qr.make();
  } catch (e) { console.error(e); cv.dataset.ok = '0'; return cv; }
  const n = qr.getModuleCount();
  /* 칸 크기를 정수 픽셀로 맞춰 흐릿한 경계 없이 또렷하게(인식률↑). 남는 픽셀은 여백으로 */
  const cell = Math.max(1, Math.floor(size / (n + 4)));
  const off = Math.floor((size - cell * n) / 2);
  const { ink } = qrInk(c);
  g.fillStyle = ink;
  const finder = (r, k) => (r < 7 && k < 7) || (r < 7 && k >= n - 7) || (r >= n - 7 && k < 7);
  const hole = img ? Math.ceil(n * 0.24) | 1 : 0; // 모듈 수는 늘 홀수 → 가운데가 정확히 맞음
  const h0 = (n - hole) / 2;
  for (let r = 0; r < n; r++) {
    for (let k = 0; k < n; k++) {
      if (!qr.isDark(r, k)) continue;
      if (hole && r >= h0 && r < h0 + hole && k >= h0 && k < h0 + hole) continue;
      const x = off + k * cell, y = off + r * cell;
      if (c.qrStyle === 'dot' && !finder(r, k)) {
        g.beginPath(); g.arc(x + cell / 2, y + cell / 2, cell * 0.46, 0, Math.PI * 2); g.fill();
      } else {
        g.fillRect(x, y, cell, cell);
      }
    }
  }
  if (img) {
    const box = hole * cell;
    const bx = off + h0 * cell;
    g.fillStyle = '#ffffff';
    g.fillRect(bx, bx, box, box);
    const pad = box * 0.1;
    const k = Math.min((box - pad * 2) / img.naturalWidth, (box - pad * 2) / img.naturalHeight);
    const w = img.naturalWidth * k, hh = img.naturalHeight * k;
    g.drawImage(img, (size - w) / 2, (size - hh) / 2, w, hh);
  }
  cv.dataset.ok = '1';
  cv.dataset.modules = String(n);
  cv.dataset.ink = ink;
  return cv;
}
async function drawQr(el, url, c, size = 360) {
  if (!el) return;
  const withLogo = !!(c.qrLogo && logo);
  if (withLogo) await logoReady();
  el.innerHTML = '';
  el.append(qrCanvas(url, c, size, withLogo));
}

/* ---------- 인쇄용: 재단 여백 3mm + PDF ---------- */
const DPI = 300;
const MM = DPI / 25.4;
const TRIM = { w: 90, h: 50 };
const BLEED = 3;
async function renderPrint(side) {
  if (!window.html2canvas) { try { await loadScript('vendor/html2canvas.min.js'); } catch (e) { /* 아래 안내 */ } }
  if (!window.html2canvas) throw new Error('html2canvas');
  const host = h('<div class="printhost" aria-hidden="true"></div>');
  document.body.append(host);
  try {
    host.innerHTML = side === 'front' ? frontHtml(card, false) : backHtml(card, false);
    const el = $('.bc', host);
    el.classList.add('print');
    if (side === 'back') await drawQr($('.qr', el), cardUrl(), card, 600);
    await Promise.all($$('img', el).map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    try { await document.fonts.ready; } catch (e) { /* 미지원 */ }
    const tw = Math.round(TRIM.w * MM), th = Math.round(TRIM.h * MM);
    const shot = await html2canvas(el, { backgroundColor: '#ffffff', scale: tw / el.getBoundingClientRect().width, useCORS: true, logging: false });
    const b = Math.round(BLEED * MM);
    const out = document.createElement('canvas');
    out.width = tw + b * 2; out.height = th + b * 2;
    const g = out.getContext('2d');
    g.imageSmoothingEnabled = false;
    const sw = shot.width, sh = shot.height;
    g.drawImage(shot, 0, 0, sw, sh, b, b, tw, th);
    /* 가장자리 1px을 바깥으로 늘려 재단 여백을 채움(재단이 조금 밀려도 흰 줄이 안 생김) */
    /* 맨 끝 줄은 반투명하게 섞여 그려질 수 있어 2px 안쪽 줄을 씀 */
    const k = 2;
    g.drawImage(shot, k, 0, 1, sh, 0, b, b, th);
    g.drawImage(shot, sw - 1 - k, 0, 1, sh, b + tw, b, b, th);
    g.drawImage(out, 0, b + k, tw + b * 2, 1, 0, 0, tw + b * 2, b);
    g.drawImage(out, 0, b + th - 1 - k, tw + b * 2, 1, 0, b + th, tw + b * 2, b);
    return out;
  } finally { host.remove(); }
}
function dataUrlBytes(d) {
  const bin = atob(d.split(',')[1]);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
/* 라이브러리 없이 JPEG를 넣은 PDF를 직접 만듦. 쪽 크기 = 재단 크기 + 재단 여백(+ 재단선 칸) */
function buildPdf(pages, marks) {
  const pt = mm => mm * 72 / 25.4;
  const M = marks ? 6 : 0; // 재단선 칸(mm)
  const W = TRIM.w + BLEED * 2 + M * 2, H = TRIM.h + BLEED * 2 + M * 2;
  const enc = new TextEncoder();
  const parts = [];
  let len = 0;
  const offs = [];
  const push = x => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
  const f = v => (Math.round(v * 1000) / 1000).toString();
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const obj = (id, body) => { offs[id] = len; push(`${id} 0 obj\n`); body(); push('\nendobj\n'); };
  const nP = pages.length;
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${nP} >>`));
  pages.forEach((p, i) => {
    const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2;
    const bx = pt(M), by = pt(M), bw = pt(TRIM.w + BLEED * 2), bh = pt(TRIM.h + BLEED * 2);
    const tx = pt(M + BLEED), ty = pt(M + BLEED), tw = pt(TRIM.w), th = pt(TRIM.h);
    obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pt(W))} ${f(pt(H))}] /BleedBox [${f(bx)} ${f(by)} ${f(bx + bw)} ${f(by + bh)}] /TrimBox [${f(tx)} ${f(ty)} ${f(tx + tw)} ${f(ty + th)}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`));
    let s = `q ${f(bw)} 0 0 ${f(bh)} ${f(bx)} ${f(by)} cm /Im${i} Do Q\n`;
    if (marks) {
      const g = pt(BLEED + 1), L = pt(M - 2);
      s += '0 0 0 RG 0.25 w\n';
      [[tx, ty], [tx + tw, ty], [tx, ty + th], [tx + tw, ty + th]].forEach(([x, y]) => {
        const sx = x === tx ? -1 : 1, sy = y === ty ? -1 : 1;
        s += `${f(x + sx * g)} ${f(y)} m ${f(x + sx * (g + L))} ${f(y)} l S\n`;
        s += `${f(x)} ${f(y + sy * g)} m ${f(x)} ${f(y + sy * (g + L))} l S\n`;
      });
    }
    obj(cid, () => { push(`<< /Length ${enc.encode(s).length} >>\nstream\n`); push(s); push('\nendstream'); });
    obj(iid, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`);
      push(p.jpg);
      push('\nendstream');
    });
  });
  const total = 3 + nP * 3;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
async function makePrintPdf(marks) {
  const pages = [];
  for (const side of ['front', 'back']) {
    const cv = await renderPrint(side);
    pages.push({ w: cv.width, h: cv.height, jpg: dataUrlBytes(cv.toDataURL('image/jpeg', 0.95)) });
  }
  return buildPdf(pages, marks);
}

/* ---------- 랜딩 ---------- */
Router.on('/', root => {
  root.append(h(`
    <section class="hero split center">
      <div class="flip"><div class="flipper" id="demo"></div></div>
      <div><h1>명함, 입력만 하면<br>끝나요</h1>
      <p class="muted">템플릿을 넘겨 보며 고르고, 인쇄용 이미지와 모바일 디지털 명함을 한 번에 받아 가세요.</p>
      <div class="badges"><span>템플릿 12종</span><span>로고 넣기</span><span>QR 색·모양</span><span>인쇄용 PDF(재단 여백)</span></div>
      <a class="btn primary big block" href="#/editor">명함 만들기</a></div>
    </section>`));
  const gallery = h('<section><h2>템플릿 12종</h2><div class="gallery"></div></section>');
  root.append(gallery);
  TEMPLATES.forEach((t, i) => {
    const sample = Object.assign({}, DEFAULT, { tpl: t.id, color: COLORS[i % COLORS.length], font: FONTS[i % 3].id });
    const el = h(`<a class="gitem" href="#/editor" aria-label="${t.name} 템플릿으로 만들기">${frontHtml(sample, true, { logo: false })}<span>${t.name}</span></a>`);
    el.onclick = () => { card.tpl = t.id; card.color = sample.color; save(); };
    $('.gallery', gallery).append(el);
  });
  $('#demo').innerHTML = frontHtml(Object.assign({}, DEFAULT, { tpl: 'gradient', color: '#2f5cff' }), true, { logo: false });
});

/* ---------- 편집기 ---------- */
Router.on('/editor', root => {
  root.classList.add('wide');
  root.append(h(`
    <section class="editor">
      <div class="preview">
        <div class="sidebtns"><button class="chip on" data-side="front" aria-pressed="true">앞면</button><button class="chip" data-side="back" aria-pressed="false">뒷면</button></div>
        <div id="pv"></div>
        <p class="muted small center">90 × 50mm 표준 명함 비율</p>
        <p class="muted small center qrnote hidden" id="qrnote">QR이 잘 읽히도록 색을 조금 진하게 바꿨어요</p>
      </div>
      <div class="form card">
        <h3>템플릿 <span class="muted small">12종</span></h3><div class="tplgrid" id="tpls"></div>
        <h3>색</h3><div class="row" id="colors"></div>
        <h3>글꼴</h3><div class="row" id="fonts"></div>
        <h3>로고</h3>
        <div class="row logorow">
          <label class="btn" for="logoin">🖼 로고 올리기</label><input id="logoin" class="vh" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
          <span id="logoview"></span>
          <button class="btn ghost hidden" id="logodel">로고 빼기</button>
        </div>
        <p class="muted small">로고는 이 기기에만 저장되고 디지털 명함 링크에는 담기지 않아요.</p>
        <h3>QR</h3>
        <div class="row" id="qrcolors"></div>
        <div class="row" id="qrstyles" style="margin-top:8px"></div>
        <label class="check"><input type="checkbox" id="qrlogo"> QR 가운데에 로고 넣기</label>
        <h3>정보</h3>
        <div id="fields"></div>
        <div class="row" style="margin-top:16px"><a class="btn primary grow" href="#/export">완성! 내보내기</a><button class="btn" id="reset">초기화</button></div>
      </div>
    </section>`));
  let side = 'front';
  const pv = $('#pv');
  let seq = 0;
  async function renderPreview() {
    const my = ++seq;
    pv.innerHTML = side === 'front' ? frontHtml(card) : backHtml(card);
    $('#qrnote').classList.toggle('hidden', !(side === 'back' && qrInk(card).adjusted));
    if (side === 'back') {
      const holder = $('.qr', pv);
      await drawQr(holder, cardUrl(), card, 360);
      if (my !== seq) return;
    }
    renderThumbs();
  }
  const showSide = s => {
    side = s;
    $$('[data-side]').forEach(x => { const on = x.dataset.side === s; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    renderPreview();
  };
  $$('[data-side]').forEach(b => b.onclick = () => showSide(b.dataset.side));

  /* 템플릿: 내 정보가 들어간 작은 미리보기 12개 */
  const tpls = $('#tpls');
  function renderThumbs() {
    $$('.tplbtn', tpls).forEach(b => {
      const t = b.dataset.tpl;
      $('.mini', b).innerHTML = frontHtml(Object.assign({}, card, { tpl: t }));
      b.classList.toggle('on', card.tpl === t);
      b.setAttribute('aria-pressed', String(card.tpl === t));
    });
  }
  TEMPLATES.forEach(t => {
    const b = h(`<button class="tplbtn" data-tpl="${t.id}" aria-label="${t.name} 템플릿"><span class="mini"></span><span class="tname">${t.name}</span></button>`);
    b.onclick = () => { card.tpl = t.id; save(); renderPreview(); };
    tpls.append(b);
  });

  const colors = $('#colors');
  const syncSw = () => $$('.swatch', colors).forEach(x => x.classList.toggle('on', x.dataset.c === card.color));
  COLORS.forEach(c => {
    const b = h(`<button class="swatch" data-c="${c}" style="background:${c}" aria-label="색 ${c}"></button>`);
    b.onclick = () => { card.color = c; save(); syncSw(); renderPreview(); };
    colors.append(b);
  });
  const custom = h(`<input type="color" class="swatch-input" value="${card.color}" aria-label="색 직접 고르기">`);
  custom.oninput = () => { card.color = custom.value.toLowerCase(); save(); syncSw(); renderPreview(); };
  colors.append(custom);
  syncSw();

  const fonts = $('#fonts');
  FONTS.forEach(f => {
    const b = h(`<button class="chip ${card.font === f.id ? 'on' : ''}" style="font-family:${f.css.replace(/"/g, '&quot;')}">${f.name}</button>`);
    b.onclick = () => { card.font = f.id; save(); $$('.chip', fonts).forEach(x => x.classList.toggle('on', x === b)); renderPreview(); };
    fonts.append(b);
  });

  /* 로고 */
  const logoin = $('#logoin');
  function syncLogo() {
    $('#logoview').innerHTML = logo ? `<img class="logothumb" src="${logo}" alt="올린 로고">` : '<span class="muted small">아직 없어요</span>';
    $('#logodel').classList.toggle('hidden', !logo);
    $('#qrlogo').disabled = !logo;
  }
  logoin.onchange = async () => {
    const file = logoin.files && logoin.files[0];
    logoin.value = '';
    if (!file) return;
    try {
      const d = await readLogo(file);
      store.set('cm-logo', d);
      if (store.get('cm-logo', '') !== d) toast('저장 공간이 부족해 새로고침하면 로고가 사라질 수 있어요');
      else toast('로고를 넣었어요');
      logo = d;
      await logoReady();
      Sfx.play('ok');
    } catch (e) {
      toast(e.message === 'size' ? '15MB보다 작은 이미지로 올려 주세요' : '이 파일은 이미지로 열지 못했어요. PNG·JPG로 올려 주세요');
      Sfx.play('bad');
    }
    syncLogo(); renderPreview();
  };
  $('#logodel').onclick = () => { logo = ''; logoImg = null; store.set('cm-logo', ''); syncLogo(); renderPreview(); toast('로고를 뺐어요'); };

  /* QR 색·모양 */
  const qrcolors = $('#qrcolors');
  const syncQc = () => $$('.chip', qrcolors).forEach(x => { const on = x.dataset.q === card.qrColor; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
  QR_COLORS.forEach(q => {
    const dot = q.id === 'accent' ? 'var(--c)' : q.id;
    const b = h(`<button class="chip" data-q="${q.id}"><i class="qdot" style="background:${dot}"></i>${q.name}</button>`);
    b.onclick = () => { card.qrColor = q.id; save(); syncQc(); if (side !== 'back') showSide('back'); else renderPreview(); };
    qrcolors.append(b);
  });
  const qcustom = h(`<input type="color" class="swatch-input" value="${HEX.test(card.qrColor) ? card.qrColor : '#111111'}" aria-label="QR 색 직접 고르기">`);
  qcustom.oninput = () => { card.qrColor = qcustom.value.toLowerCase(); save(); syncQc(); if (side !== 'back') showSide('back'); else renderPreview(); };
  qrcolors.append(qcustom);
  qrcolors.style.setProperty('--c', card.color);
  const qrstyles = $('#qrstyles');
  QR_STYLES.forEach(s => {
    const b = h(`<button class="chip" data-qs="${s.id}">${s.id === 'dot' ? '●' : '■'} ${s.name}</button>`);
    b.onclick = () => { card.qrStyle = s.id; save(); syncQs(); if (side !== 'back') showSide('back'); else renderPreview(); };
    qrstyles.append(b);
  });
  const syncQs = () => $$('.chip', qrstyles).forEach(x => { const on = x.dataset.qs === card.qrStyle; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
  const qrlogo = $('#qrlogo');
  qrlogo.checked = card.qrLogo;
  qrlogo.onchange = () => { card.qrLogo = qrlogo.checked; save(); if (side !== 'back') showSide('back'); else renderPreview(); };
  syncQc(); syncQs(); syncLogo();
  colors.addEventListener('click', () => qrcolors.style.setProperty('--c', card.color));
  custom.addEventListener('input', () => qrcolors.style.setProperty('--c', card.color));

  const fields = $('#fields');
  FIELDS.forEach(([k, label, type, ph]) => {
    const wrap = h(`<div><label class="field" for="f-${k}">${label}</label><input id="f-${k}" type="${type}" maxlength="${MAX_LEN}" placeholder="${esc(ph)}" value="${esc(card[k])}"></div>`);
    $('input', wrap).oninput = e => { card[k] = e.target.value.trim().slice(0, MAX_LEN); save(); renderPreview(); };
    fields.append(wrap);
  });
  $('#reset').onclick = () => {
    if (!confirm('입력한 내용을 모두 지울까요? (로고도 빠져요)')) return;
    card = cleanCard({}); save(); logo = ''; logoImg = null; store.set('cm-logo', '');
    Router.go('/editor'); location.reload();
  };
  logoReady().then(renderPreview);
  return () => root.classList.remove('wide');
});

/* ---------- 내보내기 ---------- */
Router.on('/export', root => {
  if (!card.name) {
    root.append(h(`<section class="stack center"><h2>이름부터 넣어 주세요</h2><a class="btn primary block" href="#/editor">편집기로</a></section>`));
    return;
  }
  const url = cardUrl();
  const tw = Math.round(TRIM.w * MM), th = Math.round(TRIM.h * MM), b = Math.round(BLEED * MM);
  root.append(h(`
    <section class="stack">
      <h1>완성!</h1>
      <div class="pv-pair"><div id="f"></div><div id="b"></div></div>
      <div class="split"><div class="stack">
      <h2>인쇄용</h2>
      <div class="card stack printbox">
        <div><b>인쇄소용 PDF</b> <span class="muted small">앞·뒤 2쪽</span></div>
        <p class="muted small">재단 크기 ${TRIM.w} × ${TRIM.h}mm에 사방 재단 여백 ${BLEED}mm를 붙인 ${TRIM.w + BLEED * 2} × ${TRIM.h + BLEED * 2}mm, 300dpi(${tw + b * 2} × ${th + b * 2}px)예요. 여백은 명함 가장자리 색으로 채워서 재단이 조금 밀려도 흰 줄이 생기지 않아요. 글자는 재단선 안쪽 ${BLEED}mm 이상 떨어져 있어요.</p>
        <label class="check"><input type="checkbox" id="marks"> 재단선(모서리 표시) 넣기</label>
        <button class="btn primary block" id="pdf">📄 인쇄용 PDF 받기</button>
      </div>
      <p class="muted small">이미지(PNG)로도 받을 수 있어요. 재단 여백 없이 ${TRIM.w} × ${TRIM.h}mm 300dpi(${tw} × ${th}px)예요.</p>
      <div class="row"><button class="btn grow" id="dlf">앞면 PNG</button><button class="btn grow" id="dlb">뒷면 PNG</button></div>
      ${logo ? '<p class="muted small">올린 로고는 인쇄용에만 들어가고 디지털 명함 링크에는 담기지 않아요.</p>' : ''}
      </div><div class="stack">
      <h2>디지털 명함</h2>
      <p class="muted small">링크를 받은 사람은 명함을 보고 연락처를 바로 저장할 수 있어요. 정보는 링크 안에만 들어 있고 서버에 저장되지 않아요. 링크를 받은 사람은 누구나 이 정보를 볼 수 있어요.</p>
      <div class="row"><button class="btn primary grow" id="share">링크 공유</button><button class="btn grow" id="copy">링크 복사</button><a class="btn grow" href="${esc(url.slice(url.indexOf('#')))}">받는 화면 보기</a></div>
      <div class="center"><div class="bigqr" id="bigqr"></div><p class="muted small">휴대폰 카메라로 찍으면 바로 열려요</p></div>
      </div></div>
      <a class="btn ghost block" href="#/editor">← 다시 고치기</a>
    </section>`));
  $('#f').innerHTML = frontHtml(card, false);
  $('#b').innerHTML = backHtml(card, false);
  drawQr($('.qr', $('#b')), url, card, 360);
  drawQr($('#bigqr'), url, card, 360);
  /* PNG: 인쇄 해상도 그대로(재단 여백은 잘라 냄) */
  async function png(side, name) {
    try {
      const cv = await renderPrint(side);
      const out = document.createElement('canvas');
      out.width = tw; out.height = th;
      out.getContext('2d').drawImage(cv, b, b, tw, th, 0, 0, tw, th);
      await saveImage(out, name);
    } catch (e) {
      console.error(e);
      toast('이미지를 만들지 못했어요. 화면 캡처로 저장해 주세요'); Sfx.play('bad');
    }
  }
  $('#dlf').onclick = () => png('front', 'card-front.png');
  $('#dlb').onclick = () => png('back', 'card-back.png');
  $('#pdf').onclick = async e => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'PDF 만드는 중…';
    try {
      const blob = await makePrintPdf($('#marks').checked);
      download(blob, `${card.name || 'card'}-print.pdf`);
      toast('인쇄용 PDF를 저장했어요'); Sfx.play('ok');
    } catch (err) {
      console.error(err);
      toast('PDF를 만들지 못했어요. PNG로 받아 주세요'); Sfx.play('bad');
    } finally { btn.disabled = false; btn.textContent = '📄 인쇄용 PDF 받기'; }
  };
  $('#share').onclick = () => shareText(`${card.name}의 명함`, `${card.name}${card.title ? ' · ' + card.title : ''}의 디지털 명함이에요`, url);
  $('#copy').onclick = () => copyText(url);
});

/* ---------- 디지털 명함 보기 ---------- */
function vEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
/* 한글 이름(2~4자)은 성/이름을 나눠 연락처 앱에서 바르게 정렬되게 함 */
function nameParts(n) {
  const s = n.trim();
  if (/^[가-힣]{2,4}$/.test(s)) {
    const two = ['남궁', '제갈', '선우', '황보', '독고', '사공', '서문'];
    const fam = s.length >= 3 && two.includes(s.slice(0, 2)) ? s.slice(0, 2) : s.charAt(0);
    return [fam, s.slice(fam.length)];
  }
  const w = s.split(/\s+/);
  return w.length > 1 ? [w[w.length - 1], w.slice(0, -1).join(' ')] : [s, ''];
}
function vcard(c) {
  const [fam, given] = nameParts(c.name || '');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vEsc(c.name)}`, `N:${vEsc(fam)};${vEsc(given)};;;`];
  if (c.org) lines.push(`ORG:${vEsc(c.org)}`);
  if (c.title) lines.push(`TITLE:${vEsc(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${vEsc(c.phone)}`);
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${vEsc(c.email)}`);
  if (c.web) lines.push(`URL:${vEsc(webHref(c.web))}`);
  lines.push('NOTE:명함 공방 디지털 명함에서 저장');
  lines.push('END:VCARD');
  return lines.join('\r\n');
}
Router.on('/c', (root, params) => {
  const c = fromUrlData(decodeData(params.get('d') || ''));
  if (!c || !c.name) {
    root.append(h(`<section class="stack center"><h2>명함 정보를 읽지 못했어요</h2><p class="muted">링크가 잘렸거나 일부가 빠졌을 수 있어요. 보낸 사람에게 링크를 다시 받아 주세요.</p><a class="btn primary block" href="#/">명함 공방으로</a></section>`));
    return;
  }
  const url = cardUrl(c);
  const tel = c.phone.replace(/[^0-9+]/g, '');
  root.append(h(`
    <section class="stack digital">
      <p class="muted small center gift">📇 ${esc(c.name)} 님이 명함을 보냈어요</p>
      <button class="dflip" id="dflip" aria-label="명함 뒤집기" aria-pressed="false"><span class="dinner"><span class="dface dfront"></span><span class="dface dback"></span></span></button>
      <p class="muted small center">명함을 누르면 뒤집혀요</p>
      <div class="card stack">
        <div class="dhead"><span class="avatar" style="background:${c.color}">${esc(initial(c))}</span><div><div class="name-lg">${esc(c.name)}</div><div class="muted">${esc([c.title, c.org].filter(Boolean).join(' · '))}</div></div></div>
        <div class="links">
          ${c.phone ? `<div class="lrow"><a class="btn block" href="tel:${esc(tel)}">📞 ${esc(c.phone)}</a><button class="btn icon" data-copy="${esc(c.phone)}" aria-label="전화번호 복사" title="전화번호 복사">⧉</button></div>` : ''}
          ${c.phone ? `<div class="lrow"><a class="btn block" href="sms:${esc(tel)}">💬 문자 보내기</a></div>` : ''}
          ${c.email ? `<div class="lrow"><a class="btn block" href="mailto:${esc(c.email)}">✉️ ${esc(c.email)}</a><button class="btn icon" data-copy="${esc(c.email)}" aria-label="이메일 복사" title="이메일 복사">⧉</button></div>` : ''}
          ${c.web ? `<div class="lrow"><a class="btn block" href="${esc(webHref(c.web))}" target="_blank" rel="noopener noreferrer">🔗 ${esc(c.web)}</a><button class="btn icon" data-copy="${esc(webHref(c.web))}" aria-label="링크 복사" title="링크 복사">⧉</button></div>` : ''}
        </div>
        <button class="btn primary block" id="vcf">👤 연락처에 저장</button>
        <div class="row"><button class="btn grow" id="showqr">QR 크게 보기</button><button class="btn grow" id="pass">이 명함 전달</button></div>
      </div>
      <a class="btn ghost block" href="#/">나도 명함 만들기</a>
    </section>`));
  $('.dfront', root).innerHTML = frontHtml(c, false, { logo: false });
  $('.dback', root).innerHTML = backHtml(c, false, { logo: false });
  drawQr($('.dback .qr', root), url, c, 360);
  const flip = $('#dflip');
  flip.onclick = () => { const on = !flip.classList.contains('on'); flip.classList.toggle('on', on); flip.setAttribute('aria-pressed', String(on)); Sfx.play('tap'); };
  $$('[data-copy]', root).forEach(b => b.onclick = () => copyText(b.dataset.copy));
  $('#vcf').onclick = () => { download(new Blob([vcard(c)], { type: 'text/vcard;charset=utf-8' }), `${(c.name || 'contact').replace(/[\\/:*?"<>|]/g, '')}.vcf`); toast('연락처 파일을 받았어요. 열면 연락처에 추가돼요'); };
  $('#pass').onclick = () => shareText(`${c.name}의 명함`, `${c.name}${c.title ? ' · ' + c.title : ''}의 디지털 명함이에요`, url);
  $('#showqr').onclick = () => {
    const ov = h(`<div class="qrover" role="dialog" aria-modal="true" aria-label="QR 크게 보기"><div class="qrbox"><div class="qrbig"></div><b>${esc(c.name)}</b><span class="muted small">상대 휴대폰 카메라로 찍게 보여 주세요</span><button class="btn block" id="qrclose">닫기</button></div></div>`);
    document.body.append(ov);
    drawQr($('.qrbig', ov), url, c, 480);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.onclick = e => { if (e.target === ov) close(); };
    $('#qrclose', ov).onclick = close;
    $('#qrclose', ov).focus();
  };
});

Router.start($('#app'));
