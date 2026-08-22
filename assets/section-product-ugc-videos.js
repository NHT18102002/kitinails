(function initializeProductUgc(root) {
  if (root.ErsaProductUgc) {
    root.ErsaProductUgc.init(document);
    return;
  }

  function init(scope = document) {
    scope.querySelectorAll('[data-ersa-product-ugc]').forEach((section) => {
      if (section.dataset.ersaProductUgcReady === 'true') return;
      const track = section.querySelector('.ersa-product-ugc-videos__track');
      const previous = section.querySelector('[data-ersa-product-ugc-prev]');
      const next = section.querySelector('[data-ersa-product-ugc-next]');
      if (!track || !previous || !next) return;

      section.dataset.ersaProductUgcReady = 'true';
      track.scrollLeft = 0;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        section.querySelectorAll('video').forEach((video) => {
          video.removeAttribute('autoplay');
          video.pause();
        });
      }

      const scrollByCard = (direction) => {
        const firstCard = track.querySelector('.ersa-product-ugc-videos__item');
        const styles = getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || 0);
        const distance = firstCard ? firstCard.getBoundingClientRect().width + gap : 240;
        track.scrollBy({ left: direction * distance, behavior: 'smooth' });
      };

      previous.addEventListener('click', () => scrollByCard(-1));
      next.addEventListener('click', () => scrollByCard(1));
    });
  }

  root.ErsaProductUgc = { init };
  document.addEventListener('shopify:section:load', (event) => init(event.target));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(document), { once: true });
  } else {
    init(document);
  }
})(window);
