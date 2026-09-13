import cover from '../assets/publication/cover.jpg?url';
import { publication } from '../data/publication';
import { savePreference } from '../state';

// Ported from the PP12 site's reader: table of contents, five type sizes, three
// page tones and horizontal / vertical setting. -1 is the cover page.
const SIZES = [15, 17, 19, 21, 23];
const SIZE_LABELS = ['最小', '小', '中', '大', '最大'];
const TONES = [['dark', '深邃', '#0a0910'], ['dim', '暮紫', '#191423'], ['light', '月白', '#f2eee7']] as const;
type Tone = typeof TONES[number][0];
type Mode = 'h' | 'v';
const STORAGE_KEY = 'duo-pp:publication';

const escape = (text: string) => text.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
const inline = (text: string) => escape(text).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const block = (text: string) =>
  text.startsWith('## ') ? `<h5>${inline(text.slice(3))}</h5>` :
  text.startsWith('# ') ? `<h4>${inline(text.slice(2))}</h4>` :
  `<p>${inline(text)}</p>`;

export function publicationMarkup() {
  return `
    <div class="publication" id="publication" role="dialog" aria-modal="true" aria-labelledby="publication-title" hidden>
      <div class="pub-bar">
        <div class="pub-group">
          <button type="button" class="pub-btn" id="pub-toc-toggle" aria-controls="pub-toc" aria-expanded="false">目次</button>
          <button type="button" class="pub-btn" id="pub-settings-toggle" aria-controls="pub-settings" aria-expanded="false">Aa 設定</button>
        </div>
        <div class="pub-title" id="publication-title">${escape(publication.title)}</div>
        <button type="button" class="pub-btn" id="pub-close">關閉 ✕</button>
      </div>
      <div class="pub-body">
        <nav class="pub-toc" id="pub-toc" aria-label="目次"></nav>
        <div class="pub-scroll" id="pub-scroll" tabindex="0"><article class="pub-page" id="pub-page"></article></div>
        <div class="pub-settings" id="pub-settings" hidden>
          <div class="pub-row"><span>字　級</span>
            <div class="pub-seg"><button type="button" id="pub-smaller" aria-label="縮小字級">A−</button><span id="pub-size" class="pub-size"></span><button type="button" id="pub-larger" aria-label="放大字級">A＋</button></div>
          </div>
          <div class="pub-row"><span>頁　面</span>
            <div class="pub-seg">${TONES.map(([tone, label, swatch]) =>
              `<button type="button" class="pub-swatch" data-tone="${tone}" style="background:${swatch}" aria-label="${label}"></button>`).join('')}</div>
          </div>
          <div class="pub-row"><span>排　版</span>
            <div class="pub-seg"><button type="button" data-mode="h">橫排</button><button type="button" data-mode="v">直排</button></div>
          </div>
        </div>
      </div>
      <div class="pub-foot">
        <button type="button" class="pub-btn" id="pub-prev">← 上一章</button>
        <div class="pub-progress" id="pub-progress" aria-live="polite"></div>
        <button type="button" class="pub-btn" id="pub-next">下一章 →</button>
      </div>
    </div>`;
}

export function setupPublication(opener: HTMLElement, background: HTMLElement) {
  const root = document.querySelector<HTMLElement>('#publication')!;
  const page = root.querySelector<HTMLElement>('#pub-page')!;
  const scroller = root.querySelector<HTMLElement>('#pub-scroll')!;
  const toc = root.querySelector<HTMLElement>('#pub-toc')!;
  const tocToggle = root.querySelector<HTMLButtonElement>('#pub-toc-toggle')!;
  const settings = root.querySelector<HTMLElement>('#pub-settings')!;
  const settingsToggle = root.querySelector<HTMLButtonElement>('#pub-settings-toggle')!;
  const progress = root.querySelector<HTMLElement>('#pub-progress')!;
  const prev = root.querySelector<HTMLButtonElement>('#pub-prev')!;
  const next = root.querySelector<HTMLButtonElement>('#pub-next')!;
  const last = publication.chapters.length - 1;
  const narrow = matchMedia('(max-width: 820px)');

  const prefs: { size: number; tone: Tone; mode: Mode } = { size: 2, tone: 'dark', mode: 'h' };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (Number.isInteger(stored.size) && stored.size >= 0 && stored.size < SIZES.length) prefs.size = stored.size;
    if (TONES.some(([tone]) => tone === stored.tone)) prefs.tone = stored.tone;
    if (stored.mode === 'h' || stored.mode === 'v') prefs.mode = stored.mode;
  } catch { /* Restricted storage or a bad value: keep the defaults. */ }
  let current = -1;
  let returnFocus: HTMLElement | null = null;

  toc.innerHTML = `<a href="#" data-index="-1" class="solo">封面</a>` + publication.chapters.map((chapter, index) =>
    `<a href="#" data-index="${index}" class="${chapter.kind === 'chapter' ? 'ch' : 'solo'}">${escape(chapter.title)}</a>`).join('');
  const links = [...toc.querySelectorAll<HTMLAnchorElement>('a')];

  const setToc = (open: boolean) => { root.classList.toggle('toc-open', open); tocToggle.setAttribute('aria-expanded', String(open)); };
  const setSettings = (open: boolean) => {
    // Hiding the panel would drop focus to <body> and take the keyboard out of
    // the reader; hand it back to the button that opened the panel.
    if (!open && settings.contains(document.activeElement)) settingsToggle.focus();
    settings.hidden = !open;
    settingsToggle.setAttribute('aria-expanded', String(open));
  };

  const applyPrefs = () => {
    root.dataset.tone = prefs.tone;
    root.dataset.mode = prefs.mode;
    page.style.setProperty('--pub-size', `${SIZES[prefs.size]}px`);
    root.querySelector('#pub-size')!.textContent = SIZE_LABELS[prefs.size];
    root.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tone === prefs.tone)));
    root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === prefs.mode)));
  };
  const update = () => { applyPrefs(); savePreference(STORAGE_KEY, JSON.stringify(prefs)); };

  const render = (index: number) => {
    current = Math.max(-1, Math.min(last, index));
    if (current === -1) {
      page.innerHTML = `
        <div class="pub-cover">
          <img src="${cover}" alt="${escape(publication.title)} 封面" width="989" height="1400" />
          <p class="pub-cover-title">${escape(publication.title)}</p>
          <p class="pub-cover-author">文　字　${escape(publication.author)}</p>
          <button type="button" class="pub-btn pub-start" id="pub-start">開始閱讀</button>
        </div>`;
      page.querySelector('#pub-start')!.addEventListener('click', () => render(0));
    } else {
      const chapter = publication.chapters[current];
      if (chapter.kind === 'part') {
        page.innerHTML = `<div class="pub-part${chapter.paras.length ? ' has-body' : ''}"><p class="pub-kicker">PART</p><h3>${escape(chapter.title)}</h3>${chapter.note ? `<p class="pub-note">${escape(chapter.note)}</p>` : ''}</div>`
          + (chapter.paras.length ? `<div class="pub-part-body">${chapter.paras.map(block).join('')}</div>` : '');
      } else {
        page.innerHTML = `<h3>${escape(chapter.title)}</h3>` + chapter.paras.map(block).join('') + (chapter.sign ? `<p class="pub-sign">${escape(chapter.sign)}</p>` : '');
      }
    }
    scroller.scrollTop = 0;
    // Vertical text (vertical-rl) starts from the rightmost column.
    scroller.scrollLeft = prefs.mode === 'v' ? scroller.scrollWidth : 0;
    links.forEach(link => link.toggleAttribute('aria-current', Number(link.dataset.index) === current));
    progress.textContent = current === -1 ? '封面' : `${current + 1} / ${last + 1}`;
    prev.disabled = current === -1;
    next.disabled = current === last;
  };

  const isOpen = () => !root.hidden;
  const open = () => {
    returnFocus = document.activeElement as HTMLElement | null;
    root.hidden = false;
    background.inert = true;
    document.documentElement.classList.add('publication-open');
    setToc(!narrow.matches);
    setSettings(false);
    applyPrefs();
    render(current);
    root.querySelector<HTMLButtonElement>('#pub-close')!.focus();
  };
  const close = () => {
    root.hidden = true;
    background.inert = false;
    document.documentElement.classList.remove('publication-open');
    setSettings(false);
    (returnFocus ?? opener).focus();
  };

  opener.addEventListener('click', open);
  root.querySelector('#pub-close')!.addEventListener('click', close);
  tocToggle.addEventListener('click', () => setToc(!root.classList.contains('toc-open')));
  settingsToggle.addEventListener('click', () => setSettings(settings.hidden));
  toc.addEventListener('click', event => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a');
    if (!link) return;
    event.preventDefault();
    render(Number(link.dataset.index));
    if (narrow.matches) setToc(false);
  });
  root.querySelector('#pub-smaller')!.addEventListener('click', () => { prefs.size = Math.max(0, prefs.size - 1); update(); });
  root.querySelector('#pub-larger')!.addEventListener('click', () => { prefs.size = Math.min(SIZES.length - 1, prefs.size + 1); update(); });
  root.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach(button => button.addEventListener('click', () => { prefs.tone = button.dataset.tone as Tone; update(); }));
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.addEventListener('click', () => { prefs.mode = button.dataset.mode as Mode; update(); render(current); }));
  prev.addEventListener('click', () => render(current - 1));
  next.addEventListener('click', () => render(current + 1));
  // A tap outside the settings panel dismisses it.
  root.addEventListener('pointerdown', event => {
    const target = event.target as HTMLElement;
    if (!settings.hidden && !target.closest('#pub-settings, #pub-settings-toggle')) setSettings(false);
  });
  // Listen at the document: a key must still work if focus has slipped out of the dialog.
  document.addEventListener('keydown', event => {
    if (!isOpen() || event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!settings.hidden) setSettings(false);
      else close();
      return;
    }
    // Vertical text reads right to left, so the arrow directions swap with it.
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const forward = (event.key === 'ArrowRight') !== (prefs.mode === 'v');
      render(current + (forward ? 1 : -1));
    }
  });
  // Keep Tab inside the dialog while it is open.
  root.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')]
      .filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], end = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); end.focus(); }
    else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); first.focus(); }
  });

  applyPrefs();
  return { isOpen, open, close };
}
