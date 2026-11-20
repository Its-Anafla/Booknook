// Drag and drop reordering with Pointer Events (mouse, pen and touch).
// Mouse: drag after moving a few pixels. Touch: long-press, so normal scrolling still works.
// Keyboard: focus a book or decoration, then press Alt + Arrow Left / Right.

import { h } from '../utils.js';

const MOVE_THRESHOLD = 6;
const LONG_PRESS_MS = 320;

export function enableReorder(container, { onDrop, onKeyboardMove }) {
  let drag = null;
  let marker = null;
  let scrollFrame = 0;
  let lastPointer = { x: 0, y: 0 };

  const items = () => [...container.querySelectorAll('.shelf-item')];

  function pickTarget(x, y, dragged) {
    let best = null;
    let bestDistance = Infinity;
    for (const item of items()) {
      if (item === dragged) continue;
      const rect = item.getBoundingClientRect();
      const dx = x - (rect.left + rect.width / 2);
      const dy = (y - (rect.top + rect.height / 2)) * 2.2; // prefer the same shelf row
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { item, rect, after: x > rect.left + rect.width / 2 };
      }
    }
    return best;
  }

  function placeMarker(target) {
    if (!target) { marker?.remove(); marker = null; return; }
    if (!marker) { marker = h('div', { class: 'drop-marker' }); document.body.append(marker); }
    const { rect, after } = target;
    marker.style.left = `${(after ? rect.right : rect.left) - 2}px`;
    marker.style.top = `${rect.top}px`;
    marker.style.height = `${rect.height}px`;
  }

  function autoScroll() {
    if (!drag?.active) return;
    const edge = 80;
    if (lastPointer.y < edge) window.scrollBy(0, -14);
    else if (window.innerHeight - lastPointer.y < edge) window.scrollBy(0, 14);
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function activate(event) {
    if (!drag || drag.active) return;
    drag.active = true;
    const rect = drag.item.getBoundingClientRect();
    drag.offsetX = event.clientX - rect.left;
    drag.offsetY = event.clientY - rect.top;
    drag.ghost = drag.item.cloneNode(true);
    drag.ghost.classList.add('drag-ghost');
    drag.ghost.removeAttribute('id');
    drag.ghost.style.width = `${rect.width}px`;
    drag.ghost.style.height = `${rect.height}px`;
    document.body.append(drag.ghost);
    drag.item.classList.add('is-dragging');
    document.body.classList.add('is-reordering');
    if (drag.touch && navigator.vibrate) navigator.vibrate(12);
    moveGhost(event);
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function moveGhost(event) {
    lastPointer = { x: event.clientX, y: event.clientY };
    drag.ghost.style.transform = `translate(${event.clientX - drag.offsetX}px, ${event.clientY - drag.offsetY}px) rotate(-3deg) scale(1.04)`;
    drag.target = pickTarget(event.clientX, event.clientY, drag.item);
    placeMarker(drag.target);
  }

  function finish(commit) {
    if (!drag) return;
    clearTimeout(drag.timer);
    cancelAnimationFrame(scrollFrame);
    const { item, ghost, target, active } = drag;
    drag = null;
    marker?.remove();
    marker = null;
    ghost?.remove();
    item.classList.remove('is-dragging');
    document.body.classList.remove('is-reordering');
    if (active) {
      container.dataset.justDragged = '1';
      setTimeout(() => delete container.dataset.justDragged, 0);
      if (commit && target) onDrop(item.dataset.token, target.item.dataset.token, target.after);
    }
  }

  container.addEventListener('pointerdown', (event) => {
    if (event.button > 0 || event.target.closest('.decor-remove')) return;
    const item = event.target.closest('.shelf-item');
    if (!item || !container.contains(item)) return;
    drag = { item, startX: event.clientX, startY: event.clientY, active: false, touch: event.pointerType !== 'mouse', timer: 0 };
    if (drag.touch) drag.timer = setTimeout(() => activate(event), LONG_PRESS_MS);
  });

  const onPointerMove = (event) => {
    if (!drag) return;
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.active) {
      if (drag.touch) { if (moved > 10) finish(false); } // finger moved: the person is scrolling
      else if (moved > MOVE_THRESHOLD) activate(event);
      return;
    }
    moveGhost(event);
  };
  const onPointerUp = () => finish(true);
  const onPointerCancel = () => finish(false);
  // Once a touch drag has started, stop the page from scrolling under the finger.
  const onTouchMove = (event) => { if (drag?.active) event.preventDefault(); };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerCancel);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('contextmenu', (event) => { if (drag) event.preventDefault(); });
  container.addEventListener('dragstart', (event) => event.preventDefault());

  // A drag must not also count as a click on the book underneath.
  container.addEventListener('click', (event) => {
    if (container.dataset.justDragged) { event.stopPropagation(); event.preventDefault(); }
  }, true);

  container.addEventListener('keydown', (event) => {
    const item = event.target.closest?.('.shelf-item');
    if (!item || !event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    onKeyboardMove(item.dataset.token, event.key === 'ArrowLeft' ? -1 : 1);
  });

  // Called when the view is replaced, so listeners on `document` never pile up.
  return () => {
    finish(false);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerCancel);
    document.removeEventListener('touchmove', onTouchMove);
  };
}
