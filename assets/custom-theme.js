(() => {
  const sliderSelector = 'slider-component[data-drag-scroll="homepage-best-sellers"]';
  const dragThreshold = 6;

  function initDragSlider(component) {
    if (!component || component.dataset.dragReady === 'true') return;

    const slider = component.querySelector('.slider');
    if (!slider) return;

    component.dataset.dragReady = 'true';

    let isMouseDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let didDrag = false;

    const hasFinePointer = () => window.matchMedia('(pointer:fine)').matches;

    const reset = () => {
      isMouseDown = false;
      slider.classList.remove('is-dragging');
    };

    slider.addEventListener('dragstart', (event) => event.preventDefault());

    slider.addEventListener('mousedown', (event) => {
      if (!hasFinePointer() || event.button !== 0) return;

      isMouseDown = true;
      startX = event.clientX;
      startScrollLeft = slider.scrollLeft;
      didDrag = false;

      slider.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (event) => {
      if (!isMouseDown) return;

      const deltaX = event.clientX - startX;
      if (Math.abs(deltaX) > dragThreshold) didDrag = true;

      slider.scrollLeft = startScrollLeft - deltaX;

      if (didDrag) event.preventDefault();
    });

    const completeDrag = () => {
      if (!isMouseDown) return;

      slider.dataset.dragMoved = didDrag ? 'true' : 'false';
      reset();

      window.setTimeout(() => {
        slider.dataset.dragMoved = 'false';
      }, 0);
    };

    window.addEventListener('mouseup', completeDrag);

    slider.addEventListener(
      'click',
      (event) => {
        if (slider.dataset.dragMoved === 'true') {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );
  }

  function initAll(root = document) {
    root.querySelectorAll(sliderSelector).forEach(initDragSlider);
  }

  document.addEventListener('DOMContentLoaded', () => initAll(document), { once: true });
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
})();

