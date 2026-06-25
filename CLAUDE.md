# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Shopify storefront theme based on **Horizon** (v4.1.1, by Shopify — see `config/settings_schema.json`). It is an Online Store 2.0 theme written in Liquid + vanilla JS web components. There is **no build step, no bundler, and no test framework** — `assets/*.js` and `assets/*.css` are served as-is to the browser. Edits to Liquid/JS/CSS take effect directly.

## Commands

All development goes through the [Shopify CLI](https://shopify.dev/docs/themes/tools/cli):

```bash
shopify theme dev        # local dev server with hot reload against a dev store
shopify theme check      # Theme Check linter (Liquid + JSON validation)
shopify theme push       # upload working copy to a theme on the store
shopify theme pull       # download theme from the store (overwrites local)
```

There are no unit tests; verification is done in-browser via `shopify theme dev` or the theme editor (`?preview_theme_id=`).

## Architecture

### Liquid layers (data flows top-down)
- **`layout/theme.liquid`** — the HTML shell wrapping every page. Renders `header-group`/`footer-group` section groups and the global snippets (`scripts`, `stylesheets`, `fonts`, `meta-tags`, color/style variables). Contains inline scripts that pre-compute header height CSS vars to avoid layout shift — these are deliberately duplicated from `utilities.js` and **must be kept in sync** (noted in comments there).
- **`templates/*.json`** — page templates. Each is a JSON tree of section instances + settings (the `.liquid` template files like `gift_card.liquid` are the few exceptions). Editing layout/content of a page usually means editing JSON or the sections it references, not the template directly.
- **`sections/*.liquid`** — top-level page regions with a `{% schema %}` block. `*-group.json` files (`header-group`, `footer-group`) are section groups. Sections render their child blocks via `{% content_for 'blocks' %}` (dynamic, merchant-arranged) or `{% content_for 'block', type: '...', id: '...' %}` (static).
- **`blocks/*.liquid`** — composable building blocks placed inside sections. Files prefixed with `_` (e.g. `_card.liquid`, `_heading.liquid`) are "private" blocks used internally by other blocks/sections; unprefixed blocks are merchant-addable.
- **`snippets/*.liquid`** — reusable partials rendered with `{% render 'name' %}`. Many declare a typed interface via a `{% doc %}` block at the top (`@param` tags) — read it before calling a snippet.

### JavaScript: web components + importmap
JS is authored as ES modules using a custom-element base class, **not** a framework.
- **`assets/component.js`** exports `Component` (and `DeclarativeShadowElement`), the base class for nearly every interactive element. It auto-collects child elements with `ref="name"` into `this.refs`, supports `requiredRefs`, and wires up declarative event listeners.
- **Declarative events**: markup binds handlers with attributes like `on:click="/methodName"` or `on:click="#component-id/methodName"`. `/method` calls a method on the nearest enclosing component; `#id/method` targets the component with that id. Avoid adding manual `addEventListener` where this convention fits.
- **Module resolution** is via the `<script type="importmap">` in `snippets/scripts.liquid`, which maps `@theme/*` (and `@shopify/*`) aliases to hashed `asset_url`s. **When adding a new shared/imported module, register it in the importmap** or imports will 404. Per-component scripts are loaded as `<script type="module">` tags.
- Shadow DOM is used selectively (declarative `<template shadowrootmode="open">`), hydrated by `DeclarativeShadowElement` when components mount after initial render.

### i18n
`locales/*.json` hold translations (`*.default.json` = storefront, `*.schema.json` = theme-editor labels). Schemas and templates reference strings as `"t:some.key"` rather than literal text — add new user-facing strings to the locale files and reference them by key.

### Theme settings
`config/settings_schema.json` defines global settings (the merchant's Theme Settings panel); `config/settings_data.json` holds the saved values. Settings are read in Liquid as `settings.<id>`. `settings_data.json` changes when a merchant edits the theme, so expect churn there.

## Conventions

- Match the existing Liquid style: `{%- -%}` whitespace control, `{% doc %}` interface blocks on snippets, and `t:` keys for all visible copy.
- Don't introduce a build toolchain, npm dependencies, or test runners — this theme is intentionally buildless and runs directly on Shopify's servers.
- Asset references must go through Liquid filters (`{{ 'file.js' | asset_url }}`, `image_url`) — never hardcode CDN paths.
