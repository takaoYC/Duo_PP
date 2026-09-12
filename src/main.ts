import './style.css';
import { phoneMarkup, setupPhone } from './components/phone';
import { readerMarkup, setupReader } from './components/reader';
import { state, messageOpacity, clamp } from './state';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="experience">
    <header class="masthead"><span>PP YAO</span><span>2014から</span></header>
    <div class="intro"><h1>Duo <em>PP</em><span class="title-star" aria-hidden="true">✧</span></h1></div>
    ${phoneMarkup()}
    <div class="interaction-panel">
      <div class="view-controls" role="group" aria-label="手機觀看角度"><button type="button" id="view-front" aria-pressed="true">正面</button><span aria-hidden="true">／</span><button type="button" id="view-back" aria-pressed="false">背面</button><button type="button" id="inspect" aria-pressed="false" aria-label="切換整支手機自由旋轉模式">360°</button><span class="drag-hint">拖曳機身 · 轉動</span></div>
      <div class="fold-control"><div class="fold-label"><label for="fold">展開這十二年</label><output id="fold-value" for="fold">4%</output></div><input id="fold" type="range" min="0" max="100" step="1" value="4" aria-label="手機開合程度" aria-valuetext="4%，微微展開" /><div class="fold-endpoints" aria-hidden="true"><span>2014 <i>開始</i></span><span>2026 <i>星光</i></span></div></div>
      ${readerMarkup()}
    </div>
    <p class="closing-line" id="chapter-caption">從一顆星，開始。</p>
  </main>`;

// Split one synchronized card across the two physical screens.
const originalScreen = document.querySelector<HTMLElement>('#message-screen')!;
const otherScreen = originalScreen.cloneNode(true) as HTMLElement;
otherScreen.removeAttribute('id');
otherScreen.setAttribute('aria-hidden', 'true');
otherScreen.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
originalScreen.classList.add('message-left');
otherScreen.classList.add('message-right');
document.querySelector('.half-left')!.append(originalScreen);
document.querySelector('.half-right')!.append(otherScreen);
// A single surface removes subpixel seams once the two halves are flat.
const flatScreen = otherScreen.cloneNode(true) as HTMLElement;
flatScreen.className = 'message-screen message-flat';
document.querySelector('#phone')!.append(flatScreen);

const phone = document.querySelector<HTMLElement>('#phone')!;
const fold = document.querySelector<HTMLInputElement>('#fold')!;
const cover = document.querySelector<HTMLElement>('.cover')!;
const experience = document.querySelector<HTMLElement>('.experience')!;
const stage = document.querySelector<HTMLElement>('.device-stage')!;
const root = document.documentElement;
// iPhone Duo, unfolded: 164.6 x 117.8 mm. The body keeps this ratio at every
// size -- only how much room it is given changes, never what shape it is.
const DEVICE_RATIO = 164.6 / 117.8;
const cssPixels = (name: string) => parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
const fitDevice = () => {
  const box = stage.getBoundingClientRect();
  const width = Math.max(
    cssPixels('--phone-min-width'),
    Math.min(box.width, cssPixels('--phone-max-width'), (box.height - cssPixels('--stage-air')) * DEVICE_RATIO),
  );
  root.style.setProperty('--phone-width', `${width.toFixed(1)}px`);
  root.style.setProperty('--phone-height', `${(width / DEVICE_RATIO).toFixed(1)}px`);
};
const bloom = document.querySelector<HTMLElement>('.stage-bloom')!;
let arrived = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let renderedFold = state.foldProgress, renderedRotation = state.phoneRotation, renderedTilt = state.phoneTilt, frame = 0;
let messageMode = false;
let inspecting = false;
const isReadable = () => messageMode && Math.cos(renderedRotation * Math.PI / 180) * Math.cos(renderedTilt * Math.PI / 180) > .3;
const reader = setupReader(reducedMotion, isReadable);
const render = () => {
  const ease = reducedMotion.matches ? 1 : .2;
  renderedFold += (state.foldProgress - renderedFold) * ease;
  renderedRotation += (state.phoneRotation - renderedRotation) * ease;
  renderedTilt += (state.phoneTilt - renderedTilt) * ease;
  if (Math.abs(renderedTilt - state.phoneTilt) < .02) renderedTilt = state.phoneTilt;
  if (Math.abs(renderedFold - state.foldProgress) < .02) renderedFold = state.foldProgress;
  if (Math.abs(renderedRotation - state.phoneRotation) < .02) renderedRotation = state.phoneRotation;
  const progress = renderedFold / 100;
  const foldAngle = 180 * (1 - progress);
  const visibleSpread = Math.max(0, Math.cos(foldAngle * Math.PI / 180));
  phone.style.setProperty('--fold-angle', `${foldAngle}deg`);
  phone.style.setProperty('--phone-tilt', `${renderedTilt}deg`);
  phone.style.setProperty('--phone-rotation', `${renderedRotation}deg`);
  phone.style.setProperty('--phone-pivot', `${75 - 25 * visibleSpread}%`);
  phone.style.setProperty('--phone-offset', `${-25 * (1 - visibleSpread)}%`);
  phone.style.setProperty('--message-opacity', String(messageOpacity(renderedFold)));
  phone.style.setProperty('--closed-zoom', String(1 + .12 * (1 - progress)));
  phone.style.setProperty('--fold-shade', String(.12 + .3 * (1 - progress)));
  document.querySelector<HTMLElement>('.device-shadow')!.style.opacity = String(.2 + progress * .35);
  // The last third of the opening lights the field: stars, orbits and a bloom
  // behind the object all answer to how far it has come.
  experience.style.setProperty('--open-glow', String(clamp((renderedFold - 62) / 38, 0, 1)));
  experience.style.setProperty('--title-turn', `${clamp(renderedRotation * .05, -7, 7)}deg`);
  messageMode = renderedFold >= 98;
  const readable = isReadable();
  document.querySelectorAll<HTMLElement>('.message-screen').forEach(screen => { screen.inert = !readable; });
  document.querySelector<HTMLElement>('#reader-controls')!.inert = !readable;
  // Once the leaf has turned away, its cue must not stay in the tab order.
  cover.inert = renderedFold > 20;
  document.querySelector('#reader-controls')!.classList.toggle('available', readable);
  phone.classList.toggle('readable', readable);
  if (readable && !arrived && !reducedMotion.matches) bloom.animate([
    { opacity: '.15', transform: 'scale(.72)' },
    { opacity: '1', transform: 'scale(1.08)', offset: .42 },
    { opacity: '', transform: '' },
  ], { duration: 1250, easing: 'cubic-bezier(.18,.72,.28,1)' });
  arrived = readable;
  phone.classList.toggle('flat', renderedFold === 100);
  // While the leaf is shut the inner faces are hidden inside the fold, but they
  // still occupy the same screen area and would swallow hits meant for the
  // cover -- including the cue that opens the phone.
  phone.classList.toggle('shut', renderedFold < 20);
  document.querySelector('.drag-hint')!.textContent = inspecting ? '上下左右拖曳' : readable ? '左右翻卡 · 上下轉動' : '拖曳機身 · 轉動';
  document.querySelector('#chapter-caption')!.textContent = readable ? '' : '從一顆星，開始。';
  document.querySelector('#view-front')!.setAttribute('aria-pressed', String(Math.cos(state.phoneRotation * Math.PI / 180) > .7 && Math.cos(state.phoneTilt * Math.PI / 180) > .7));
  document.querySelector('#view-back')!.setAttribute('aria-pressed', String(Math.cos(state.phoneRotation * Math.PI / 180) < -.7 && Math.cos(state.phoneTilt * Math.PI / 180) > .7));
  if (renderedFold !== state.foldProgress || renderedRotation !== state.phoneRotation || renderedTilt !== state.phoneTilt) frame = requestAnimationFrame(render);
  else frame = 0;
};
const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
const rotate = (angle: number, tilt = 0) => { state.phoneRotation = angle; state.phoneTilt = tilt; schedule(); };
setupPhone(phone, rotate, () => state.phoneRotation, () => state.phoneTilt, () => isReadable() && !inspecting, reader.change);
const applyFold = () => {
  state.foldProgress = Number(fold.value);
  document.querySelector('#fold-value')!.textContent = `${fold.value}%`;
  fold.setAttribute('aria-valuetext', `${fold.value}%，${state.foldProgress >= 98 ? '完全展開，可以閱讀留言' : state.foldProgress === 0 ? '完全闔起' : '展開中'}`);
  fold.style.setProperty('--range-fill', `${fold.value}%`);
  schedule();
};
fold.addEventListener('input', applyFold);
// The lock-screen cue is the control it looks like: tapping it opens the phone.
document.querySelector('#lock-open')!.addEventListener('click', () => { fold.value = '100'; applyFold(); });
document.querySelector('#inspect')!.addEventListener('click', () => {
  inspecting = !inspecting;
  phone.classList.toggle('inspecting', inspecting);
  document.querySelector('#inspect')!.setAttribute('aria-pressed', String(inspecting));
  schedule();
});
document.querySelector('#view-front')!.addEventListener('click', () => {
  if (inspecting) (document.querySelector('#inspect') as HTMLButtonElement).click();
  rotate(0);
});
document.querySelector('#view-back')!.addEventListener('click', () => rotate(180));
reducedMotion.addEventListener('change', schedule);
new ResizeObserver(() => { fitDevice(); reader.refit(); }).observe(stage);
addEventListener('resize', fitDevice);
fitDevice();
render();
