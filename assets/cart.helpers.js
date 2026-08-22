(function attachCartHelpers(root, factory) {
  const helpers = factory();
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  if (root) root.CartHelpers = helpers;
})(typeof window !== 'undefined' ? window : globalThis, function createCartHelpers() {
  function toInteger(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeQuantityConstraints({ min, max, step } = {}) {
    return {
      min: toInteger(min, 0),
      max: max === null || max === undefined || max === '' ? null : toInteger(max, null),
      step: Math.max(1, toInteger(step, 1)),
    };
  }

  return { normalizeQuantityConstraints };
});
