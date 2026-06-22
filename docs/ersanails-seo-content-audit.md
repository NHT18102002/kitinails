# Ersa Nails SEO, Content, And Discoverability Audit

This audit summarizes public metadata and page structure patterns without copying page copy or creative assets.

## Metadata Findings

| Area | Observation | URL evidence | Confidence | Recommendation for original store |
| --- | --- | --- | --- | --- |
| Homepage title | Homepage has a brand/category title pattern | https://ersanails.com/ | High | Use concise brand + product category title. |
| Homepage meta description | Homepage has a custom descriptive meta description | https://ersanails.com/ | High | Write original category/value description; avoid copying reference phrasing. |
| Collection titles | Collection pages use collection title plus brand pattern | https://ersanails.com/collections/all, https://ersanails.com/collections/best-seller | High | Give each collection a unique title targeting search intent. |
| Collection descriptions | Some taxonomy collections use generic brand description rather than category-specific meta description | https://ersanails.com/collections/almond, https://ersanails.com/collections/long | High | Add unique meta descriptions for shape/length collections. |
| Product titles | Product pages use product title plus brand pattern | https://ersanails.com/products/seafoam | High | Use unique product titles with shape/length/color attributes where useful. |
| Product descriptions | Product pages expose detailed descriptions in meta and content | https://ersanails.com/products/seafoam | High | Create original product copy; do not reuse reference descriptions. |
| Canonicals | Canonical URLs observed on homepage, collections, product, pages and search | Multiple inspected URLs | High | Preserve canonical tags and avoid indexed duplicate filters. |
| Open Graph | Homepage includes OG site/title/type/description/image tags | https://ersanails.com/ | High | Use original social share image and copy. |
| Twitter card | Homepage includes summary_large_image card tags | https://ersanails.com/ | High | Configure social cards for key page types. |
| Verification tags | Facebook and Google verification meta tags present | https://ersanails.com/ | High | Add only verification tags required for the new brand. |

## Robots, Sitemap, And Indexation

| Area | Observation | URL evidence | Confidence | Notes |
| --- | --- | --- | --- | --- |
| Robots storefront access | `Allow: /` for general storefront browsing | https://ersanails.com/robots.txt | High | Public product, collection, page and blog HTML is crawlable. |
| Blocked private/transactional surfaces | Robots disallows admin, checkout/checkouts, orders, account, cart JS, recommendations endpoint and internal services | https://ersanails.com/robots.txt | High | Rebuild should keep private/transactional surfaces protected. |
| Filter/sort crawl traps | Robots disallows some sort/filter URL combinations | https://ersanails.com/robots.txt | High | Original store should control faceted indexation carefully. |
| Sitemap index | Parent sitemap links to products, pages, collections, blogs and agentic discovery | https://ersanails.com/sitemap.xml | High | Shopify automatically maintains these; verify before launch. |
| URL scale | 587 product entries, 162 collections, 29 pages, 90 blog entries observed | Public sitemap child URLs | High | Original store should avoid over-indexing thin collection/tag pages. |
| UCP/agent discovery | Agentic discovery sitemap and public UCP endpoints are present | https://ersanails.com/sitemap.xml, https://ersanails.com/agents.md | High | Not necessary for MVP unless agent commerce is a strategic goal. |

## Structured Data

| Schema area | Observation | URL evidence | Confidence | Notes |
| --- | --- | --- | --- | --- |
| Organization schema | Homepage JSON-LD includes Organization | https://ersanails.com/ | High | Use original brand logo/social profiles. |
| WebSite/SearchAction schema | Homepage JSON-LD includes WebSite with SearchAction to `/search?q={search_term_string}` | https://ersanails.com/ | High | Recommended for original store. |
| Product schema | Product page JSON-LD includes ProductGroup/Product/Offer structures | https://ersanails.com/products/seafoam | High | Ensure variants/offers/availability are valid for all products. |
| AggregateRating | Product page displayed reviews and Judge.me assets, but `AggregateRating` was not conclusively extracted from JSON-LD in the sampled output | https://ersanails.com/products/seafoam | Medium | Validate review schema with Rich Results Test before launch. |
| Breadcrumb schema | Breadcrumb UI observed on collection page; JSON-LD breadcrumb was not confirmed in sampled extraction | https://ersanails.com/collections/all | Low | Add BreadcrumbList schema if theme supports it. |
| FAQ schema | FAQ page content exists, but FAQPage JSON-LD was not confirmed in sampled extraction | https://ersanails.com/pages/faq | Low | Add FAQ schema only if content is visible and policy-compliant. |

## Heading Hierarchy

| Page type | Observation | URL evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Homepage | Rendered DOM showed an empty `h1` associated with logo/header; visible sections use lower headings | https://ersanails.com/ | Medium | Use one meaningful page `h1` on homepage. |
| Collections | Rendered collection DOM showed empty `h1`; page content uses breadcrumb and product count | https://ersanails.com/collections/all | Medium | Add visible/semantic collection `h1` with collection name. |
| Search | Rendered search page showed empty `h1` plus visible `h2` result heading | https://ersanails.com/search?q=almond | Medium | Use `h1` for search result heading. |
| Product | Product page uses meaningful `h1` for sampled product | https://ersanails.com/products/seafoam | Low | Keep product title as `h1`; avoid duplicate hidden H1s. |
| Help/policy pages | Some templates expose utility headings like cart/country before page content in static extraction | FAQ/policy pages | Medium | Ensure main content starts with correct `h1` and utility content is not announced as document hierarchy. |

## Internal Linking And Content Architecture

- Main navigation links to commercial intent clusters: shop all, best sellers, new, sale, seasonal collections, shape, length, tools and bundles.
- Footer repeats shop taxonomy plus support pages: about, contact, blog, rewards, size guide, FAQ/help, customization, shipping, returns, delivery protection, privacy and terms.
- Homepage links into key conversion paths: campaign collections, best sellers, shape browsing, tools/accessories, bundles and social/UGC.
- Blog exists and covers educational/seasonal topics around press-on nails, application, care, sizing and occasions.
- Policy/help architecture is strong for conversion trust, but some pages appear to rely on generic meta descriptions.

## Image SEO And Alt Text

| Observation | Evidence | Confidence | Recommendation |
| --- | --- | --- | --- |
| Product/grid images often include descriptive filenames or product-oriented alt text | Collection page image sample | High | Continue product-specific alt text, but write it for users rather than filenames. |
| Logo/decorative images sometimes have empty alt | Homepage/collection rendered DOM | High | Empty alt is acceptable for decorative images, but logos should have accessible text via link/label. |
| Product galleries may repeat the same product alt text across many images | https://ersanails.com/products/seafoam | High | Use variant-specific alt text for key gallery images where meaningful. |
| Many images are present on homepage | Browser DOM counted 165 images, with 68 empty alt values in the rendered state | Medium | Audit visible/meaningful images before launch. |

## Duplicate Content And Indexation Risks

- Shape/length/style collections can become thin or duplicate if they share generic metadata and overlapping product grids.
- Sort/filter/tag paths should be controlled with canonical tags and robots rules; reference store already blocks several crawl-trap patterns.
- Search pages have canonicalized query URLs. Consider whether search results should be indexable for the new brand.
- Campaign pages and campaign collections should avoid duplicating the same products and copy under many URLs.
- Blog content can support discovery, but should be original, useful and not generic AI-like product copy.

## SEO Recommendations For Original Shopify Store

- Create unique titles/meta descriptions for homepage, top collections, shape pages, length pages, product pages, guides and policies.
- Use meaningful `h1` on every page template.
- Implement Product, Organization, WebSite/SearchAction and BreadcrumbList schema; validate Product/Review schema.
- Use Shopify Search & Discovery with controlled filters; avoid index bloat from every filter combination.
- Build original evergreen guides: sizing, application, removal, adhesive choice, shape/length education and nail-care safety.
- Maintain sitemap and robots defaults, but review any app-generated pages before launch.
