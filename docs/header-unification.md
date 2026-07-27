# Storefront header unification

## Decision

All Online Store 2.0 storefront templates use the same global header group:

- a white navigation surface with black text at the top of the page;
- a black navigation surface that reveals from top to bottom after scrolling;
- the dark Kiti Nails logo at the top and the light logo after scrolling;
- consistent desktop and mobile heights, spacing, and alignment.

The navigation section is sticky at `top: 0` on every storefront template.
The black navigation surface is rendered by a pseudo-element using an animated
`clip-path`, so the reveal does not clip menus, search, or cart overlays. The
announcement bar was removed from the header group.

The shared primary navigation contains:

- Shop All: `/collections/all`
- Best Seller: `/collections/all?sort_by=best-selling`
- Accessories: `/collections/all`
- Custom Orders: `/collections`
- About Us: `/pages/about-us`

The same link source renders on desktop and in the mobile/tablet drawer. The
homepage no longer switches to a transparent overlay header. Product,
collection, search, cart, and content templates no longer change announcement
bar visibility or header behavior.

## Implementation

`assets/header-unified.css` is loaded after the legacy theme customization
stylesheets. Its selectors are scoped to the global header group and override
older template-specific rules without changing template content.

Header content remains merchant-configurable through
`sections/header-group.json` and the Shopify Theme Editor.

## Responsive targets

- Desktop: 1440 px
- Laptop: 1024 px
- Tablet: 768 px
- Mobile: 390 px

The mobile logo rule supports both header markup states used by Dawn: a
homepage heading wrapper and a direct logo link on all other templates.
