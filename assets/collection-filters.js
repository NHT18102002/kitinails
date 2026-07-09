(() => {
  if (window.__ersaCollectionFiltersInitialized) return;

  const collectionMain = document.querySelector("main[data-template='collection']");
  if (!collectionMain) return;

  window.__ersaCollectionFiltersInitialized = true;

  const helpers = window.ErsaCollectionFiltersHelpers || {};
  const REFERENCE_FILTER_LABELS = helpers.REFERENCE_FILTER_LABELS || ['Color', 'Length', 'Shape', 'Style'];
  const selectCollectionFilterGroups =
    helpers.selectCollectionFilterGroups ||
    ((groups) => ({
      groups: Array.isArray(groups) ? groups.slice() : [],
      strictReferenceMode: false,
    }));
  const buildClearAllSearchParams =
    helpers.buildClearAllSearchParams ||
    ((entries) => {
      const params = new URLSearchParams();
      Array.from(entries || []).forEach(([key, value]) => {
        if (key === 'sort_by' && value) params.append(key, value);
      });
      return params.toString();
    });

  const state = {
    mobileApplying: false,
    mobileDirty: false,
    strictReferenceMode: false,
  };

  const escapeSelector = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return value.replace(/["\\]/g, '\\$&');
  };

  const getRoot = () => document.querySelector('[data-collection-filters-root]');
  const getFilterToggle = () => document.querySelector('[data-collection-filter-toggle]');
  const getFilterPanel = () => document.querySelector('[data-collection-filter-panel]');
  const getSortToggle = () => document.querySelector('[data-collection-sort-toggle]');
  const getSortPanel = () => document.querySelector('[data-collection-sort-panel]');
  const getMobileDrawer = () => document.querySelector('menu-drawer.mobile-facets__wrapper');
  const getMobileDisclosure = () => document.querySelector('[data-mobile-facets-disclosure]');
  const getMobileSummary = () => getMobileDisclosure()?.querySelector('summary');
  const getMobileForm = () => document.getElementById('FacetFiltersFormMobile');
  const isDesktopViewport = () => window.matchMedia('(min-width: 750px)').matches;
  const readFilterLabel = (element) =>
    element?.dataset.filterLabel?.trim() ||
    element?.querySelector('.facets__summary-label, .mobile-facets__summary span, .mobile-facets__close-button span')
      ?.textContent?.trim() ||
    '';

  const setMobileDirty = (isDirty) => {
    state.mobileDirty = Boolean(isDirty);
    getMobileDrawer()?.classList.toggle('is-mobile-filter-dirty', state.mobileDirty);
    getMobileForm()?.classList.toggle('is-mobile-filter-dirty', state.mobileDirty);
  };

  const setFilterPanelOpen = (isOpen) => {
    const root = getRoot();
    const toggle = getFilterToggle();
    if (!root || !toggle) return;

    const nextState = state.strictReferenceMode ? true : isOpen;
    root.classList.toggle('is-filter-panel-open', nextState);
    toggle.setAttribute('aria-expanded', String(nextState));
  };

  const setSortPanelOpen = (isOpen) => {
    const panel = getSortPanel();
    const toggle = getSortToggle();
    const sortWrapper = toggle?.closest('.collection-toolbar__sort');
    if (!panel || !toggle) return;

    if (isOpen) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }

    sortWrapper?.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  };

  const syncDesktopControls = () => {
    const root = getRoot();
    const toggle = getFilterToggle();
    if (toggle) {
      toggle.setAttribute(
        'aria-expanded',
        String(state.strictReferenceMode || Boolean(root?.classList.contains('is-filter-panel-open')))
      );
    }

    const sortPanel = getSortPanel();
    const sortToggle = getSortToggle();
    const sortOpen = Boolean(sortPanel && !sortPanel.hasAttribute('hidden'));
    if (sortToggle) sortToggle.setAttribute('aria-expanded', String(sortOpen));
  };

  const resetMobileDraft = () => {
    const form = getMobileForm();
    if (!form) return;
    form.reset();
    setMobileDirty(false);
  };

  const clearControl = (control) => {
    if (!control || control.disabled || control.type === 'hidden') return;

    if (control.tagName === 'SELECT') {
      control.selectedIndex = 0;
      return;
    }

    if (control.type === 'checkbox' || control.type === 'radio') {
      control.checked = false;
      return;
    }

    control.value = '';
  };

  const clearMobileGroup = (button) => {
    const form = getMobileForm();
    const names = button?.dataset.filterParamNames
      ?.split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    if (!form || !names || !names.length) return;

    names.forEach((name) => {
      form.querySelectorAll(`[name="${escapeSelector(name)}"]`).forEach(clearControl);
    });

    setMobileDirty(true);
  };

  const clearAllMobileFilters = () => {
    const form = getMobileForm();
    if (!form) return;

    const preservedSearch = buildClearAllSearchParams(Array.from(new FormData(form).entries()));
    const preservedSort = new URLSearchParams(preservedSearch).get('sort_by') || '';

    form.querySelectorAll('input, select').forEach((control) => {
      if (control.name === 'sort_by') return;
      clearControl(control);
    });

    if (preservedSort) {
      form.querySelectorAll('[name="sort_by"]').forEach((control) => {
        if (control.type === 'radio') {
          control.checked = control.value === preservedSort;
          return;
        }

        control.value = preservedSort;
      });
    }

    setMobileDirty(true);
  };

  const closeMobileDrawer = () => {
    const summary = getMobileSummary();
    const disclosure = getMobileDisclosure();
    if (!summary || !disclosure?.hasAttribute('open')) return;
    summary.click();
  };

  const applyMobileFilters = () => {
    const form = getMobileForm();
    if (!form || typeof FacetFiltersForm === 'undefined') return;

    const searchParams = new URLSearchParams();
    const formData = new FormData(form);

    formData.forEach((value, key) => {
      if (value === '') return;
      searchParams.append(key, value);
    });

    state.mobileApplying = true;
    setMobileDirty(false);
    closeMobileDrawer();
    FacetFiltersForm.renderPage(searchParams.toString(), null, true);
  };

  const reorderFilterGroupContainer = (container) => {
    if (!container) {
      return {
        strictReferenceMode: false,
        groups: [],
      };
    }

    const groups = Array.from(container.querySelectorAll('[data-collection-filter-group]')).map((element) => ({
      element,
      label: readFilterLabel(element),
    }));

    if (!groups.length) {
      return {
        strictReferenceMode: false,
        groups: [],
      };
    }

    const firstGroup = groups[0]?.element;
    const selection = selectCollectionFilterGroups(groups, { preferredLabels: REFERENCE_FILTER_LABELS });
    const selectedElements = new Set(selection.groups.map((group) => group.element));

    groups.forEach(({ element }) => {
      if (selection.strictReferenceMode) {
        element.hidden = !selectedElements.has(element);
      } else {
        element.hidden = false;
      }
    });

    if (!selection.groups.length || !firstGroup) {
      return selection;
    }

    const marker = document.createElement('span');
    marker.hidden = true;
    marker.setAttribute('data-filter-order-marker', '');
    container.insertBefore(marker, firstGroup);

    const fragment = document.createDocumentFragment();
    selection.groups.forEach(({ element }) => {
      fragment.appendChild(element);
      if (element.matches('.facets__disclosure-vertical')) {
        element.open = true;
      }
    });

    container.insertBefore(fragment, marker.nextSibling);
    marker.remove();
    return selection;
  };

  const setReferenceDesktopLayout = (isEnabled) => {
    const root = getRoot();
    const panel = getFilterPanel();
    const toolbar = document.querySelector('[data-collection-toolbar]');

    state.strictReferenceMode = isEnabled;
    root?.classList.toggle('is-reference-filter-layout', isEnabled);
    panel?.classList.toggle('is-reference-filter-layout', isEnabled);
    toolbar?.classList.toggle('is-reference-filter-layout', isEnabled);
    setFilterPanelOpen(isEnabled);
  };

  const applyReferenceFilterLayout = () => {
    const desktopSelection = reorderFilterGroupContainer(document.getElementById('FacetsWrapperDesktop'));
    reorderFilterGroupContainer(document.getElementById('FacetsWrapperMobile'));
    setReferenceDesktopLayout(Boolean(desktopSelection?.strictReferenceMode && isDesktopViewport()));
  };

  const patchFacetFilters = () => {
    if (window.__ersaCollectionFacetsPatched || typeof FacetFiltersForm === 'undefined') return;
    window.__ersaCollectionFacetsPatched = true;

    const originalOnSubmitHandler = FacetFiltersForm.prototype.onSubmitHandler;
    FacetFiltersForm.prototype.onSubmitHandler = function onSubmitHandlerPatched(event) {
      const form = event?.target?.closest?.('form');
      if (form?.id === 'FacetFiltersFormMobile') {
        event.preventDefault();
        setMobileDirty(true);
        return;
      }

      return originalOnSubmitHandler.call(this, event);
    };

    FacetFiltersForm.renderProductCount = function renderProductCountPatched(html, updateEvent) {
      const parsedHtml = new DOMParser().parseFromString(html, 'text/html');
      const sourceCount = parsedHtml.getElementById('ProductCount') || parsedHtml.getElementById('ProductCountDesktop');
      if (!sourceCount) return;

      const countMarkup = sourceCount.innerHTML;
      const productCount = sourceCount.dataset.productCount || '';
      const totalCount = sourceCount.dataset.totalCount || '';
      const countContainer = document.getElementById('ProductCount');
      const countContainerDesktop = document.getElementById('ProductCountDesktop');

      if (countContainer) {
        countContainer.innerHTML = countMarkup;
        countContainer.dataset.productCount = productCount;
        countContainer.dataset.totalCount = totalCount;
        countContainer.classList.remove('loading');
      }

      if (countContainerDesktop) {
        countContainerDesktop.innerHTML = countMarkup;
        countContainerDesktop.classList.remove('loading');
      }

      document
        .querySelectorAll('.facets-container .loading__spinner, facet-filters-form .loading__spinner')
        .forEach((spinner) => spinner.classList.add('hidden'));

      updateEvent?.resolve(parseInt(productCount, 10) || 0);
      document.dispatchEvent(new CustomEvent('collection:facets-rendered'));
    };
  };

  patchFacetFilters();
  applyReferenceFilterLayout();
  setSortPanelOpen(false);
  syncDesktopControls();

  document.addEventListener(
    'click',
    (event) => {
      const nestedSummary = event.target.closest('#FacetFiltersFormMobile .mobile-facets__details > summary');
      if (!nestedSummary) return;

      const details = nestedSummary.parentElement;
      if (!details || details.matches('[data-mobile-facets-disclosure]')) return;

      nestedSummary.setAttribute('aria-expanded', String(!details.open));
      event.stopImmediatePropagation();
    },
    true
  );

  document.addEventListener(
    'click',
    (event) => {
      const mobileClearGroup = event.target.closest('[data-mobile-clear-group]');
      const mobileClearAll = event.target.closest('[data-mobile-clear-all]');
      const mobileApply = event.target.closest('[data-mobile-apply]');

      if (!mobileClearGroup && !mobileClearAll && !mobileApply) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (mobileClearGroup) {
        clearMobileGroup(mobileClearGroup);
        return;
      }

      if (mobileClearAll) {
        clearAllMobileFilters();
        return;
      }

      applyMobileFilters();
    },
    true
  );

  document.addEventListener('click', (event) => {
    const filterToggle = event.target.closest('[data-collection-filter-toggle]');
    if (filterToggle) {
      event.preventDefault();
      if (state.strictReferenceMode) return;
      setFilterPanelOpen(!getRoot()?.classList.contains('is-filter-panel-open'));
      setSortPanelOpen(false);
      return;
    }

    const sortToggle = event.target.closest('[data-collection-sort-toggle]');
    if (sortToggle) {
      event.preventDefault();
      const panel = getSortPanel();
      setSortPanelOpen(Boolean(panel?.hasAttribute('hidden')));
      return;
    }

    const mobileClearGroup = event.target.closest('[data-mobile-clear-group]');
    if (mobileClearGroup) {
      event.preventDefault();
      clearMobileGroup(mobileClearGroup);
      return;
    }

    const mobileClearAll = event.target.closest('[data-mobile-clear-all]');
    if (mobileClearAll) {
      event.preventDefault();
      clearAllMobileFilters();
      return;
    }

    const mobileApply = event.target.closest('[data-mobile-apply]');
    if (mobileApply) {
      event.preventDefault();
      const details = mobileApply.closest('.mobile-facets__details');
      const submenu = mobileApply.closest('.mobile-facets__submenu');

      if (details && submenu) {
        getMobileDrawer()?.closeSubmenu?.(details);
        return;
      }

      applyMobileFilters();
      return;
    }

    if (!isDesktopViewport()) return;

    const withinToolbar = event.target.closest('[data-collection-toolbar]');
    const withinPanel = event.target.closest('[data-collection-filter-panel]');
    const withinSortPanel = event.target.closest('[data-collection-sort-panel]');

    if (!withinToolbar && !withinPanel && !withinSortPanel) {
      setFilterPanelOpen(false);
      setSortPanelOpen(false);
      return;
    }

    if (!event.target.closest('[data-collection-sort-toggle]') && !withinSortPanel) {
      setSortPanelOpen(false);
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.closest('#FacetFiltersFormMobile')) {
      setMobileDirty(true);
    }

    if (event.target.closest('#FacetSortForm')) {
      setSortPanelOpen(false);
    }
  });

  document.addEventListener(
    'toggle',
    (event) => {
      if (!event.target.matches('[data-mobile-facets-disclosure]')) return;

      if (event.target.open) {
        setMobileDirty(false);
        return;
      }

      if (state.mobileApplying) {
        state.mobileApplying = false;
        return;
      }

      resetMobileDraft();
    },
    true
  );

  document.addEventListener('keyup', (event) => {
    if (event.code !== 'Escape') return;

    if (getMobileDisclosure()?.hasAttribute('open') && !state.mobileApplying) {
      resetMobileDraft();
    }
  });

  document.addEventListener('collection:facets-rendered', () => {
    state.mobileApplying = false;
    applyReferenceFilterLayout();
    syncDesktopControls();
  });

  window.addEventListener('resize', () => {
    if (!isDesktopViewport()) {
      setReferenceDesktopLayout(false);
      setFilterPanelOpen(false);
      setSortPanelOpen(false);
      return;
    }

    applyReferenceFilterLayout();
  });
})();
