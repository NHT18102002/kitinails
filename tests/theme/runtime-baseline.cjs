module.exports = Object.freeze({
  allowedPageErrors: [
    // Shopify's local theme-dev proxy currently rejects one cross-origin injected script in WebKit.
    'Cross-origin script load denied by Cross-Origin Resource Sharing policy.',
  ],
  allowedPageErrorPatterns: [
    // Alternate WebKit wording for the same Shopify web-pixel worker injected by theme dev.
    /web-pixels@.*worker\.modern\.js due to access control checks\.$/,
  ],
  allowedCriticalAccessibilityRules: Object.freeze({
    // Existing complementary-products slider uses role=list with role=group children.
    product: ['aria-required-children'],
  }),
});
