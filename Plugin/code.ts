import { extractSelection } from './src/extractor';
import { errorMessage } from './src/serialize';
import type { PluginMessage } from './src/schema';

figma.showUI(__html__, { width: 420, height: 560, themeColors: true });
figma.skipInvisibleInstanceChildren = false;
let exporting = false;
function sendSelection(): void {
  figma.ui.postMessage({ type: 'selection', nodes: figma.currentPage.selection.map(({ id, name, type }) => ({ id, name, type })) });
}
figma.on('selectionchange', sendSelection);
figma.ui.onmessage = async (message: PluginMessage) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'ready') sendSelection();
  if (message.type !== 'export' || exporting) return;
  exporting = true;
  try {
    const selection = [...figma.currentPage.selection];
    const result = await extractSelection(figma, selection);
    const stem = (selection.length === 1 ? selection[0].name : figma.currentPage.name)
      .replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'design';
    figma.ui.postMessage({ type: 'exported', filename: `${stem}.figris.json`, document: result });
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: errorMessage(error) });
  } finally { exporting = false; }
};
