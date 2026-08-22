module.exports = Object.freeze({
  allowedPageErrors: [
    // Shopify's local theme-dev proxy currently rejects one cross-origin injected script in WebKit.
    'Cross-origin script load denied by Cross-Origin Resource Sharing policy.',
  ],
  allowedCriticalAccessibilityRules: Object.freeze({
    // Existing complementary-products slider uses role=list with role=group children.
    product: ['aria-required-children'],
  }),
});
