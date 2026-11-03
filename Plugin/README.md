# Figris — Figma design extraction

Exports selected layers and their descendants into a local `.figris.json` file.
Preserves editable design data for a future Roblox GUI importer. This stage has no
backend, uploads, Roblox code, or layer rasterization.

## Build

Use a current Node.js LTS release (Node 22 or later recommended):

```powershell
cd Plugin
npm ci
npm run build
npm test
npm run lint
```

`build` checks both TypeScript environments and bundles the sandbox into `code.js`
and the iframe into `ui.html`. Both bundles are self-contained because Figma cannot
load local module imports from these entry points. The generated manifest ID
`1699269621545547675` is preserved.

`npm run watch` rebuilds code and UI on changes. Run `npm run typecheck` separately
in watch mode. Edit `src/ui.html` and `src/ui.ts`, then rebuild: `Plugin/ui.html` is
generated. `code.js` is ignored by Git and must be built after checkout.

## Test in Figma

1. Build the plugin. Open a Design file in the Figma desktop app.
2. Use **Plugins → Development → Import plugin from manifest…** and choose
   `Plugin/manifest.json`. Reuse an existing development import if already installed.
3. Create a frame with nested frames/groups, a rotated rectangle, an ellipse,
   vector, mixed-style text, an image fill, and a component instance. Give the frame
   Auto Layout, padding, spacing, and clipping. Add strokes, unequal corner radii,
   a gradient, and a shadow. Hide one child layer.
4. Select the frame and run **Plugins → Development → Figris**.
5. Click **Export JSON**, then **Download JSON**. The second click provides a user
   gesture for the iframe download. Depending on Figma/browser settings, approve the
   local save or choose its destination. The panel stays open for repeated exports.
6. Parse the downloaded file and inspect `roots[0]`. Compare child order, parent IDs,
   transforms, bounds, opacity, layout, and appearance against Figma. Confirm the
   hidden layer remains present, text changes appear in `text.runs`, and image hashes
   resolve to `assets.images` entries.
7. Review diagnostics in the panel and JSON. Shadows/gradients/vectors should be
   retained with fallback notices. Unsupported node types retain common properties
   and descendants with an `UNSUPPORTED_NODE` diagnostic.
8. Clear the selection: Export should be disabled with a selection hint. Select two
   unrelated frames and verify two roots. Select an ancestor and descendant together
   where Figma permits it: the descendant should appear only in its ancestor's tree.
9. Change selection while the panel is open and export again. Confirm the download
   name reflects the new selection and the Figma design remains unchanged.

**Verification boundary:** automated tests use Figma API and iframe DOM doubles.
They cover extraction, mixed values, image deduplication/encoding, failed getters,
and download preparation. They do not establish live Figma sandbox execution,
rendering, browser save behavior, or large-document performance. Run the manual
checks above before release.

## Export contract and limitations

See [FORMAT.md](FORMAT.md) and [src/schema.ts](src/schema.ts). The manifest permits
no network domains. Original image bytes are embedded once per hash. Fonts are
referenced by family/style/variation data, not embedded.

Effects, masks, blend modes, complex paints, and vectors may require importer support
or localized image fallbacks later. This stage generates no fallback images.
Variable/style IDs are retained alongside resolved visual properties; their library
definitions are not bundled. Prototype reactions remain metadata only.

## Source map

| File | Responsibility |
| --- | --- |
| `code.ts` | Figma lifecycle, selection messages, export requests |
| `src/schema.ts` | API-independent JSON types and message protocol |
| `src/extractor.ts` | Traversal, text runs, components, diagnostics |
| `src/properties.ts` | Property coverage checked against Figma typings |
| `src/serialize.ts` | Safe JSON conversion and property read isolation |
| `src/assets.ts` | Image discovery, deduplication, original-byte embedding |
| `src/ui.ts`, `src/ui.html` | Selection, export state, diagnostics, local download |
| `build.mjs` | Bundling and development watch mode |
| `tests/` | Regression tests with API/DOM doubles |

New property support should update allowlists, diagnostics, tests, and documentation
together. The allowlist excludes live node references, methods, private plugin data,
and unrelated editor state. API additions do not automatically enter the format.

API references: [node properties](https://developers.figma.com/docs/plugins/api/node-properties/),
[styled text segments](https://developers.figma.com/docs/plugins/api/properties/TextNode-getstyledtextsegments/),
[image access](https://developers.figma.com/docs/plugins/api/figma/).
