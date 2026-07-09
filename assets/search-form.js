class SearchForm extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input[type="search"]');
    this.resetButton = this.querySelector('button[type="reset"]');

    if (this.input) {
      this.input.form.addEventListener('reset', this.onFormReset.bind(this));
      this.input.form.addEventListener('submit', this.onSearchSubmit.bind(this));
      this.input.addEventListener(
        'input',
        debounce((event) => {
          this.onChange(event);
        }, 300).bind(this)
      );
      SearchForm.applyDisplayQueryFromUrl();
    }
  }

  static getDisplayQueryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('display_q') || '';
  }

  static isExpandableQuery(query) {
    const normalizedQuery = query.trim();
    return /^[a-z0-9]{2,32}$/i.test(normalizedQuery);
  }

  static buildProductSearchQuery(query) {
    const normalizedQuery = query.trim().toLowerCase();

    if (!SearchForm.isExpandableQuery(normalizedQuery)) return query.trim();

    return `${normalizedQuery}*`;
  }

  static buildProductSearchUrl(query) {
    const searchQuery = SearchForm.buildProductSearchQuery(query);
    const params = new URLSearchParams({
      q: searchQuery,
      type: 'product',
      'options[prefix]': 'last',
      'options[unavailable_products]': 'last',
    });

    if (searchQuery !== query.trim()) {
      params.set('display_q', query.trim());
    }

    const searchUrl = routes.search_url || '/search';

    return `${searchUrl}?${params.toString()}`;
  }

  static ensureHiddenInput(form, name, value) {
    let input = Array.from(form.querySelectorAll('input')).find((formInput) => formInput.name === name);

    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }

    input.value = value;
    return input;
  }

  static applyDisplayQueryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const displayQuery = SearchForm.getDisplayQueryFromUrl();
    const searchQuery = params.get('q');

    if (!displayQuery) return;

    document.querySelectorAll('input[type="search"][name="q"]').forEach((input) => {
      input.value = displayQuery;
    });

    document.querySelectorAll('form input[name="q"]').forEach((queryInput) => {
      SearchForm.ensureHiddenInput(queryInput.form, 'display_q', displayQuery);
    });

    if (searchQuery && document.title.includes(searchQuery)) {
      document.title = document.title.replace(searchQuery, displayQuery);
    }
  }

  onSearchSubmit() {
    if (!this.input || !this.input.form) return;
    if (this.querySelector('[aria-selected="true"] a, a[aria-selected="true"], button[aria-selected="true"]')) return;

    const query = this.input.value.trim();
    const searchQuery = SearchForm.buildProductSearchQuery(query);

    if (!query || searchQuery === query) return;

    this.input.value = searchQuery;
    SearchForm.ensureHiddenInput(this.input.form, 'display_q', query);

    setTimeout(() => {
      if (document.contains(this.input)) this.input.value = query;
    });
  }

  toggleResetButton() {
    const resetIsHidden = this.resetButton.classList.contains('hidden');
    if (this.input.value.length > 0 && resetIsHidden) {
      this.resetButton.classList.remove('hidden');
    } else if (this.input.value.length === 0 && !resetIsHidden) {
      this.resetButton.classList.add('hidden');
    }
  }

  onChange() {
    this.toggleResetButton();
  }

  shouldResetForm() {
    return !document.querySelector('[aria-selected="true"] a, a[aria-selected="true"]');
  }

  onFormReset(event) {
    // Prevent default so the form reset doesn't set the value gotten from the url on page load
    event.preventDefault();
    // Don't reset if the user has selected an element on the predictive search dropdown
    if (this.shouldResetForm()) {
      this.input.value = '';
      this.input.focus();
      this.toggleResetButton();
    }
  }
}

customElements.define('search-form', SearchForm);

SearchForm.applyDisplayQueryFromUrl();
document.addEventListener('DOMContentLoaded', () => SearchForm.applyDisplayQueryFromUrl());
window.addEventListener('pageshow', () => SearchForm.applyDisplayQueryFromUrl());
