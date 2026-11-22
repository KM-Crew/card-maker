/* 명함 공방 — 인쇄용 명함 + 디지털 명함
   디지털 명함 정보는 링크(URL) 안에만 담기고 서버에 저장되지 않습니다. */
'use strict';

const TEMPLATES = [
  { id: 'minimal', name: '미니멀' },
  { id: 'bold', name: '볼드' },
  { id: 'split', name: '반반' },
  { id: 'line', name: '라인' },
  { id: 'gradient', name: '그라데이션' },
  { id: 'classic', name: '클래식' }
];
const COLORS = ['#1f2937', '#2f5cff', '#e0484d', '#0f9d6b', '#f59e0b', '#7c3aed'];
const FONTS = [
  { id: 'sans', name: '고딕', css: '"Pretendard", sans-serif' },
  { id: 'serif', name: '명조', css: '"Noto Serif KR", serif' },
  { id: 'round', name: '둥근', css: '"Gowun Dodum", sans-serif' }
];
const FIELDS = [
  ['name', '이름', 'text', '김하입'],
  ['title', '직함', 'text', '서비스 기획자'],
  ['org', '소속', 'text', 'KM-Crew'],
  ['phone', '전화', 'tel', '010-1234-5678'],
  ['email', '이메일', 'email', 'hello@example.com'],
  ['web', '웹사이트·SNS', 'url', 'instagram.com/hypevibe']
];
const DEFAULT = { name: '', title: '', org: '', phone: '', email: '', web: '', tpl: 'minimal', color: COLORS[0], font: 'sans' };

let card = Object.assign({}, DEFAULT, store.get('cm-card', {}));
const save = () => store.set('cm-card', card);
const val = k => card[k] || FIELDS.find(f => f[0] === k)[3];
const fontCss = id => (FONTS.find(f => f.id === id) || FONTS[0]).css;

function cardUrl(c = card) {
  const data = { n: c.name, t: c.title, o: c.org, p: c.phone, e: c.email, w: c.web, s: c.tpl, c: c.color, f: c.font };
  return location.href.split('#')[0] + '#/c?d=' + encodeData(data);
}
function fromUrlData(d) {
  return { name: d.n, title: d.t, org: d.o, phone: d.p, email: d.e, web: d.w, tpl: d.s, color: d.c, font: d.f };
}
function webHref(w) { return /^https?:\/\//.test(w) ? w : 'https://' + w; }

function frontHtml(c, placeholder = true) {
  const v = k => esc(c[k] || (placeholder ? FIELDS.find(f => f[0] === k)[3] : ''));
  return `
    <div class="bc front tpl-${c.tpl}" style="--c:${c.color};font-family:${fontCss(c.font)}">
      <div class="deco"></div>
      <div class="who"><div class="org">${v('org')}</div><div class="name">${v('name')}</div><div class="title">${v('title')}</div></div>
      <div class="contact">
        ${(c.phone || placeholder) ? `<div>${v('phone')}</div>` : ''}
        ${(c.email || placeholder) ? `<div>${v('email')}</div>` : ''}
        ${(c.web || placeholder) ? `<div>${v('web')}</div>` : ''}
      </div>
    </div>`;
}
function backHtml(c, placeholder = true) {
  return `
    <div class="bc back tpl-${c.tpl}" style="--c:${c.color};font-family:${fontCss(c.font)}">
      <div class="backin">
        <div class="qr"></div>
        <div><div class="org big">${esc(c.org || (placeholder ? 'KM-Crew' : ''))}</div><div class="hint">QR을 찍으면 디지털 명함이 열려요</div></div>
      </div>
    </div>`;
}
function drawQr(el, url, size) {
  el.innerHTML = '';
  if (!window.QRCode) { el.textContent = 'QR'; return; }
  new QRCode(el, { text: url, width: size, height: size, colorDark: '#111111', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
}

/* ---------- 랜딩 ---------- */
Router.on('/', root => {
  root.append(h(`
    <section class="hero split center">
      <div class="flip"><div class="flipper" id="demo"></div></div>
      <div><h1>명함, 입력만 하면<br>끝나요</h1>
      <p class="muted">템플릿을 넘겨 보며 고르고, 인쇄용 이미지와 모바일 디지털 명함을 한 번에 받아 가세요.</p>
      <a class="btn primary big block" href="#/editor">명함 만들기</a></div>
    </section>`));
  const gallery = h('<section><h2>템플릿</h2><div class="gallery"></div></section>');
  root.append(gallery);
  TEMPLATES.forEach((t, i) => {
    const sample = Object.assign({}, DEFAULT, { tpl: t.id, color: COLORS[i % COLORS.length], font: FONTS[i % 3].id });
    const el = h(`<a class="gitem" href="#/editor">${frontHtml(sample)}<span>${t.name}</span></a>`);
    el.onclick = () => { card.tpl = t.id; card.color = sample.color; save(); };
    $('.gallery', gallery).append(el);
  });
  $('#demo').innerHTML = frontHtml(Object.assign({}, DEFAULT, { tpl: 'gradient', color: '#2f5cff' }));
});

/* ---------- 편집기 ---------- */
Router.on('/editor', root => {
  root.parentElement && root.classList.add('wide');
  root.append(h(`
    <section class="editor">
      <div class="preview">
        <div class="sidebtns"><button class="chip on" data-side="front">앞면</button><button class="chip" data-side="back">뒷면</button></div>
        <div id="pv"></div>
        <p class="muted small center">90 × 50mm 표준 명함 비율</p>
      </div>
      <div class="form card">
        <h3>템플릿</h3><div class="row" id="tpls"></div>
        <h3>색</h3><div class="row" id="colors"></div>
        <h3>글꼴</h3><div class="row" id="fonts"></div>
        <h3>정보</h3>
        <div id="fields"></div>
        <div class="row" style="margin-top:16px"><a class="btn primary grow" href="#/export">완성! 내보내기</a><button class="btn" id="reset">초기화</button></div>
      </div>
    </section>`));
  let side = 'front';
  const pv = $('#pv');
  function renderPreview() {
    pv.innerHTML = side === 'front' ? frontHtml(card) : backHtml(card);
    if (side === 'back') drawQr($('.qr', pv), cardUrl(), 96);
  }
  $$('[data-side]').forEach(b => b.onclick = () => {
    side = b.dataset.side;
    $$('[data-side]').forEach(x => x.classList.toggle('on', x === b));
    renderPreview();
  });
  const tpls = $('#tpls');
  TEMPLATES.forEach(t => {
    const b = h(`<button class="chip ${card.tpl === t.id ? 'on' : ''}">${t.name}</button>`);
    b.onclick = () => { card.tpl = t.id; save(); $$('.chip', tpls).forEach(x => x.classList.toggle('on', x === b)); renderPreview(); };
    tpls.append(b);
  });
  const colors = $('#colors');
  COLORS.forEach(c => {
    const b = h(`<button class="swatch ${card.color === c ? 'on' : ''}" style="background:${c}" aria-label="색 ${c}"></button>`);
    b.onclick = () => { card.color = c; save(); $$('.swatch', colors).forEach(x => x.classList.toggle('on', x === b)); renderPreview(); };
    colors.append(b);
  });
  const custom = h(`<input type="color" class="swatch-input" value="${card.color}" aria-label="직접 고르기">`);
  custom.oninput = () => { card.color = custom.value; save(); $$('.swatch', colors).forEach(x => x.classList.remove('on')); renderPreview(); };
  colors.append(custom);
  const fonts = $('#fonts');
  FONTS.forEach(f => {
    const b = h(`<button class="chip ${card.font === f.id ? 'on' : ''}" style="font-family:${f.css}">${f.name}</button>`);
    b.onclick = () => { card.font = f.id; save(); $$('.chip', fonts).forEach(x => x.classList.toggle('on', x === b)); renderPreview(); };
    fonts.append(b);
  });
  const fields = $('#fields');
  FIELDS.forEach(([k, label, type, ph]) => {
    const wrap = h(`<div><label class="field" for="f-${k}">${label}</label><input id="f-${k}" type="${type}" placeholder="${esc(ph)}" value="${esc(card[k])}"></div>`);
    $('input', wrap).oninput = e => { card[k] = e.target.value.trim(); save(); renderPreview(); };
    fields.append(wrap);
  });
  $('#reset').onclick = () => { if (confirm('입력한 내용을 모두 지울까요?')) { card = Object.assign({}, DEFAULT); save(); Router.go('/editor'); location.reload(); } };
  renderPreview();
  return () => root.classList.remove('wide');
});

/* ---------- 내보내기 ---------- */
Router.on('/export', root => {
  if (!card.name) {
    root.append(h(`<section class="stack center"><h2>이름부터 넣어 주세요</h2><a class="btn primary block" href="#/editor">편집기로</a></section>`));
    return;
  }
  const url = cardUrl();
  root.append(h(`
    <section class="stack">
      <h1>완성!</h1>
      <div class="pv-pair"><div id="f"></div><div id="b"></div></div>
      <div class="split"><div class="stack">
      <h2>인쇄용 이미지</h2>
      <p class="muted small">90 × 50mm를 300dpi(1063 × 591px)로 저장해요. 인쇄소에 맡길 때는 재단 여백을 따로 요청하세요.</p>
      <div class="row"><button class="btn primary grow" id="dlf">앞면 저장</button><button class="btn grow" id="dlb">뒷면 저장</button></div>
      </div><div class="stack">
      <h2>디지털 명함</h2>
      <p class="muted small">링크를 받은 사람은 명함을 보고 연락처를 바로 저장할 수 있어요. 정보는 링크 안에만 들어 있고 서버에 저장되지 않아요.</p>
      <div class="row"><button class="btn primary grow" id="share">링크 공유</button><a class="btn grow" href="${esc(url.slice(url.indexOf('#')))}">미리 보기</a></div>
      <div class="center"><div class="bigqr" id="bigqr"></div></div>
      </div></div>
      <a class="btn ghost block" href="#/editor">← 다시 고치기</a>
    </section>`));
  $('#f').innerHTML = frontHtml(card, false);
  $('#b').innerHTML = backHtml(card, false);
  drawQr($('.qr', $('#b')), url, 96);
  drawQr($('#bigqr'), url, 180);
  const scale = el => 1063 / el.getBoundingClientRect().width;
  $('#dlf').onclick = () => { const el = $('#f .bc'); saveImage(el, 'card-front.png', scale(el)); };
  $('#dlb').onclick = () => { const el = $('#b .bc'); saveImage(el, 'card-back.png', scale(el)); };
  $('#share').onclick = () => shareText(`${card.name}의 명함`, `${card.name}${card.title ? ' · ' + card.title : ''}의 디지털 명함이에요`, url);
});

/* ---------- 디지털 명함 보기 ---------- */
function vcard(c) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${c.name}`, `N:${c.name};;;;`];
  if (c.org) lines.push(`ORG:${c.org}`);
  if (c.title) lines.push(`TITLE:${c.title}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone}`);
  if (c.email) lines.push(`EMAIL:${c.email}`);
  if (c.web) lines.push(`URL:${webHref(c.web)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}
Router.on('/c', (root, params) => {
  const d = decodeData(params.get('d') || '');
  if (!d) {
    root.append(h(`<section class="stack center"><h2>명함 정보를 읽지 못했어요</h2><p class="muted">링크가 잘렸을 수 있어요.</p><a class="btn primary block" href="#/">명함 공방으로</a></section>`));
    return;
  }
  const c = Object.assign({}, DEFAULT, fromUrlData(d));
  root.append(h(`
    <section class="stack digital">
      <div id="dc"></div>
      <div class="card stack">
        <div><div class="name-lg">${esc(c.name)}</div><div class="muted">${esc([c.title, c.org].filter(Boolean).join(' · '))}</div></div>
        <div class="links">
          ${c.phone ? `<a class="btn block" href="tel:${esc(c.phone.replace(/[^0-9+]/g, ''))}">📞 ${esc(c.phone)}</a>` : ''}
          ${c.email ? `<a class="btn block" href="mailto:${esc(c.email)}">✉️ ${esc(c.email)}</a>` : ''}
          ${c.web ? `<a class="btn block" href="${esc(webHref(c.web))}" target="_blank" rel="noopener noreferrer">🔗 ${esc(c.web)}</a>` : ''}
        </div>
        <button class="btn primary block" id="vcf">연락처에 저장</button>
      </div>
      <a class="btn ghost block" href="#/">나도 명함 만들기</a>
    </section>`));
  $('#dc').innerHTML = frontHtml(c, false);
  $('#vcf').onclick = () => download(new Blob([vcard(c)], { type: 'text/vcard;charset=utf-8' }), `${c.name || 'contact'}.vcf`);
});

Router.start($('#app'));
