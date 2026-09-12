import { cards } from '../data/cards';
import { state, wrapIndex, savePreference, type CardTheme, type FontSize } from '../state';

export function readerMarkup() {
  return `
    <div class="reader-controls" id="reader-controls" inert>
      <nav class="card-navigation" aria-label="翻閱留言">
        <button type="button" id="previous" aria-label="上一張留言">←</button>
        <span class="card-count" id="card-count">01 <i>/ ${String(cards.length).padStart(2, '0')}</i></span>
        <button type="button" id="next" aria-label="下一張留言">→</button>
      </nav>
      <div class="reader-settings">
        <div class="segmented font-controls" role="group" aria-label="留言字級">
          <button type="button" data-font="small" aria-label="小字級">A−</button>
          <button type="button" data-font="medium" aria-label="中字級">A</button>
          <button type="button" data-font="large" aria-label="大字級">A＋</button>
        </div>
        <span class="control-divider" aria-hidden="true"></span>
        <div class="segmented" role="group" aria-label="留言卡配色">
          <button type="button" data-theme="light" aria-label="暖白留言卡">☀︎ <span>Light</span></button>
          <button type="button" data-theme="dark" aria-label="深色留言卡">☾ <span>Dark</span></button>
        </div>
      </div>
    </div>
    <p class="sr-only" id="reader-announcement" role="status" aria-live="polite" aria-atomic="true"></p>`;
}

export function setupReader(reducedMotion: MediaQueryList, enabled: () => boolean) {
  const cardElements = document.querySelectorAll<HTMLElement>('.message-card');
  const copies = document.querySelectorAll<HTMLElement>('.card-copy');
  let animations: Animation[] = [];
  // The body keeps the real device ratio, so the paper is a fixed landscape
  // page: a long message on a small screen has to give up a little size rather
  // than spill past the edge. Most cards never leave the first step.
  const fitSteps = [1, .94, .88, .82, .76, .7, .64, .58, .52];
  const fitCopy = () => {
    const measured = cardElements[0];
    for (const step of fitSteps) {
      cardElements.forEach(card => card.style.setProperty('--card-fit', String(step)));
      if (measured.scrollHeight <= measured.clientHeight + 1) return;
    }
  };
  const render = (announce = false) => {
    const data = cards[state.currentCard];
    cardElements.forEach(card => card.dataset.dense = String([...data.message].length + (data.message.match(/\n/g)?.length ?? 0) * 14 > 80));
    copies.forEach(copy => copy.querySelector('p')!.textContent = data.message);
    copies.forEach(copy => copy.querySelector('.signature span:last-child')!.textContent = data.author);
    fitCopy();
    document.querySelector('#card-count')!.innerHTML = `${String(state.currentCard + 1).padStart(2, '0')} <i>/ ${String(cards.length).padStart(2, '0')}</i>`;
    if (announce) document.querySelector('#reader-announcement')!.textContent = `第 ${state.currentCard + 1} 張，共 ${cards.length} 張。${data.message} —— ${data.author}`;
  };
  const change = (direction: number) => {
    if (!enabled()) return;
    state.currentCard = wrapIndex(state.currentCard + direction, cards.length);
    animations.forEach(animation => animation.cancel());
    render(true);
    if (!reducedMotion.matches) animations = [...copies].map(copy => copy.animate([
      { opacity: .1, transform: `translateX(${direction * 14}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ], { duration: 360, easing: 'cubic-bezier(.2,.6,.3,1)' }));
  };
  const preferences = () => {
    cardElements.forEach(card => { card.dataset.theme = state.cardTheme; card.dataset.font = state.fontSize; });
    fitCopy();
    document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(button => {
      if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.theme === state.cardTheme));
    });
    document.querySelectorAll<HTMLButtonElement>('button[data-font]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.font === state.fontSize)));
  };
  document.querySelector('#previous')!.addEventListener('click', () => change(-1));
  document.querySelector('#next')!.addEventListener('click', () => change(1));
  document.querySelectorAll<HTMLButtonElement>('button[data-theme]').forEach(button => button.addEventListener('click', () => {
    state.cardTheme = button.dataset.theme as CardTheme;
    savePreference('duo-pp:theme', state.cardTheme);
    preferences();
  }));
  document.querySelectorAll<HTMLButtonElement>('button[data-font]').forEach(button => button.addEventListener('click', () => {
    state.fontSize = button.dataset.font as FontSize;
    savePreference('duo-pp:font', state.fontSize);
    preferences();
  }));
  document.addEventListener('keydown', event => {
    if (!enabled() || event.altKey || event.ctrlKey || event.metaKey ||
      (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      change(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  render();
  preferences();
  return { change, refit: fitCopy };
}
