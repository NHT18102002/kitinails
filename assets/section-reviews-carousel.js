(() => {
  const globalKey = '__ersaReviewsCarousel';
  const sectionSelector = '.section-ersa-reviews-carousel';

  if (window[globalKey]) {
    window[globalKey].init(document);
    return;
  }

  const instances = new WeakMap();

  const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const getSections = (scope) => {
    if (!scope) return [];

    const sections = [];
    if (scope.matches && scope.matches(sectionSelector)) sections.push(scope);
    if (scope.querySelectorAll) {
      scope.querySelectorAll(sectionSelector).forEach((section) => sections.push(section));
    }
    return sections;
  };

  const initSection = (section) => {
    if (!section || instances.has(section)) return;

    const track = section.querySelector('.ersa-reviews-carousel__track');
    const previous = section.querySelector('[data-reviews-carousel-prev]');
    const next = section.querySelector('[data-reviews-carousel-next]');
    if (!track || !previous || !next) return;

    const cleanups = [];
    let frameId = 0;

    const listen = (target, eventName, handler, options) => {
      target.addEventListener(eventName, handler, options);
      cleanups.push(() => target.removeEventListener(eventName, handler, options));
    };

    const updateButtons = () => {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const hasOverflow = maxScroll > 1;
      previous.disabled = !hasOverflow;
      next.disabled = !hasOverflow;
      previous.setAttribute('aria-disabled', String(previous.disabled));
      next.setAttribute('aria-disabled', String(next.disabled));
    };

    const scheduleButtonUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateButtons();
      });
    };

    const getStep = () => {
      const card = track.querySelector('.ersa-reviews-carousel__card');
      if (!card) return track.clientWidth;
      const styles = window.getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap || 0);
      return card.getBoundingClientRect().width + gap;
    };

    const scrollToPosition = (left) => {
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      if (typeof track.scrollTo === 'function') {
        track.scrollTo({ left, behavior });
      } else {
        track.scrollLeft = left;
      }
    };

    const scrollByCard = (direction) => {
      const distance = getStep() || track.clientWidth;
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      if (maxScroll <= 1) return;

      const atStart = track.scrollLeft <= 1;
      const atEnd = track.scrollLeft >= maxScroll - 1;

      if (direction < 0 && atStart) {
        scrollToPosition(maxScroll);
      } else if (direction > 0 && atEnd) {
        scrollToPosition(0);
      } else {
        scrollToPosition(Math.max(0, Math.min(maxScroll, track.scrollLeft + direction * distance)));
      }

      scheduleButtonUpdate();
    };

    const handleKeydown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollByCard(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollByCard(1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        scrollToPosition(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        scrollToPosition(track.scrollWidth);
      }
    };

    listen(previous, 'click', () => scrollByCard(-1));
    listen(next, 'click', () => scrollByCard(1));
    listen(track, 'scroll', scheduleButtonUpdate, { passive: true });
    listen(track, 'keydown', handleKeydown);

    if (typeof window.ResizeObserver === 'function') {
      const resizeObserver = new window.ResizeObserver(scheduleButtonUpdate);
      resizeObserver.observe(track);
      cleanups.push(() => resizeObserver.disconnect());
    } else {
      listen(window, 'resize', scheduleButtonUpdate, { passive: true });
    }

    updateButtons();

    instances.set(section, {
      destroy() {
        if (frameId) window.cancelAnimationFrame(frameId);
        cleanups.splice(0).forEach((cleanup) => cleanup());
        section.removeAttribute('data-reviews-carousel-initialized');
      },
    });
    section.setAttribute('data-reviews-carousel-initialized', 'true');
  };

  const destroySection = (scope) => {
    getSections(scope).forEach((section) => {
      const instance = instances.get(section);
      if (!instance) return;
      instance.destroy();
      instances.delete(section);
    });
  };

  const init = (scope = document) => {
    getSections(scope).forEach(initSection);
  };

  window[globalKey] = { init, destroy: destroySection };

  document.addEventListener('shopify:section:load', (event) => init(event.target));
  document.addEventListener('shopify:section:unload', (event) => destroySection(event.target));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(document), { once: true });
  } else {
    init(document);
  }
})();
