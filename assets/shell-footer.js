(function initializeFooterShell(root) {
  if (root.ErsaFooterShell) {
    root.ErsaFooterShell.init(document);
    return;
  }

  const initializedHeadings = new WeakSet();

  function toggleAccordion(event) {
    if (window.innerWidth >= 750) return;
    event.preventDefault();
    const heading = event.currentTarget;
    const expanded = heading.getAttribute('aria-expanded') === 'true';
    const content = heading.nextElementSibling;

    heading.setAttribute('aria-expanded', String(!expanded));
    if (!content) return;
    content.style.maxHeight = expanded ? null : `${content.scrollHeight}px`;
    heading.classList.toggle('is-expanded', !expanded);
  }

  function init(scope = document) {
    scope.querySelectorAll('.footer-block__heading.footer-title__button').forEach((heading) => {
      if (initializedHeadings.has(heading)) return;
      heading.addEventListener('click', toggleAccordion);
      initializedHeadings.add(heading);
    });
  }

  function resetDesktop() {
    if (window.innerWidth < 750) return;
    document.querySelectorAll('.footer-block__mobile-accordion-content').forEach((content) => {
      content.style.maxHeight = null;
    });
    document.querySelectorAll('.footer-block__heading.footer-title__button').forEach((heading) => {
      heading.classList.remove('is-expanded');
      heading.setAttribute('aria-expanded', 'false');
    });
  }

  root.ErsaFooterShell = { init, resetDesktop };
  window.addEventListener('resize', resetDesktop);
  document.addEventListener('shopify:section:load', (event) => init(event.target));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(document), { once: true });
  } else {
    init(document);
  }
})(window);
