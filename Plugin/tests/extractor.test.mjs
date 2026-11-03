import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { build } from 'esbuild';

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { extractSelection } = await load('src/extractor.ts');
const { base64 } = await load('src/assets.ts');
const { serialize } = await load('src/serialize.ts');
const mixed = Symbol('mixed');
function api(overrides = {}) {
  return { mixed, root: { name: 'Test file' }, currentPage: { id: 'page', name: 'Page 1' }, getImageByHash: () => null, ...overrides };
}
function node(id, type, extra = {}) {
  return { id, type, name: id, parent: null, x: 12.5, y: -4.25, width: 120, height: 32, rotation: 15,
    relativeTransform: [[1, 0, 12.5], [0, 1, -4.25]], absoluteTransform: [[1, 0, 112.5], [0, 1, 95.75]],
    absoluteBoundingBox: { x: 112.5, y: 95.75, width: 120, height: 32 }, absoluteRenderBounds: null,
    visible: true, opacity: .75, fills: [], strokes: [], effects: [], ...extra };
}
function nest(parent, children) {
  parent.children = children;
  for (const child of children) child.parent = parent;
  return parent;
}
test('rejects empty selection with an actionable message', async () => {
  await assert.rejects(extractSelection(api(), []), /Select at least one/);
});
test('round-trips hierarchy, precise geometry, hidden layers, all core node types and layout', async () => {
  const children = ['RECTANGLE', 'GROUP', 'ELLIPSE', 'VECTOR', 'COMPONENT', 'INSTANCE'].map((type, i) => node(`c${i}`, type));
  children[0].visible = false;
  children[2].arcData = { startingAngle: 0, endingAngle: Math.PI, innerRadius: .5 };
  children[3].vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 0 L 10 10 Z' }];
  children[4].componentPropertyDefinitions = { Label: { type: 'TEXT', defaultValue: 'Hi' } };
  children[5].exposedInstances = [];
  children[5].getMainComponentAsync = async () => children[4];
  children[4].key = 'component-key';
  const frame = nest(node('root', 'FRAME', { layoutMode: 'HORIZONTAL', layoutWrap: 'WRAP', paddingLeft: 16, itemSpacing: -2,
    constraints: { horizontal: 'STRETCH', vertical: 'CENTER' }, topLeftRadius: 4, topRightRadius: 8, clipsContent: true }), children);
  const exported = JSON.parse(JSON.stringify(await extractSelection(api(), [frame, children[3]])));
  assert.equal(exported.schemaVersion, '1.0.0');
  assert.equal(exported.roots.length, 1);
  const root = exported.roots[0];
  assert.deepEqual(root.children.map(child => child.id), children.map(child => child.id));
  assert.equal(root.children[0].appearance.visible, false);
  assert.equal(root.children[0].parentId, 'root');
  assert.equal(root.geometry.x, 12.5);
  assert.equal(root.geometry.absoluteTransform[0][2], 112.5);
  assert.equal(root.geometry.rotation, 15);
  assert.equal(root.layout.itemSpacing, -2);
  assert.equal(root.appearance.topRightRadius, 8);
  assert.deepEqual(root.children[3].vector.vectorPaths, children[3].vectorPaths);
  assert.equal(root.children[5].component.mainComponent.key, 'component-key');
  assert.equal(exported.diagnostics.filter(issue => issue.code === 'FALLBACK_CANDIDATE').length, 1);
});
test('mixed typography preserves independent UTF-16 runs and image fills', async () => {
  const runs = [
    { start: 0, end: 2, characters: 'Hi', fontSize: 16, fontName: { family: 'Inter', style: 'Bold' }, fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] },
    { start: 2, end: 4, characters: '😀', fontSize: 24, fontName: { family: 'Inter', style: 'Regular' }, fills: [{ type: 'IMAGE', imageHash: 'abc', scaleMode: 'FILL' }] },
  ];
  const text = node('text', 'TEXT', { characters: 'Hi😀', fontSize: mixed, fontName: mixed,
    getStyledTextSegments: fields => { assert.ok(fields.includes('lineHeight')); return runs; } });
  let reads = 0;
  const result = await extractSelection(api({ getImageByHash: () => ({ getBytesAsync: async () => { reads++; return new Uint8Array([1, 2, 3]); } }) }), [text]);
  assert.deepEqual(result.roots[0].text.runs, runs);
  assert.deepEqual(result.roots[0].text.fontSize, { $figris: 'mixed' });
  assert.equal(result.assets.images.abc.data, 'AQID');
  assert.equal(reads, 1);
  assert.ok(result.diagnostics.some(issue => issue.code === 'MIXED_VALUE'));
});
test('preserves unsupported subtrees, paint/effect data, failed getters and missing image references', async () => {
  const rectangle = node('rect', 'RECTANGLE', { fills: [{ type: 'IMAGE', imageHash: 'missing', scaleMode: 'CROP', imageTransform: [[1, 0, .5], [0, 1, 0]] }], effects: [{ type: 'LAYER_BLUR', radius: 4, visible: true }] });
  Object.defineProperty(rectangle, 'strokes', { get() { throw new Error('inaccessible'); } });
  const unsupported = nest(node('unknown', 'WIDGET'), [rectangle]);
  const result = await extractSelection(api(), [unsupported]);
  assert.equal(result.roots[0].supported, false);
  assert.equal(result.roots[0].children.length, 1);
  assert.equal(result.roots[0].children[0].appearance.strokes.$figris, 'unavailable');
  assert.equal(result.assets.images.missing.status, 'unavailable');
  for (const code of ['UNSUPPORTED_NODE', 'PROPERTY_READ_FAILED', 'ASSET_UNAVAILABLE', 'FALLBACK_CANDIDATE']) {
    assert.ok(result.diagnostics.some(issue => issue.code === code), code);
  }
});
test('deduplicates images and isolates async component/image failures', async () => {
  const imagePaint = [{ type: 'IMAGE', imageHash: 'shared' }];
  const first = node('first', 'RECTANGLE', { fills: imagePaint });
  const second = node('second', 'INSTANCE', { fills: imagePaint, exposedInstances: [], getMainComponentAsync: async () => { throw new Error('library unavailable'); } });
  let reads = 0;
  const result = await extractSelection(api({ getImageByHash: () => { reads++; return { getBytesAsync: async () => { throw new Error('not available'); } }; } }), [first, second]);
  assert.equal(reads, 1);
  assert.equal(result.roots.length, 2);
  assert.equal(result.diagnostics.filter(issue => issue.code === 'ASSET_UNAVAILABLE').length, 2);
  assert.equal(result.roots[1].component.mainComponent.$figris, 'unavailable');
});
test('serializer exposes non-JSON values and cycles without dropping them', () => {
  const cycle = {}; cycle.self = cycle;
  const ctx = { nodeId: 'test', mixed, diagnostics: [] };
  const result = serialize({ missing: undefined, infinity: Infinity, cycle, symbol: Symbol('other') }, 'test', ctx);
  assert.equal(result.missing.$figris, 'unavailable');
  assert.equal(result.cycle.self.$figris, 'unavailable');
  assert.equal(ctx.diagnostics.length, 4);
  assert.doesNotThrow(() => JSON.stringify(result));
});
test('base64 matches native encoding across padding and chunk boundaries', () => {
  for (const size of [0, 1, 2, 3, 12287, 12288, 12289, 25000]) {
    const bytes = Uint8Array.from({ length: size }, (_, i) => i % 256);
    assert.equal(base64(bytes), Buffer.from(bytes).toString('base64'));
  }
});
