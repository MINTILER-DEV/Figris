/** Semver contract. Importers must reject unknown major versions. */
export const SCHEMA_VERSION = '1.0.0' as const;
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }
export type Matrix = [[number, number, number], [number, number, number]];
export interface Bounds { x: number; y: number; width: number; height: number }
export interface Diagnostic {
  severity: 'warning' | 'error';
  code: 'UNSUPPORTED_NODE' | 'FALLBACK_CANDIDATE' | 'PROPERTY_READ_FAILED' |
    'UNSERIALIZABLE_VALUE' | 'MIXED_VALUE' | 'ASSET_UNAVAILABLE';
  nodeId: string;
  property: string;
  message: string;
}
/** Property blocks retain Figma API names, enums and units. No Roblox rounding. */
export interface DesignNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  supported: boolean;
  geometry: {
    x: number; y: number; width: number; height: number; rotation: number | null;
    relativeTransform: Matrix;
    absoluteTransform: Matrix;
    absoluteBoundingBox: Bounds | null;
    absoluteRenderBounds: Bounds | null;
  };
  appearance: JsonObject;
  layout: JsonObject;
  vector?: JsonObject;
  text?: JsonObject;
  component?: JsonObject;
  metadata: JsonObject;
  children: DesignNode[];
}
export interface ImageAsset {
  hash: string;
  encoding: 'base64';
  /** Original encoded image bytes, not a rendered layer. */
  data: string | null;
  status: 'embedded' | 'unavailable';
}
export interface DesignDocument {
  format: 'figris';
  schemaVersion: typeof SCHEMA_VERSION;
  generator: { name: 'Figris'; version: string };
  exportedAt: string;
  source: { documentName: string; pageId: string; pageName: string; selectionIds: string[] };
  conventions: {
    units: 'figma-pixels'; angles: 'figma-degrees'; colorSpace: 'srgb';
    childOrder: 'back-to-front'; coordinates: 'original-parent-and-page';
  };
  roots: DesignNode[];
  assets: { images: Record<string, ImageAsset> };
  diagnostics: Diagnostic[];
}
export type PluginMessage = { type: 'ready' } | { type: 'export' };
export type UIMessage =
  | { type: 'selection'; nodes: { id: string; name: string; type: string }[] }
  | { type: 'exported'; filename: string; document: DesignDocument }
  | { type: 'error'; message: string };
