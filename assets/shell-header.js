if (!customElements.get('sticky-header')) {
  class StickyHeader extends HTMLElement {
    connectedCallback() {
      this.header = this.closest('.shopify-section') || document.querySelector('.section-header');
      if (!this.header) return;

      this.updateScrollState();
      this.headerIsAlwaysSticky =
        this.getAttribute('data-sticky-type') === 'always' ||
        this.getAttribute('data-sticky-type') === 'reduce-logo-size';
      this.headerBounds = {};
      this.currentScrollTop = 0;
      this.preventReveal = false;
      this.predictiveSearch = this.querySelector('predictive-search');

      this.onHeaderHeightChange = this.setHeaderHeight.bind(this);
      this.onScrollHandler = this.onScroll.bind(this);
      this.hideHeaderOnScrollUp = () => (this.preventReveal = true);
      this.headerHeightMediaQuery = window.matchMedia('(max-width: 990px)');

      this.setHeaderHeight();
      this.headerHeightMediaQuery.addEventListener('change', this.onHeaderHeightChange);
      this.addEventListener('preventHeaderReveal', this.hideHeaderOnScrollUp);
      window.addEventListener('scroll', this.onScrollHandler, false);

      if (this.headerIsAlwaysSticky) this.header.classList.add('shopify-section-header-sticky');
      this.createObserver();
    }

    disconnectedCallback() {
      this.removeEventListener('preventHeaderReveal', this.hideHeaderOnScrollUp);
      window.removeEventListener('scroll', this.onScrollHandler);
      this.headerHeightMediaQuery?.removeEventListener('change', this.onHeaderHeightChange);
      this.headerObserver?.disconnect();
      window.clearTimeout(this.isScrolling);
    }

    setHeaderHeight() {
      if (!this.header) return;
      document.documentElement.style.setProperty('--header-height', `${this.header.offsetHeight}px`);
    }

    updateScrollState(scrollTop = window.pageYOffset || document.documentElement.scrollTop) {
      this.header?.classList.toggle('header-is-scrolled', scrollTop > 1);
    }

    createObserver() {
      this.headerObserver = new IntersectionObserver((entries, observer) => {
        this.headerBounds = entries[0].intersectionRect;
        observer.disconnect();
      });
      this.headerObserver.observe(this.header);
    }

    onScroll() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      this.updateScrollState(scrollTop);

      if (this.predictiveSearch?.isOpen) return;

      if (scrollTop > this.currentScrollTop && scrollTop > this.headerBounds.bottom) {
        this.header.classList.add('scrolled-past-header');
        if (this.preventHide) return;
        requestAnimationFrame(this.hide.bind(this));
      } else if (scrollTop < this.currentScrollTop && scrollTop > this.headerBounds.bottom) {
        this.header.classList.add('scrolled-past-header');
        if (!this.preventReveal) {
          requestAnimationFrame(this.reveal.bind(this));
        } else {
          window.clearTimeout(this.isScrolling);
          this.isScrolling = setTimeout(() => {
            this.preventReveal = false;
          }, 66);
          requestAnimationFrame(this.hide.bind(this));
        }
      } else if (scrollTop <= this.headerBounds.top) {
        this.header.classList.remove('scrolled-past-header');
        requestAnimationFrame(this.reset.bind(this));
      }

      this.currentScrollTop = scrollTop;
    }

    hide() {
      if (this.headerIsAlwaysSticky) return;
      this.header.classList.add('shopify-section-header-hidden', 'shopify-section-header-sticky');
      this.closeMenuDisclosure();
      this.closeSearchModal();
    }

    reveal() {
      if (this.headerIsAlwaysSticky) return;
      this.header.classList.add('shopify-section-header-sticky', 'animate');
      this.header.classList.remove('shopify-section-header-hidden');
    }

    reset() {
      if (this.headerIsAlwaysSticky) return;
      this.header.classList.remove('shopify-section-header-hidden', 'shopify-section-header-sticky', 'animate');
    }

    closeMenuDisclosure() {
      this.disclosures = this.disclosures || this.header.querySelectorAll('header-menu');
      this.disclosures.forEach((disclosure) => disclosure.close());
    }

    closeSearchModal() {
      this.searchModal = this.searchModal || this.header.querySelector('details-modal');
      this.searchModal?.close(false);
    }
  }

  customElements.define('sticky-header', StickyHeader);
}
