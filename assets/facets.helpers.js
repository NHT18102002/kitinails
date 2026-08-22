(function exposeFacetHelpers(root, factory) {
  const helpers = factory();
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  if (root) root.ErsaFacetsHelpers = helpers;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createFacetHelpers() {
  const buildSearchParams = (entryGroups, options = {}) => {
    const params = new URLSearchParams();
    const singletonKeys = new Set(options.singletonKeys || []);

    Array.from(entryGroups || []).forEach((entries) => {
      Array.from(entries || []).forEach(([key, value]) => {
        if (!key || value == null || value === '') return;

        if (singletonKeys.has(key)) {
          params.set(key, value);
          return;
        }

        params.append(key, value);
      });
    });

    return params.toString();
  };

  return Object.freeze({ buildSearchParams });
});
