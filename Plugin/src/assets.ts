import type { DesignDocument, Diagnostic, JsonValue } from './schema';
export function base64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += 12288) {
    let chunk = '';
    for (let i = start; i < Math.min(start + 12288, bytes.length); i += 3) {
      const bits = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      chunk += alphabet[(bits >>> 18) & 63] + alphabet[(bits >>> 12) & 63] +
        (i + 1 < bytes.length ? alphabet[(bits >>> 6) & 63] : '=') +
        (i + 2 < bytes.length ? alphabet[bits & 63] : '=');
    }
    chunks.push(chunk);
  }
  return chunks.join('');
}
export function findImages(value: JsonValue, nodeId: string, images: Map<string, Set<string>>): void {
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value) && value.type === 'IMAGE' && typeof value.imageHash === 'string') {
    const nodes = images.get(value.imageHash) || new Set<string>();
    nodes.add(nodeId);
    images.set(value.imageHash, nodes);
  }
  for (const child of Object.values(value)) findImages(child, nodeId, images);
}
export async function embedImages(api: PluginAPI, refs: Map<string, Set<string>>, diagnostics: Diagnostic[]): Promise<DesignDocument['assets']> {
  const images: DesignDocument['assets']['images'] = {};
  // Sequential reads bound peak memory for image-heavy selections.
  for (const [hash, nodeIds] of refs) {
    try {
      const image = api.getImageByHash(hash);
      if (!image) throw new Error('Image is missing or inaccessible.');
      images[hash] = { hash, encoding: 'base64', data: base64(await image.getBytesAsync()), status: 'embedded' };
    } catch (error) {
      images[hash] = { hash, encoding: 'base64', data: null, status: 'unavailable' };
      for (const nodeId of nodeIds) diagnostics.push({ severity: 'warning', code: 'ASSET_UNAVAILABLE',
        nodeId, property: 'imageHash', message: `Image ${hash}: ${String(error)}` });
    }
  }
  return { images };
}
