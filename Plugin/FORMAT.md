# Figris JSON 1.0.0

`format: "figris"` and `schemaVersion: "1.0.0"` identify this intermediate
representation. [src/schema.ts](src/schema.ts) is the canonical typed contract.
Readers must reject unknown major versions. Minor versions may add fields; patch
versions clarify behavior without changing the contract.

## Envelope

| Field | Meaning |
| --- | --- |
| `generator` | Exporter name and version |
| `exportedAt` | ISO 8601 UTC timestamp |
| `source` | Document/page names, page ID, original selection IDs |
| `conventions` | Units, angles, colors, child order, coordinate space |
| `roots` | Selected trees without duplicate descendants |
| `assets.images` | Original encoded image bytes indexed by Figma hash |
| `diagnostics` | Issues with node IDs, property paths and explanations |

Numbers retain Figma precision. Lengths use Figma pixels, node rotation uses Figma
degrees, and colors retain Figma's sRGB channel values. Vector arc angles remain
radians as specified by Figma's `arcData` API. Paint/effect enums and nested objects
keep their original API field names and units.

## Nodes and geometry

Every node has `id`, `parentId`, `name`, original `type`, `supported`, `geometry`,
`appearance`, `layout`, `metadata`, and `children`. Optional `text`, `vector`, and
`component` blocks carry specialized data. `supported` means extraction support,
not that a native Roblox rendering implementation exists.

`parentId` points within the exported hierarchy and is `null` for roots.
`metadata.sourceParentId` retains the original Figma parent ID, including for roots.
Children follow Figma paint order, back to front; roots follow selection order.

`geometry.x/y` and `relativeTransform` remain relative to the **original Figma
parent**, even for roots. A root's local x/y is not necessarily a page position.
`absoluteTransform` maps local points into page coordinates and includes transforms
from ancestors outside the selection. Matrices have two rows:

```text
[[a, c, tx],
 [b, d, ty]]

pageX = a * localX + c * localY + tx
pageY = b * localX + d * localY + ty
```

`width/height` are local dimensions. `absoluteBoundingBox` and `absoluteRenderBounds`
are page-space bounds and may be `null`, including for invisible layers.
Unsupported node types without rotation use `rotation: null`. Positions are not
normalized and dimensions are not rounded.

Visibility and opacity are each layer's own values. Hidden descendants remain in
the hierarchy. Importers should compose visibility, opacity, transforms, masks, and
clipping through exported ancestry. Ancestor appearance outside the selection is
not included; select the enclosing frame when that context is needed.

## Property coverage

| Block | Preserved information |
| --- | --- |
| `appearance` | Visibility, opacity, blend/mask/clipping, ordered fills/strokes, individual stroke weights, alignment/caps/joins/dashes/geometry, effects, corner radii/smoothing, style IDs |
| `layout` | Constraints, horizontal/vertical/grid Auto Layout, wrap, sizing modes, alignment, padding, gaps, grow/stretch/positioning, min/max sizes, grid tracks/placement, layout grids, overflow |
| `text` | Characters, font family/style/variation settings, size/weight, case/decoration, line/letter/paragraph/list spacing, alignment, resizing/truncation/wrapping, font availability, styled UTF-16 ranges |
| `vector` | Paths/network, winding rules, ellipse arcs, polygon/star details, boolean operation |
| `component` | Key/description/definitions, variants, instance property overrides, exposed instance IDs, async main component reference |
| `metadata` | Original parent, locked state, variable aliases/modes, annotations, dev status, prototype reactions, export settings |

Exact allowlists are in [src/properties.ts](src/properties.ts), with names checked
against installed Figma typings. Inapplicable properties are absent. Style/variable
references remain IDs; resolved visual values appear in the visual blocks.
Referenced library definitions, font files, prototype execution, private plugin
data, and arbitrary future API fields are outside v1.

Mixed text values are resolved in `text.runs`, including per-range fills. `start/end`
indexes use JavaScript/Figma UTF-16 offsets, not Unicode code point counts. A mixed
scalar is represented as:

```json
{ "$figris": "mixed" }
```

Read failures, cycles, non-finite numbers, and other non-JSON values use:

```json
{ "$figris": "unavailable", "reason": "Explanation" }
```

Both markers carry diagnostics. Do not coerce them to zero, empty strings, or
default colors. An optional property failure does not discard the containing node.
A fatal export failure (such as deletion during traversal) appears in the UI and
does not return a misleading complete document.

## Assets

Image paints keep `imageHash`, crop/scale transforms, filters, opacity, and other
paint metadata. Each referenced hash resolves to an `assets.images[hash]` entry
with `hash`, `encoding: "base64"`, `status`, and `data`.

For `status: "embedded"`, decode `data` into the original encoded image file; detect
format from the bytes. These are original assets, not rasterized layers. For
`status: "unavailable"`, `data` is `null` and an `ASSET_UNAVAILABLE` diagnostic
identifies each affected node. Images are discovered in strokes and text-run fills
as well as regular fills, and embedded only once per hash.

## Diagnostics and importer policy

Each diagnostic has `severity`, `code`, `nodeId`, `property`, and `message`.

| Code | Meaning |
| --- | --- |
| `UNSUPPORTED_NODE` | Common fields/descendants retained; specialized data can be incomplete |
| `PROPERTY_READ_FAILED` | An API getter or asynchronous reference failed |
| `UNSERIALIZABLE_VALUE` | A value cannot be represented faithfully in JSON |
| `MIXED_VALUE` | Scalar varies; use text runs or individual corner/side fields |
| `ASSET_UNAVAILABLE` | Referenced image bytes could not be retrieved |
| `FALLBACK_CANDIDATE` | Preserved feature may need importer support or a fallback |

Current diagnostics use warning severity. Fatal errors use the UI error message
instead of returning a document. All diagnostics remain in the file even when the
UI limits its display to 200 entries. Fallback notices are advisory, not a Roblox
capability matrix or a pixel-perfect conversion claim. A future importer must
assess the properties it consumes, report unsupported features, and choose native
representation or localized fallbacks.
