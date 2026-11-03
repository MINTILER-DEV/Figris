import type { PluginMessage, UIMessage } from './schema';
function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing UI element: ${id}`);
  return found as T;
}
const exportButton = element<HTMLButtonElement>('export');
const download = element<HTMLAnchorElement>('download');
const status = element('status');
const diagnostics = element<HTMLDetailsElement>('diagnostics');
let selectionCount = 0;
let busy = false;
let downloadURL: string | undefined;
function send(message: PluginMessage): void { parent.postMessage({ pluginMessage: message }, '*'); }
function setStatus(message: string, error = false): void {
  status.textContent = message;
  status.dataset.error = String(error);
}
function updateButton(): void {
  exportButton.disabled = busy || !selectionCount;
  exportButton.textContent = busy ? 'Extracting design…' : 'Export JSON';
}
function clearDownload(): void {
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = undefined;
  download.hidden = true;
  download.removeAttribute('href');
}
exportButton.onclick = () => {
  clearDownload();
  busy = true;
  updateButton();
  diagnostics.hidden = true;
  setStatus('Reading layers, typography, and image assets…');
  send({ type: 'export' });
};
window.onmessage = (event: MessageEvent<{ pluginMessage?: UIMessage }>) => {
  if (event.source !== parent) return;
  const message = event.data?.pluginMessage;
  if (!message) return;
  if (message.type === 'selection') {
    selectionCount = message.nodes.length;
    element('selection').textContent = selectionCount
      ? message.nodes.map(node => `${node.name} · ${node.type}`).join(', ')
      : 'No layers selected';
    updateButton();
    if (!busy) setStatus(selectionCount ? 'Ready to export. All descendants will be included.' : 'Select a frame or layer to begin.');
  } else if (message.type === 'error') {
    busy = false;
    updateButton();
    setStatus(message.message, true);
  } else if (message.type === 'exported') {
    busy = false;
    updateButton();
    try {
      clearDownload();
      const json = JSON.stringify(message.document, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      downloadURL = URL.createObjectURL(blob);
      download.href = downloadURL;
      download.download = message.filename;
      download.hidden = false;
      const issues = message.document.diagnostics;
      setStatus(`Export ready · ${(blob.size / 1024).toFixed(1)} KB · ${issues.length} diagnostic${issues.length === 1 ? '' : 's'}. Click Download JSON to save locally.`);
      diagnostics.hidden = !issues.length;
      element('diagnostic-summary').textContent = `${issues.length} export diagnostics`;
      const list = element('diagnostic-list');
      list.replaceChildren();
      for (const issue of issues.slice(0, 200)) {
        const item = document.createElement('li');
        item.textContent = `[${issue.code}] ${issue.nodeId} / ${issue.property}: ${issue.message}`;
        list.appendChild(item);
      }
      if (issues.length > 200) {
        const item = document.createElement('li');
        item.textContent = `${issues.length - 200} more diagnostics are included in the JSON.`;
        list.appendChild(item);
      }
    } catch (error) {
      clearDownload();
      setStatus(`Could not prepare download: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  }
};
window.addEventListener('unload', clearDownload);
updateButton();
send({ type: 'ready' });
