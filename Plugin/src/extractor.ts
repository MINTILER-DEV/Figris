import { APPEARANCE, COMPONENT, LAYOUT, METADATA, SUPPORTED, TEXT, TEXT_SEGMENTS, VECTOR } from './properties';
import { readProperties, serialize, errorMessage, type SerializationContext } from './serialize';
import { embedImages, findImages } from './assets';
import { SCHEMA_VERSION, type DesignDocument, type DesignNode, type Diagnostic } from './schema';

function diagnoseFallbacks(node: DesignNode, diagnostics: Diagnostic[]): void {
  const warn = (property: string, message: string): void => {
    diagnostics.push({ severity: 'warning', code: 'FALLBACK_CANDIDATE', nodeId: node.id, property, message });
  };
  const effects = node.appearance.effects;
  if (Array.isArray(effects) && effects.length) warn('effects', 'Effects are preserved; the future importer may need an image fallback.');
  if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') warn('vector', 'Vector geometry is preserved; native Roblox rendering may need a vector/image asset.');
  if (node.appearance.isMask) warn('isMask', 'Mask semantics are preserved and require importer support.');
  const blend = node.appearance.blendMode;
  if (blend && blend !== 'NORMAL' && blend !== 'PASS_THROUGH') warn('blendMode', 'Blend mode requires importer support or a fallback.');
  for (const key of ['fills', 'strokes'] as const) {
    const paints = node.appearance[key];
    if (Array.isArray(paints)) for (const paint of paints) {
      if (paint && typeof paint === 'object' && !Array.isArray(paint) && paint.type !== 'SOLID') {
        warn(key, `Paint ${String(paint.type)} is preserved and requires importer support.`);
      }
    }
  }
  if (node.text?.hasMissingFont) warn('hasMissingFont', 'Figma reports a missing font. Typography is preserved, but rendering needs the font.');
  if (Array.isArray(node.metadata.reactions) && node.metadata.reactions.length) warn('reactions', 'Prototype interactions are retained as metadata only.');
  if (node.metadata.boundVariables && Object.keys(node.metadata.boundVariables).length) warn('boundVariables', 'Variable aliases and resolved visual values are retained; variable definitions are not bundled.');
}

async function extractNode(api: PluginAPI, node: SceneNode, parentId: string | null,
  diagnostics: Diagnostic[], images: Map<string, Set<string>>): Promise<DesignNode> {
  const ctx: SerializationContext = { nodeId: node.id, mixed: api.mixed, diagnostics };
  const result: DesignNode = {
    id: node.id, parentId, name: node.name, type: node.type, supported: SUPPORTED.has(node.type),
    geometry: {
      x: node.x, y: node.y, width: node.width, height: node.height, rotation: 'rotation' in node ? node.rotation : null,
      relativeTransform: node.relativeTransform, absoluteTransform: node.absoluteTransform,
      absoluteBoundingBox: node.absoluteBoundingBox, absoluteRenderBounds: 'absoluteRenderBounds' in node ? node.absoluteRenderBounds : null,
    },
    appearance: readProperties(node, APPEARANCE, ctx), layout: readProperties(node, LAYOUT, ctx),
    metadata: readProperties(node, METADATA, ctx), children: [],
  };
  result.metadata.sourceParentId = node.parent?.id ?? null;
  if (!result.supported) diagnostics.push({ severity: 'warning', code: 'UNSUPPORTED_NODE', nodeId: node.id,
    property: 'type', message: `${node.type} is not fully supported. Common properties and descendants are retained; type-specific data may be incomplete.` });
  if (VECTOR.some(key => key in node)) result.vector = readProperties(node, VECTOR, ctx);
  if (node.type === 'TEXT') {
    result.text = readProperties(node, TEXT, ctx);
    try { result.text.runs = serialize(node.getStyledTextSegments(TEXT_SEGMENTS), 'text.runs', ctx); }
    catch (error) {
      result.text.runs = { $figris: 'unavailable', reason: errorMessage(error) };
      diagnostics.push({ severity: 'warning', code: 'PROPERTY_READ_FAILED', nodeId: node.id, property: 'text.runs', message: errorMessage(error) });
    }
  }
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE') {
    result.component = readProperties(node, COMPONENT, ctx);
    if (node.type === 'INSTANCE') {
      try { result.component.exposedInstanceIds = node.exposedInstances.map(instance => instance.id); }
      catch (error) {
        result.component.exposedInstanceIds = { $figris: 'unavailable', reason: errorMessage(error) };
        diagnostics.push({ severity: 'warning', code: 'PROPERTY_READ_FAILED', nodeId: node.id, property: 'exposedInstanceIds', message: errorMessage(error) });
      }
      try {
        const main = await node.getMainComponentAsync();
        result.component.mainComponent = main ? { id: main.id, key: main.key, name: main.name } : null;
      } catch (error) {
        result.component.mainComponent = { $figris: 'unavailable', reason: errorMessage(error) };
        diagnostics.push({ severity: 'warning', code: 'PROPERTY_READ_FAILED', nodeId: node.id, property: 'mainComponent', message: errorMessage(error) });
      }
    }
  }
  diagnoseFallbacks(result, diagnostics);
  for (const block of [result.appearance, result.text, result.vector]) if (block) findImages(block, node.id, images);
  if ('children' in node) {
    for (const child of node.children) result.children.push(await extractNode(api, child, node.id, diagnostics, images));
  }
  return result;
}

export async function extractSelection(api: PluginAPI, selection: readonly SceneNode[]): Promise<DesignDocument> {
  if (!selection.length) throw new Error('Select at least one frame or layer in Figma, then click Export.');
  const selectedIds = new Set(selection.map(node => node.id));
  const roots = selection.filter(node => {
    let parent = node.parent;
    while (parent) {
      if (selectedIds.has(parent.id)) return false;
      parent = parent.parent;
    }
    return true;
  });
  const diagnostics: Diagnostic[] = [];
  const images = new Map<string, Set<string>>();
  const document: DesignDocument = {
    format: 'figris', schemaVersion: SCHEMA_VERSION, generator: { name: 'Figris', version: '1.0.0' },
    exportedAt: new Date().toISOString(),
    source: { documentName: api.root.name, pageId: api.currentPage.id, pageName: api.currentPage.name, selectionIds: selection.map(node => node.id) },
    conventions: { units: 'figma-pixels', angles: 'figma-degrees', colorSpace: 'srgb', childOrder: 'back-to-front', coordinates: 'original-parent-and-page' },
    roots: [], assets: { images: {} }, diagnostics,
  };
  for (const root of roots) document.roots.push(await extractNode(api, root, null, diagnostics, images));
  document.assets = await embedImages(api, images, diagnostics);
  return document;
}
