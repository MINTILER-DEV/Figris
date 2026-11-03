import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
const built = await build({ entryPoints: ['src/ui.ts'], bundle: true, write: false, format: 'iife' });
function mount() {
  const elements = new Map();
  const element = () => ({ textContent: '', dataset: {}, hidden: false, children: [],
    replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); },
    removeAttribute(key) { delete this[key]; } });
  for (const id of ['export', 'download', 'status', 'diagnostics', 'selection', 'diagnostic-summary', 'diagnostic-list']) elements.set(id, element());
  const sent = [], blobs = [], revoked = [];
  const parent = { postMessage(message) { sent.push(message.pluginMessage); } };
  const window = { addEventListener() {} };
  runInNewContext(built.outputFiles[0].text, { window, parent,
    document: { getElementById: id => elements.get(id), createElement: element },
    Blob: class { constructor(parts) { this.text = parts.join(''); this.size = this.text.length; blobs.push(this); } },
    URL: { createObjectURL: () => `blob:${blobs.length}`, revokeObjectURL: url => revoked.push(url) },
  });
  return { elements, sent, blobs, revoked, receive: message => window.onmessage({ source: parent, data: { pluginMessage: message } }) };
}
test('UI handles selection, export errors, downloadable JSON and repeat exports', () => {
  const ui = mount();
  const get = id => ui.elements.get(id);
  assert.equal(ui.sent[0].type, 'ready');
  assert.equal(get('export').disabled, true);
  ui.receive({ type: 'selection', nodes: [{ id: '1', name: '<b>literal layer name</b>', type: 'FRAME' }] });
  assert.match(get('selection').textContent, /<b>literal layer name/);
  assert.equal(get('export').disabled, false);
  get('export').onclick();
  assert.equal(get('export').disabled, true);
  assert.equal(ui.sent.at(-1).type, 'export');
  ui.receive({ type: 'error', message: 'Could not read selection' });
  assert.equal(get('status').dataset.error, 'true');
  assert.equal(get('export').disabled, false);
  get('export').onclick();
  const document = { format: 'figris', schemaVersion: '1.0.0', roots: [], diagnostics: [
    { code: 'FALLBACK_CANDIDATE', nodeId: '1', property: 'effects', message: 'Blur retained' },
  ] };
  ui.receive({ type: 'exported', filename: 'sample.figris.json', document });
  assert.deepEqual(JSON.parse(ui.blobs[0].text), document);
  assert.equal(get('download').download, 'sample.figris.json');
  assert.equal(get('download').hidden, false);
  assert.equal(get('diagnostic-list').children.length, 1);
  assert.equal(get('status').dataset.error, 'false');
  get('export').onclick();
  assert.deepEqual(ui.revoked, ['blob:1']);
  assert.equal(get('download').hidden, true);
});
