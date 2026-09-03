# Delta for Site Pages

## ADDED Requirements

### Requirement: Shared shell
Every page MUST render a shared shell: a fixed dark header with the firm logo and 4-item navigation (Inicio, Acerca de nosotros, Servicios, Contáctenos), plus a footer. The logo MUST link to Inicio.

#### Scenario: Shell renders on every page
- GIVEN any page is loaded
- WHEN the page renders
- THEN a fixed dark header with logo, 4 nav items, and a footer are present
- AND the logo links to Inicio

#### Scenario: Active nav state
- GIVEN the user is on Servicios
- WHEN the page renders
- THEN the "Servicios" nav item is visually marked as active

### Requirement: Design tokens
The site MUST apply the firm's tokens exactly: navy `#003366`, gold `#EDDB8C`, charcoal `#2A2A2A`, overlay `rgba(21,40,74,0.95)`, light background `#F7F7F7`.

#### Scenario: Colors match tokens
- GIVEN the stylesheet is loaded
- WHEN any page renders
- THEN primary surfaces use navy `#003366`, accents use gold `#EDDB8C`, body text uses charcoal `#2A2A2A`, and overlays use `rgba(21,40,74,0.95)`

### Requirement: Typography
Fonts MUST be self-hosted and applied as: Open Sans (body 14px), Oswald ExtraLight (H1 80px / H2 50px / H3 30px), Handlee (testimonials 20px).

#### Scenario: Fonts and sizes apply
- GIVEN fonts are self-hosted under `assets/`
- WHEN a page renders
- THEN body renders Open Sans 14px, H1/H2/H3 render Oswald ExtraLight at 80/50/30px, and testimonials render Handlee 20px

### Requirement: Self-hosted assets
All images and fonts MUST be self-hosted under `assets/`. No request to `nccdn.net` (or any external CDN) MAY occur.

#### Scenario: No external CDN
- GIVEN network monitoring during page load
- WHEN all pages render
- THEN every image/font request resolves to the same origin (`assets/`)
- AND zero requests are made to `nccdn.net`

### Requirement: Inicio sections
The Inicio page MUST include, in order: hero, 4 service cards, Quiénes somos, Por qué elegir, asociados, testimonials carousel, footer.

#### Scenario: Sections render in order
- GIVEN Inicio is loaded
- WHEN the page renders
- THEN hero, 4 service cards, "Quiénes somos", "Por qué elegir", asociados, and testimonials carousel are present
- AND the carousel advances between testimonials

### Requirement: Real texts and placeholder policy
Copy MUST reproduce the real firm texts 1:1. Template placeholders (stock team names, Colombian address, contradictory phones, placeholder logos/socials) MUST NOT ship. Where real data is not yet supplied, the value MUST be replaced with real data or explicitly marked `PENDING`.

#### Scenario: No placeholder ships
- GIVEN the built site
- WHEN any page is reviewed
- THEN no occurrence of "John Smith", "Jane Doe", "Phil Philanthropist", "Calle 29", or "facebookforreplacement" is present
- AND any unsupplied data is omitted or marked `PENDING`

### Requirement: Mobile responsiveness
The site MUST render correctly on viewports down to 320px; nav and layout MUST adapt for mobile.

#### Scenario: Mobile layout adapts
- GIVEN a 375px viewport
- WHEN a page renders
- THEN content is visible without horizontal scroll
- AND navigation remains usable

### Requirement: Accessibility
Pages MUST include semantic headings (one H1 per page, ordered H2/H3), alt text on content images, and a skip-to-content link as the first focusable element.

#### Scenario: Accessibility markers present
- GIVEN any page is loaded
- WHEN an accessibility check runs
- THEN exactly one H1 exists with ordered headings
- AND content images have non-empty alt text
- AND a skip-to-content link is first in tab order

### Requirement: Deployment config
The project MUST include `vercel.json` serving the 4 static pages from root and routing `/api/*` to serverless functions, deploying as a static + API-routes Vercel project.

#### Scenario: Routing config present
- GIVEN `vercel.json` in the repo
- WHEN deployed to Vercel
- THEN the 4 static pages serve from root
- AND `/api/` requests route to the serverless functions
