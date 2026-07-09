(() => {
  const searchMain = document.querySelector("main[data-template='search']");
  if (!searchMain || window.__ersaSearchPageInitialized) return;

  const searchPath = new URL(window.routes?.search_url || '/search', window.location.origin).pathname;
  const isSearchPath = window.location.pathname === searchPath;
  const getSearchFormClass = () => {
    if (typeof SearchForm === 'undefined') return null;
    return SearchForm;
  };
  const getFacetFiltersFormClass = () => {
    if (typeof FacetFiltersForm === 'undefined') return null;
    return FacetFiltersForm;
  };

  const isExpandableQuery = (query) => {
    const SearchFormClass = getSearchFormClass();
    if (SearchFormClass && typeof SearchFormClass.isExpandableQuery === 'function') {
      return SearchFormClass.isExpandableQuery(query);
    }

    return /^[a-z0-9]{2,32}$/i.test(query.trim());
  };

  const buildProductQuery = (query) => {
    const SearchFormClass = getSearchFormClass();
    if (SearchFormClass && typeof SearchFormClass.buildProductSearchQuery === 'function') {
      return SearchFormClass.buildProductSearchQuery(query);
    }

    const normalized = query.trim().toLowerCase();
    return isExpandableQuery(normalized) ? `${normalized}*` : query.trim();
  };

  const canonicalizeDirectProductSearch = () => {
    if (!isSearchPath) return false;

    const url = new URL(window.location.href);
    const params = url.searchParams;
    const query = params.get('q') || '';
    const type = params.get('type') || '';
    const isProductSearch = !type || type.split(',').map((value) => value.trim()).includes('product');

    if (!query || !isProductSearch || query.includes('*') || params.has('display_q') || !isExpandableQuery(query)) {
      return false;
    }

    const displayQuery = query.trim();
    const productQuery = buildProductQuery(displayQuery);

    if (productQuery === displayQuery) return false;

    params.set('q', productQuery);
    params.set('type', 'product');
    params.set('options[prefix]', 'last');
    params.set('options[unavailable_products]', 'last');
    params.set('display_q', displayQuery);
    window.location.replace(`${url.pathname}?${params.toString()}`);
    return true;
  };

  if (canonicalizeDirectProductSearch()) return;

  window.__ersaSearchPageInitialized = true;

  const state = {
    mobileApplying: false,
    mobileResetting: false,
  };

  const getDisplayQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const displayQuery = params.get('display_q');
    const query = params.get('q') || '';

    if (displayQuery) return displayQuery;
    if (query.endsWith('*')) return query.slice(0, -1);
    return query;
  };

  const ensureHiddenInput = (form, name, value) => {
    if (!form || value == null || value === '') return null;

    let input = Array.from(form.querySelectorAll('input')).find((formInput) => formInput.name === name);

    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }

    input.value = value;
    return input;
  };

  const escapeSelector = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return value.replace(/["\\]/g, '\\$&');
  };

  const syncSearchForms = () => {
    const displayQuery = getDisplayQuery();
    if (!displayQuery) return;

    const title = searchMain.querySelector('.template-search__title');
    if (title?.textContent?.trim().toLowerCase().startsWith('results for')) {
      title.textContent = `Results for "${displayQuery}"`;
    }

    document.querySelectorAll("main[data-template='search'] input[type='search'][name='q']").forEach((input) => {
      input.value = displayQuery;
    });

    document.querySelectorAll("main[data-template='search'] form").forEach((form) => {
      if (form.querySelector("input[name='q']")) {
        ensureHiddenInput(form, 'display_q', displayQuery);
      }
    });
  };

  const syncSortFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const sortValue = params.get('sort_by') || 'relevance';

    document.querySelectorAll("main[data-template='search'] select[name='sort_by']").forEach((select) => {
      if (Array.from(select.options).some((option) => option.value === sortValue)) {
        select.value = sortValue;
      }
    });

    document
      .querySelectorAll("main[data-template='search'] input[type='radio'][name='sort_by']")
      .forEach((radio) => {
        radio.checked = radio.value === sortValue;
        radio.closest('.mobile-facets__value')?.classList.toggle('active', radio.checked);
      });
  };

  const syncSearchStateFromUrl = () => {
    syncSearchForms();
    syncSortFromUrl();
  };

  const getMobileDisclosure = () => searchMain.querySelector('[data-mobile-facets-disclosure]');
  const getMobileSummary = () => getMobileDisclosure()?.querySelector('summary');
  const getMobileForm = () => searchMain.querySelector('#FacetFiltersFormMobile');
  const getMobileDrawer = () => searchMain.querySelector('menu-drawer.mobile-facets__wrapper');

  const setMobileDirty = (isDirty) => {
    const nextValue = Boolean(isDirty);
    getMobileForm()?.classList.toggle('is-mobile-filter-dirty', nextValue);
    getMobileDrawer()?.classList.toggle('is-mobile-filter-dirty', nextValue);
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

    if (!form || !names?.length) return;

    names.forEach((name) => {
      form.querySelectorAll(`[name="${escapeSelector(name)}"]`).forEach(clearControl);
    });

    setMobileDirty(true);
  };

  const clearAllMobileFilters = () => {
    const form = getMobileForm();
    if (!form) return;

    form.querySelectorAll('input, select').forEach((control) => {
      if (!control.name.startsWith('filter.')) return;
      clearControl(control);
    });

    setMobileDirty(true);
  };

  const closeMobileDrawer = () => {
    const disclosure = getMobileDisclosure();
    const summary = getMobileSummary();
    if (disclosure?.hasAttribute('open') && summary) summary.click();
  };

  const applyMobileFilters = () => {
    const form = getMobileForm();
    const FacetFiltersFormClass = getFacetFiltersFormClass();
    if (!form || !FacetFiltersFormClass) return;

    const params = new URLSearchParams();
    const formData = new FormData(form);

    formData.forEach((value, key) => {
      if (value === '') return;
      params.append(key, value);
    });

    state.mobileApplying = true;
    setMobileDirty(false);
    closeMobileDrawer();
    FacetFiltersFormClass.renderPage(params.toString(), null, true);
  };

  const resetMobileDraft = () => {
    state.mobileResetting = true;
    getMobileForm()?.reset();
    setMobileDirty(false);
    window.requestAnimationFrame(() => {
      setMobileDirty(false);
      state.mobileResetting = false;
    });
  };

  const patchFacetFilters = () => {
    const FacetFiltersFormClass = getFacetFiltersFormClass();
    if (window.__ersaSearchFacetsPatched || !FacetFiltersFormClass) return;
    window.__ersaSearchFacetsPatched = true;

    const originalOnSubmitHandler = FacetFiltersFormClass.prototype.onSubmitHandler;
    FacetFiltersFormClass.prototype.onSubmitHandler = function onSubmitHandlerPatched(event) {
      const form = event?.target?.closest?.('form');

      if (form?.id === 'FacetFiltersFormMobile') {
        event.preventDefault();
        if (state.mobileResetting || !getMobileDisclosure()?.hasAttribute('open')) {
          setMobileDirty(false);
          return;
        }

        setMobileDirty(true);
        return;
      }

      if (!form || !searchMain.contains(form)) {
        return originalOnSubmitHandler.call(this, event);
      }

      event.preventDefault();
      const mergedParams = new URLSearchParams();
      const singletonKeys = new Set([
        'q',
        'type',
        'options[prefix]',
        'options[unavailable_products]',
        'display_q',
        'sort_by',
      ]);

      document
        .querySelectorAll("main[data-template='search'] facet-filters-form form")
        .forEach((facetForm) => {
          if (!['FacetSortForm', 'FacetFiltersForm', 'FacetSortDrawerForm'].includes(facetForm.id)) return;

          new FormData(facetForm).forEach((value, key) => {
            if (value === '') return;
            if (singletonKeys.has(key)) {
              mergedParams.set(key, value);
              return;
            }

            mergedParams.append(key, value);
          });
        });

      return this.onSubmitForm(mergedParams.toString(), event);
    };

    const originalRenderProductCount = FacetFiltersFormClass.renderProductCount;
    FacetFiltersFormClass.renderProductCount = function renderProductCountPatched(html, updateEvent) {
      const parsedHtml = new DOMParser().parseFromString(html, 'text/html');
      const sourceCount = parsedHtml.getElementById('ProductCount') || parsedHtml.getElementById('ProductCountDesktop');

      if (!sourceCount) {
        originalRenderProductCount.call(this, html, updateEvent);
        syncSearchStateFromUrl();
        return;
      }

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
      syncSearchStateFromUrl();
      document.dispatchEvent(new CustomEvent('search:facets-rendered'));
    };
  };

  patchFacetFilters();
  syncSearchStateFromUrl();

  document.addEventListener(
    'click',
    (event) => {
      const nestedSummary = event.target.closest(
        "main[data-template='search'] #FacetFiltersFormMobile .mobile-facets__details > summary"
      );
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
      const mobileClearGroup = event.target.closest("main[data-template='search'] [data-mobile-clear-group]");
      const mobileClearAll = event.target.closest("main[data-template='search'] [data-mobile-clear-all]");
      const mobileApply = event.target.closest("main[data-template='search'] [data-mobile-apply]");

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

  document.addEventListener('change', (event) => {
    if (state.mobileResetting) return;
    if (event.target.closest("main[data-template='search'] #FacetFiltersFormMobile")) {
      setMobileDirty(true);
    }
  });

  document.addEventListener(
    'toggle',
    (event) => {
      if (!event.target.matches("main[data-template='search'] [data-mobile-facets-disclosure]")) return;

      if (event.target.open) {
        setMobileDirty(false);
        syncSearchStateFromUrl();
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

  document.addEventListener(
    'keyup',
    (event) => {
      if (event.code !== 'Escape' || state.mobileApplying) return;
      if (getMobileDisclosure()?.hasAttribute('open')) {
        resetMobileDraft();
        closeMobileDrawer();
      }
    },
    true
  );

  document.addEventListener('search:facets-rendered', () => {
    state.mobileApplying = false;
    setMobileDirty(false);
    syncSearchStateFromUrl();
  });

  window.addEventListener('pageshow', syncSearchStateFromUrl);
  window.addEventListener('popstate', () => {
    window.setTimeout(syncSearchStateFromUrl, 1200);
  });
})();
