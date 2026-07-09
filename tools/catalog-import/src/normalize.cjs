const { constants } = require('./config.cjs');

function extractTaxonomyFromBodyHtml(bodyHtml) {
  const text = String(bodyHtml || '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r/g, '');

  return {
    shape: extractLabeledValue(text, ['NAIL SHAPE', 'SHAPE']),
    length: extractLabeledValue(text, ['NAIL LENGTH', 'LENGTH']),
    style: extractLabeledValue(text, ['STYLE']),
    finish: extractLabeledValue(text, ['FINISH']),
    color: extractLabeledValue(text, ['COLOR']),
  };
}

function normalizeMerchantInputFlags(fields) {
  return Object.entries(fields)
    .filter(([key, value]) => !['title', 'bodyHtml'].includes(key) && String(value || '').trim() === '')
    .map(([key]) => key);
}

function extractTaxonomyFromTags(tags) {
  const taxonomy = {
    color: [],
    length: [],
    shape: [],
    style: [],
  };

  for (const tag of tags || []) {
    const value = String(tag || '');

    if (value.startsWith('Color_')) taxonomy.color.push(value.slice('Color_'.length));
    if (value.startsWith('Length_')) taxonomy.length.push(value.slice('Length_'.length));
    if (value.startsWith('Shape_')) taxonomy.shape.push(value.slice('Shape_'.length));
    if (value.startsWith('Style_')) taxonomy.style.push(value.slice('Style_'.length));
  }

  return taxonomy;
}

function normalizeProductRecord(productJs, productHtml, collectionMemberships = []) {
  const bodyTaxonomy = extractTaxonomyFromBodyHtml(productJs.description || '');
  const tagTaxonomy = extractTaxonomyFromTags(productJs.tags || []);
  const htmlMeta = extractHtmlMetadata(productHtml);
  const relatedHandles = extractRelatedHandles(productHtml, productJs.handle);
  const media = normalizeMedia(productJs);
  const categoryHint = classifyProductCategoryHint({
    productType: productJs.type,
    tags: productJs.tags || [],
    title: productJs.title,
    handle: productJs.handle,
  });

  const taxonomy = {
    color: firstNonEmptyList(tagTaxonomy.color, bodyTaxonomy.color),
    shape: firstNonEmptyList(tagTaxonomy.shape, bodyTaxonomy.shape),
    length: firstNonEmptyList(tagTaxonomy.length, bodyTaxonomy.length),
    style: firstNonEmptyList(tagTaxonomy.style, bodyTaxonomy.style),
    finish: bodyTaxonomy.finish ? [bodyTaxonomy.finish] : [],
  };

  const merchantInputRequired = normalizeMerchantInputFlags({
    title: productJs.title,
    bodyHtml: productJs.description,
    color: taxonomy.color.join(', '),
    shape: taxonomy.shape.join(', '),
    length: taxonomy.length.join(', '),
    style: taxonomy.style.join(', '),
  });

  return {
    sourceUrl: `${constants.baseUrl}/products/${productJs.handle}`,
    sourceProductId: productJs.id,
    crawledAt: new Date().toISOString(),
    title: productJs.title,
    handle: productJs.handle,
    vendor: productJs.vendor,
    productType: productJs.type,
    categoryHint,
    bodyHtml: productJs.description,
    seo: {
      title: htmlMeta.title,
      description: htmlMeta.description,
    },
    tags: productJs.tags || [],
    collections: collectionMemberships,
    options: (productJs.options || []).map((option) => ({
      name: option.name,
      position: option.position,
      values: option.values,
    })),
    variants: (productJs.variants || []).map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku || '',
      available: Boolean(variant.available),
      price: variant.price,
      compareAtPrice: variant.compare_at_price,
      options: variant.options || [],
    })),
    media,
    taxonomy,
    relatedHandles,
    merchantInputRequired,
  };
}

function normalizeMedia(productJs) {
  const media = Array.isArray(productJs.media) ? productJs.media : [];

  return media.map((item, index) => ({
    id: item.id,
    mediaType: item.media_type,
    src: item.src || item.preview_image?.src || '',
    alt: item.alt || '',
    width: item.width || item.preview_image?.width || null,
    height: item.height || item.preview_image?.height || null,
    position: item.position || index + 1,
  }));
}

function extractHtmlMetadata(html) {
  return {
    title: html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '',
    description:
      html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1]?.trim() || '',
  };
}

function extractRelatedHandles(html, selfHandle) {
  const matches = [...html.matchAll(/href="(\/products\/[^"#?]+)"/g)]
    .map((match) => match[1].split('/products/')[1])
    .filter(Boolean)
    .filter((handle) => handle !== selfHandle);

  return Array.from(new Set(matches)).slice(0, 24);
}

function firstNonEmptyList(primary, fallback) {
  if (Array.isArray(primary) && primary.length) return primary;
  if (Array.isArray(fallback)) return fallback;
  if (fallback) return [fallback];
  return [];
}

function classifyProductCategoryHint(product) {
  const productType = String(product.productType || '').toLowerCase();
  const title = String(product.title || '').toLowerCase();
  const handle = String(product.handle || '').toLowerCase();
  const tags = (product.tags || []).map((tag) => String(tag).toLowerCase());

  if (handle.includes('gift-card') || title.includes('gift card')) {
    return 'gift_card';
  }

  if (
    handle.includes('custom') ||
    handle.includes('service') ||
    title.includes('custom') ||
    title.includes('request') ||
    title.includes('service')
  ) {
    return 'service_or_custom';
  }

  if (productType === 'bundle' || tags.includes('bundle')) {
    return 'bundle';
  }

  if (
    productType === 'tools & accessories' ||
    tags.includes('tools & accessories') ||
    handle.includes('kit') ||
    handle.includes('glue') ||
    handle.includes('remover') ||
    handle.includes('oil') ||
    handle.includes('clipper') ||
    handle.includes('sticker') ||
    handle.includes('stand')
  ) {
    return 'tool_accessory';
  }

  if (productType === 'press on nails') {
    return 'press_on_nails';
  }

  return 'other';
}

function extractLabeledValue(text, labels) {
  for (const label of labels) {
    const expression = new RegExp(`${escapeRegex(label)}\\s*:\\s*([^\\n<]+)`, 'i');
    const match = text.match(expression);

    if (match) {
      return match[1].trim();
    }
  }

  return '';
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  classifyProductCategoryHint,
  extractTaxonomyFromBodyHtml,
  extractTaxonomyFromTags,
  normalizeProductRecord,
  normalizeMerchantInputFlags,
};
