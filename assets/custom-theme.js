(() => {
  const dragTargets = [
    {
      componentSelector: 'slider-component[data-drag-scroll="homepage-best-sellers"]',
      trackSelector: '.slider',
    },
    {
      componentSelector: '[data-ersa-social-gallery]',
      trackSelector: '.ersa-social-gallery__track',
    },
    {
      componentSelector: '[data-ersa-product-ugc]',
      trackSelector: '.ersa-product-ugc-videos__track',
    },
  ];
  const dragThreshold = 6;
  const controllers = new WeakMap();

  function getComponents(scope, selector) {
    const components = [];

    if (scope instanceof Element && scope.matches(selector)) components.push(scope);
    components.push(...scope.querySelectorAll(selector));

    return components;
  }

  function initDragSlider(component, trackSelector) {
    if (!component || component.dataset.dragScrollReady === 'true') return;

    const slider = component.querySelector(trackSelector);
    if (!slider) return;

    component.dataset.dragScrollReady = 'true';

    const controller = new AbortController();
    const { signal } = controller;
    controllers.set(component, controller);

    let pointerId = null;
    let startX = 0;
    let startScrollLeft = 0;
    let didDrag = false;

    const hasFinePointer = () => window.matchMedia('(pointer:fine)').matches;

    const reset = () => {
      pointerId = null;
      slider.classList.remove('is-dragging');
    };

    slider.addEventListener('dragstart', (event) => event.preventDefault(), { signal });

    slider.addEventListener('pointerdown', (event) => {
      if (!hasFinePointer() || event.pointerType !== 'mouse' || event.button !== 0) return;

      pointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = slider.scrollLeft;
      didDrag = false;

      slider.setPointerCapture?.(pointerId);
      slider.classList.add('is-dragging');
    }, { signal });

    slider.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId) return;

      const deltaX = event.clientX - startX;
      if (!didDrag && Math.abs(deltaX) <= dragThreshold) return;

      didDrag = true;
      slider.scrollLeft = startScrollLeft - deltaX;
      event.preventDefault();
    }, { signal });

    const completeDrag = (event) => {
      if (pointerId !== event.pointerId) return;

      slider.dataset.dragMoved = didDrag ? 'true' : 'false';
      reset();

      window.setTimeout(() => {
        slider.dataset.dragMoved = 'false';
      }, 0);
    };

    slider.addEventListener('pointerup', completeDrag, { signal });
    slider.addEventListener('pointercancel', completeDrag, { signal });

    slider.addEventListener(
      'click',
      (event) => {
        if (slider.dataset.dragMoved === 'true') {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { capture: true, signal }
    );
  }

  function destroyAll(root = document) {
    dragTargets.forEach(({ componentSelector }) => {
      getComponents(root, componentSelector).forEach((component) => {
        controllers.get(component)?.abort();
        controllers.delete(component);
        delete component.dataset.dragScrollReady;
      });
    });
  }

  function initAll(root = document) {
    dragTargets.forEach(({ componentSelector, trackSelector }) => {
      getComponents(root, componentSelector).forEach((component) => initDragSlider(component, trackSelector));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll(document), { once: true });
  } else {
    initAll(document);
  }
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
  document.addEventListener('shopify:section:unload', (event) => destroyAll(event.target));
})();

