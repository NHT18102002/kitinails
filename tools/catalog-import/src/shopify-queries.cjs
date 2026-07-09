const QUERY_IMPORT_PREFLIGHT = `#graphql
query ImportPreflight {
  shop {
    name
    myshopifyDomain
    currencyCode
  }
  appInstallation {
    accessScopes {
      handle
    }
  }
  locations(first: 25) {
    nodes {
      id
      name
      isActive
    }
  }
  metafieldDefinitions(first: 250, ownerType: PRODUCT, namespace: "custom") {
    nodes {
      id
      namespace
      key
      name
      type {
        name
      }
    }
  }
}
`;

const QUERY_PRODUCT_BY_HANDLE = `#graphql
query ProductByHandle($query: String!) {
  products(first: 10, query: $query) {
    nodes {
      id
      handle
      title
      status
      sourceUrl: metafield(namespace: "custom", key: "source_url") {
        value
      }
    }
  }
}
`;

const QUERY_PRODUCT_TAXONOMY_BY_HANDLE = `#graphql
query ProductTaxonomyByHandle($query: String!) {
  products(first: 10, query: $query) {
    nodes {
      id
      handle
      title
      status
      sourceUrl: metafield(namespace: "custom", key: "source_url") {
        value
      }
      colorValues: metafield(namespace: "custom", key: "nail_color_values") {
        value
      }
      shapeValues: metafield(namespace: "custom", key: "nail_shape_values") {
        value
      }
      lengthValues: metafield(namespace: "custom", key: "nail_length_values") {
        value
      }
      styleValues: metafield(namespace: "custom", key: "nail_style_values") {
        value
      }
      shape: metafield(namespace: "custom", key: "nail_shape") {
        value
      }
      length: metafield(namespace: "custom", key: "nail_length") {
        value
      }
    }
  }
}
`;

const QUERY_COLLECTION_BY_HANDLE = `#graphql
query CollectionByHandle($query: String!) {
  collections(first: 10, query: $query) {
    nodes {
      id
      handle
      title
    }
  }
}
`;

const MUTATION_STAGED_UPLOADS_CREATE = `#graphql
mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets {
      url
      resourceUrl
      parameters {
        name
        value
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

const MUTATION_FILE_CREATE = `#graphql
mutation FileCreate($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files {
      id
      alt
      fileStatus
      ... on MediaImage {
        image {
          url
        }
      }
      ... on Video {
        sources {
          url
          format
        }
      }
      ... on GenericFile {
        url
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

const QUERY_FILES_BY_IDS = `#graphql
query FilesByIds($ids: [ID!]!) {
  nodes(ids: $ids) {
    id
    ... on MediaImage {
      fileStatus
      alt
      image {
        url
      }
    }
    ... on Video {
      fileStatus
      alt
      sources {
        url
        format
      }
    }
    ... on GenericFile {
      fileStatus
      url
    }
  }
}
`;

const MUTATION_METAFIELD_DEFINITION_CREATE = `#graphql
mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition {
      id
      namespace
      key
      name
      type {
        name
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

const MUTATION_METAFIELDS_SET = `#graphql
mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      key
      namespace
      value
    }
    userErrors {
      code
      field
      message
    }
  }
}
`;

const MUTATION_COLLECTION_CREATE = `#graphql
mutation CollectionCreate($collection: CollectionCreateInput) {
  collectionCreate(collection: $collection) {
    collection {
      id
      handle
      title
    }
    userErrors {
      field
      message
    }
  }
}
`;

const MUTATION_PRODUCT_SET = `#graphql
mutation ProductSet($identifier: ProductSetIdentifiers, $synchronous: Boolean!, $input: ProductSetInput!) {
  productSet(identifier: $identifier, synchronous: $synchronous, input: $input) {
    product {
      id
      handle
    }
    productSetOperation {
      id
      status
    }
    userErrors {
      code
      field
      message
    }
  }
}
`;

const QUERY_PRODUCT_OPERATION = `#graphql
query ProductOperation($id: ID!) {
  productOperation(id: $id) {
    __typename
    status
    product {
      id
      handle
      status
    }
    ... on ProductSetOperation {
      id
      userErrors {
        code
        field
        message
      }
    }
  }
}
`;

module.exports = {
  MUTATION_COLLECTION_CREATE,
  MUTATION_FILE_CREATE,
  MUTATION_METAFIELD_DEFINITION_CREATE,
  MUTATION_METAFIELDS_SET,
  MUTATION_PRODUCT_SET,
  MUTATION_STAGED_UPLOADS_CREATE,
  QUERY_COLLECTION_BY_HANDLE,
  QUERY_FILES_BY_IDS,
  QUERY_IMPORT_PREFLIGHT,
  QUERY_PRODUCT_OPERATION,
  QUERY_PRODUCT_BY_HANDLE,
  QUERY_PRODUCT_TAXONOMY_BY_HANDLE,
};
