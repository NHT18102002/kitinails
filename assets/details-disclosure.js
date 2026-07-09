class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector('details');
    this.content = this.mainDetailsToggle.querySelector('summary').nextElementSibling;

    this.mainDetailsToggle.addEventListener('focusout', this.onFocusOut.bind(this));
    this.mainDetailsToggle.addEventListener('toggle', this.onToggle.bind(this));
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onToggle() {
    if (!this.animations) this.animations = this.content.getAnimations();

    if (this.mainDetailsToggle.hasAttribute('open')) {
      this.animations.forEach((animation) => animation.play());
    } else {
      this.animations.forEach((animation) => animation.cancel());
    }
  }

  close() {
    this.mainDetailsToggle.removeAttribute('open');
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
  }

  open() {
    this.mainDetailsToggle.setAttribute('open', '');
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', true);
  }
}

customElements.define('details-disclosure', DetailsDisclosure);

class HeaderMenu extends DetailsDisclosure {
  constructor() {
    super();
    this.header = document.querySelector('.header-wrapper');
    this.setupDesktopHoverMenu();
  }

  setupDesktopHoverMenu() {
    this.desktopHoverMedia = window.matchMedia('(min-width: 990px) and (hover: hover) and (pointer: fine)');
    this.hoverCloseTimer = null;

    this.mainDetailsToggle.addEventListener('mouseenter', this.onDesktopMouseEnter.bind(this));
    this.mainDetailsToggle.addEventListener('mouseleave', this.onDesktopMouseLeave.bind(this));

    if (this.content) {
      this.content.addEventListener('mouseenter', this.onDesktopMouseEnter.bind(this));
      this.content.addEventListener('mouseleave', this.onDesktopMouseLeave.bind(this));
    }
  }

  onDesktopMouseEnter() {
    if (!this.desktopHoverMedia.matches) return;

    window.clearTimeout(this.hoverCloseTimer);
    document.querySelectorAll('header-menu').forEach((menu) => {
      if (menu !== this && typeof menu.close === 'function') menu.close();
    });
    this.open();
  }

  onDesktopMouseLeave() {
    if (!this.desktopHoverMedia.matches) return;

    window.clearTimeout(this.hoverCloseTimer);
    this.hoverCloseTimer = window.setTimeout(() => {
      if (!this.mainDetailsToggle.matches(':hover') && !this.contains(document.activeElement)) {
        this.close();
      }
    }, 120);
  }

  onToggle() {
    if (!this.header) return;
    this.header.preventHide = this.mainDetailsToggle.open;

    if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '') return;
    document.documentElement.style.setProperty(
      '--header-bottom-position-desktop',
      `${Math.floor(this.header.getBoundingClientRect().bottom)}px`
    );
  }
}

customElements.define('header-menu', HeaderMenu);
