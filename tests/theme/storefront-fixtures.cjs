module.exports = Object.freeze({
  home: '/',
  collection: process.env.THEME_COLLECTION_PATH || '/collections/all',
  productMultiVariant: process.env.THEME_PRODUCT_PATH || '/products/safari',
  productSingleVariant: process.env.THEME_SINGLE_PRODUCT_PATH || '/products/gift-card',
  productSoldOut: process.env.THEME_SOLD_OUT_PRODUCT_PATH || '',
  searchResults: process.env.THEME_SEARCH_PATH || '/search?q=nails',
  searchEmpty: '/search?q=zzzznotfound',
  cart: '/cart',
  informationPage: process.env.THEME_PAGE_PATH || '/pages/contact',
});
