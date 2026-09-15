# Add Spanish (es) localization

## Summary

Adds a Spanish (`es`) locale to the atlas: the complete interface, 81% of the
anatomical structure names, and a search that matches Spanish, English and FMA
identifiers.

It follows the `locales/<lang>.json` + shared runtime structure that the
existing localization work uses (Georgian #221, Uzbek #238, Hindi #234, Chinese
#323), so every catalogue stays independent and additive, and English remains
the fallback for any missing key.

## What is included

- **Interface** — `locales/es.json`: 149 messages, a full mirror of `en.json`.
- **Runtime** — `app/i18n.tsx`: `LocaleProvider` + `useT()`, **no new
  dependencies**.
- **Language switch** — EN/ES toggle in the header (`app/page.tsx`,
  `web/main.tsx`), plus every user-visible string in the viewer, hover tooltips,
  clinical panels, error messages, the model downloader and the shared UI
  components.
- **Structure names** — `locales/anatomy.es.json`: **1,808 of the 2,234 parts
  (81%)**, keyed by part id so they follow the model rather than the English
  labels.
- **Search** — matches Spanish, English and FMA ids (e.g. `hígado`, `liver`,
  `FMA7204` all find the same structure).
- **Accessibility** — the 17 hardcoded `aria-label`, `sr-only` and `title`
  strings in `components/ui` (dialog, sheet, sidebar, pagination, carousel,
  breadcrumb, spinner, toast) now resolve through the catalogue.

## How the names were translated

`scripts/build-anatomy-es.py` regenerates `locales/anatomy.es.json` from
`public/models/atlas.json` using a glossary of Terminologia Anatomica terms plus
rules for Spanish word order, gender/number agreement and multi-word units:

| English | Spanish |
|---|---|
| Left lacrimal nerve | Nervio lagrimal izquierdo |
| First thoracic vertebra | Primera vértebra torácica |
| Left anterior segmental bronchial tree | Árbol bronquial segmentario anterior izquierdo |
| Superficial head of left flexor pollicis brevis | Cabeza superficial del flexor corto del pulgar izquierdo |
| Set of dorsal digital arteries | Conjunto de las arterias dorsales digitales |

The remaining 19% are labels with sentence-like connectors
(`Communicating branch of left nasociliary nerve with left ciliary...`). They are
**intentionally left in English**: an accurate English label is better than a
broken Spanish one. The generator is deterministic, so covering them later is
only a matter of extending the glossary.

## Verification

- `npm run check` — no TypeScript errors.
- `npm run build` — production build succeeds.
- `scripts/check-i18n.py` — both catalogues are mirror images and every key used
  in the code (86) exists in both.
- `scripts/build-anatomy-es.py` — deterministic; re-running it produces the same
  file.
- **No new dependencies**, no changes to the 3D pipeline, the shaders or the
  model files: the diff only adds catalogues, one runtime module and scripts.

## Notes for the maintainer

- The catalogue layout mirrors `en.json` exactly, so additional locales can be
  added the same way; nothing is hardcoded to Spanish.
- If the Chinese contribution (#323) lands with a per-name dictionary, both
  approaches can coexist: this one resolves names by structure id through a
  glossary, that one by English label.
- Happy to split, rename or restructure any of this — the three commits are
  thematic (locale + toggle, structure names, UI accessibility strings).

<details>
<summary>Resumen en español</summary>

Agrega el idioma español al atlas: la interfaz completa, el 81% de los nombres
de las 2,234 estructuras y un buscador que responde en español, inglés y por
identificador FMA.

Respeta la estructura `locales/<idioma>.json` que ya usan los aportes de
georgiano, uzbeko, hindi y chino, sin dependencias nuevas y sin tocar el motor
3D ni los modelos. Los nombres que quedarían mal formados se dejan en inglés a
propósito. Los tres commits son temáticos: catálogo y selector de idioma,
nombres de estructuras y textos de accesibilidad de los componentes.
</details>
