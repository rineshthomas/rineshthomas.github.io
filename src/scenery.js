(() => {
  const backdrop = document.querySelector('.world-backdrop');
  const tint = backdrop.querySelector('.world-tint');
  const templates = [...backdrop.querySelectorAll('template[data-landscape]')];
  const layers = new Map();
  let position = 0;

  function prepare(zone) {
    if (!zone || zone > templates.length || layers.has(zone)) return;
    const picture = templates[zone - 1].content.firstElementChild.cloneNode(true);
    const image = picture.querySelector('img');
    picture.dataset.zone = String(zone);
    picture.style.zIndex = String(zone);
    layers.set(zone, picture);
    backdrop.insertBefore(picture, tint);
    // A late download fades in over the last decoded landscape. Its opacity
    // still follows the latest scroll position if the visitor has turned back.
    image.decode().then(() => picture.classList.add('decoded')).catch(() => {
      picture.remove();
      layers.delete(zone);
    });
  }

  function compose(next) {
    position = Math.max(0, Math.min(next, templates.length));
    const near = Math.floor(position);
    prepare(near);
    prepare(near + 1);
    for (const [zone, picture] of layers) {
      // Opaque art underneath, just one translucent landscape above: at the
      // midpoint there is no dark dip or third world bleeding through.
      const weight = Math.min(1, Math.max(0, position - zone + 1));
      picture.style.opacity = String(weight);
    }
  }

  document.addEventListener('worldjourney', event => compose(event.detail.position));
  compose(window.logicWorld?.snapshot().position || 0);
})();
