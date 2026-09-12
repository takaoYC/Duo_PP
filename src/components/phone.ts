import saturn from '../assets/pp12/saturn.svg?url';

export function phoneMarkup() {
  return `
    <section class="device-stage" aria-label="Duo PP 可摺疊紀念手機">
      <div class="stage-bloom" aria-hidden="true"></div>
      <div class="ambient-orbit orbit-far" aria-hidden="true"></div>
      <div class="ambient-orbit" aria-hidden="true"></div>
      <div class="device-shadow" aria-hidden="true"></div>
      <div class="phone" id="phone" tabindex="0" role="group" aria-label="手機模型：拖曳可全方向旋轉，聚焦後用方向鍵旋轉；按 Home 回到正面">
        <div class="half half-left">
          <div class="face inside inside-left" aria-hidden="true"><span class="inner-year">2014</span><img src="${saturn}" alt="" /></div>
          <div class="face cover">
            <div class="lock-screen">
              <span class="lock-year" aria-hidden="true">2014</span>
              <div class="lock-art" aria-hidden="true"><img src="${saturn}" alt="" /></div>
              <div class="lock-brand" aria-hidden="true">PP YAO<span>12th ANNIVERSARY</span></div>
              <button type="button" class="lock-cue" id="lock-open" aria-label="展開手機，閱讀留言"><span aria-hidden="true">⌄</span></button>
            </div>
          </div>
          <div class="edge edge-outer"></div><div class="edge-cap edge-top"></div><div class="edge-cap edge-bottom"></div>
        </div>
        <div class="hinge" aria-hidden="true"></div>
        <div class="half half-right" aria-hidden="true">
          <div class="face inside inside-right"><span class="inner-year">2026</span><p>從一顆星<br>到很多人留下的星光</p></div>
          <div class="face back" aria-hidden="true"><div class="back-inlay"><img src="${saturn}" alt="" /></div><span class="back-date">2014から</span></div>
          <div class="edge edge-outer"></div><div class="edge-cap edge-top"></div><div class="edge-cap edge-bottom"></div>
        </div>
        <div class="message-screen" id="message-screen" inert>
          <article class="message-card" id="message-card" aria-label="粉絲留言卡">
            <div class="paper-heading" aria-hidden="true"><span>A LITTLE LIGHT, FOR YOU</span><span>✧</span></div>
            <div class="card-copy" id="card-copy"><p id="card-message"></p><p class="signature"><span>—</span> <span id="card-author"></span></p></div>
            <div class="paper-foot" aria-hidden="true"><span>PP YAO · 12th ANNIVERSARY</span><span>2026</span></div>
          </article>
        </div>
      </div>
    </section>`;
}

export function setupPhone(
  phone: HTMLElement,
  rotate: (angle: number, tilt: number) => void,
  rotation: () => number,
  tilt: () => number,
  messageMode: () => boolean,
  next: (direction: number) => void,
) {
  let gesture: { id: number; x: number; y: number; angle: number; tilt: number; card: boolean; intent: 'pending' | 'swipe' | 'rotate' } | null = null;
  phone.addEventListener('keydown', event => {
    if (event.target !== phone) return;
    const turns: Record<string, [number, number]> = {ArrowLeft: [-15,0], ArrowRight: [15,0], ArrowUp: [0,15], ArrowDown: [0,-15]};
    if (turns[event.key]) {event.preventDefault(); event.stopPropagation(); const [y,x] = turns[event.key]; rotate(rotation()+y,tilt()+x);}
    if (event.key === 'Home') {event.preventDefault(); rotate(0,0);}
  });
  phone.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    // Controls on the body keep their own clicks: capturing the pointer here
    // would retarget the click to the phone and the button would never fire.
    if ((event.target as HTMLElement).closest('button')) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: rotation(), tilt: tilt(),
      card: messageMode() && !!(event.target as HTMLElement).closest('.message-screen'), intent: 'pending' };
    phone.setPointerCapture(event.pointerId);
    phone.classList.add('dragging');
  });
  phone.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (gesture.intent === 'pending') {
      if (Math.hypot(dx, dy) < 8) return;
      gesture.intent = gesture.card && Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'rotate';
    }
    if (gesture.intent === 'swipe') return;
    rotate(gesture.angle + (event.clientX - gesture.x) * .65, gesture.tilt - (event.clientY - gesture.y) * .65);
  });
  const finish = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (event.type === 'pointerup' && gesture.intent === 'swipe' && Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.3) next(dx < 0 ? 1 : -1);
    gesture = null;
    phone.classList.remove('dragging');
  };
  phone.addEventListener('pointerup', finish);
  phone.addEventListener('pointercancel', finish);
  phone.addEventListener('lostpointercapture', () => { gesture = null; phone.classList.remove('dragging'); });
}
