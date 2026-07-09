(function collectionFiltersHelpersFactory(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.ErsaCollectionFiltersHelpers = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, () => {
  const REFERENCE_FILTER_LABELS = ['Color', 'Length', 'Shape', 'Style'];

  function normalizeLabel(value) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  function selectCollectionFilterGroups(groups, options = {}) {
    const preferredLabels = Array.isArray(options.preferredLabels) && options.preferredLabels.length
      ? options.preferredLabels
      : REFERENCE_FILTER_LABELS;
    const normalizedPreferred = preferredLabels.map(normalizeLabel);
    const sourceGroups = Array.isArray(groups) ? groups.slice() : [];
    const groupsByLabel = new Map(sourceGroups.map((group) => [normalizeLabel(group.label), group]));
    const preferredGroups = normalizedPreferred.map((label) => groupsByLabel.get(label)).filter(Boolean);
    const preferredElements = new Set(preferredGroups.map((group) => group.element));
    const extraGroups = sourceGroups.filter((group) => !preferredElements.has(group.element));

    return {
      groups: preferredGroups.concat(extraGroups),
      strictReferenceMode: false,
    };
  }

  function buildClearAllSearchParams(entries, options = {}) {
    const preservedKeys = Array.isArray(options.preservedKeys) && options.preservedKeys.length
      ? options.preservedKeys
      : ['sort_by'];
    const searchParams = new URLSearchParams();

    for (const [key, value] of entries || []) {
      if (!preservedKeys.includes(key)) continue;
      if (value === undefined || value === null || value === '') continue;
      searchParams.append(key, value);
    }

    return searchParams.toString();
  }

  return {
    REFERENCE_FILTER_LABELS,
    buildClearAllSearchParams,
    selectCollectionFilterGroups,
  };
});
