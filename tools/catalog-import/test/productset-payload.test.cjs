const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildProductMetafields,
  buildProductSetRequest,
  mergeProductTags,
} = require('../src/productset-payload.cjs');

test('buildProductMetafields serializes taxonomy lists and omits missing values', () => {
  const metafields = buildProductMetafields({
    sourceUrl: 'https://ersanails.com/products/fairy-garden',
    sourceProductId: 123,
    taxonomy: {
      color: ['Pink', 'Green'],
      shape: ['Almond'],
      length: [],
      style: ['Floral'],
      finish: [],
    },
  });

  assert.deepEqual(
    metafields.map((item) => item.key),
    ['source_url', 'source_product_id', 'demo_inventory', 'nail_shape', 'nail_color_values', 'nail_shape_values', 'nail_style_values']
  );
  assert.equal(metafields.find((item) => item.key === 'demo_inventory').value, 'true');
  assert.equal(metafields.find((item) => item.key === 'nail_color_values').value, JSON.stringify(['Pink', 'Green']));
  assert.equal(metafields.some((item) => item.key === 'nail_length'), false);
});

test('mergeProductTags appends unique source tags after existing tags', () => {
  assert.deepEqual(
    mergeProductTags(['Press On Nails', 'Style_Floral'], ['SrcCollection_fairy', 'Style_Floral']),
    ['Press On Nails', 'Style_Floral', 'SrcCollection_fairy']
  );
});

test('buildProductSetRequest builds a DRAFT productSet request with ready files and demo inventory', () => {
  const request = buildProductSetRequest({
    product: {
      handle: 'fairy-garden',
      title: 'Fairy Garden',
      vendor: 'Ersa Nails',
      productType: 'Press On Nails',
      bodyHtml: '<p>Floral set</p>',
      sourceUrl: 'https://ersanails.com/products/fairy-garden',
      sourceProductId: 123,
      seo: {
        title: 'Fairy Garden | Ersa Nails',
        description: 'Press on nails',
      },
      tags: ['Press On Nails', 'Length_Med'],
      taxonomy: {
        color: ['Pink'],
        shape: ['Almond'],
        length: ['Med'],
        style: ['Floral'],
        finish: [],
      },
      options: [
        {
          name: 'SIZE',
          position: 1,
          values: ['XS', 'S'],
        },
      ],
      variants: [
        {
          title: 'XS',
          sku: 'FG-XS',
          available: true,
          price: 4999,
          compareAtPrice: 5999,
          options: ['XS'],
        },
        {
          title: 'S',
          sku: 'FG-S',
          available: false,
          price: 4999,
          compareAtPrice: null,
          options: ['S'],
        },
      ],
      media: [
        { src: 'https://cdn.example/fairy-1.jpg', alt: 'Fairy 1', position: 1 },
        { src: 'https://cdn.example/fairy-1.jpg', alt: 'Fairy 1 dup', position: 2 },
        { src: 'https://cdn.example/fairy-2.jpg', alt: 'Fairy 2', position: 2 },
      ],
      merchantInputRequired: [],
    },
    locationId: 'gid://shopify/Location/2',
    sourceTags: ['SrcCollection_fairy'],
    fileRecords: [
      {
        shopifyFileId: 'gid://shopify/MediaImage/1',
        fileStatus: 'READY',
        contentType: 'IMAGE',
        alt: 'Fairy 1',
        filename: 'fairy-1.jpg',
        dependents: [{ productHandle: 'fairy-garden', sourceUrl: 'https://cdn.example/fairy-1.jpg', order: 1 }],
      },
      {
        shopifyFileId: 'gid://shopify/MediaImage/2',
        fileStatus: 'READY',
        contentType: 'IMAGE',
        alt: 'Fairy 2',
        filename: 'fairy-2.jpg',
        dependents: [{ productHandle: 'fairy-garden', sourceUrl: 'https://cdn.example/fairy-2.jpg', order: 2 }],
      },
    ],
  });

  assert.deepEqual(request.identifier, { handle: 'fairy-garden' });
  assert.equal(request.input.status, 'DRAFT');
  assert.deepEqual(request.input.tags, ['Press On Nails', 'Length_Med', 'SrcCollection_fairy']);
  assert.equal(request.input.files.length, 2);
  assert.deepEqual(request.input.files, [{ id: 'gid://shopify/MediaImage/1' }, { id: 'gid://shopify/MediaImage/2' }]);
  assert.equal(request.input.productOptions[0].values[0].name, 'XS');
  assert.equal(request.input.variants[0].price, '49.99');
  assert.equal(request.input.variants[0].compareAtPrice, '59.99');
  assert.equal(request.input.variants[0].inventoryQuantities[0].quantity, 50);
  assert.equal(request.input.variants[1].inventoryQuantities[0].quantity, 0);
  assert.equal(request.input.variants[0].optionValues[0].optionName, 'SIZE');
});
