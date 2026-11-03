import type { Diagnostic, JsonObject, JsonValue } from './schema';
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export interface SerializationContext {
  nodeId: string;
  mixed: symbol;
  diagnostics: Diagnostic[];
}
/** JSON.stringify alone silently drops symbols/undefined and corrupts nonfinite numbers. */
export function serialize(value: unknown, path: string, ctx: SerializationContext, ancestors = new Set<object>()): JsonValue {
  const issue = (message: string): JsonValue => {
    ctx.diagnostics.push({ severity: 'warning', code: 'UNSERIALIZABLE_VALUE', nodeId: ctx.nodeId, property: path, message });
    return { $figris: 'unavailable', reason: message };
  };
  if (value === ctx.mixed) {
    ctx.diagnostics.push({ severity: 'warning', code: 'MIXED_VALUE', nodeId: ctx.nodeId, property: path,
      message: 'Mixed value. Text runs or individual corner/stroke values carry the resolved detail where available.' });
    return { $figris: 'mixed' };
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : issue('Non-finite number');
  if (typeof value !== 'object') return issue(`Cannot encode ${typeof value}`);
  if (ancestors.has(value)) return issue('Cyclic object reference');
  ancestors.add(value);
  try {
    if (value instanceof Uint8Array) return Array.from(value);
    if (Array.isArray(value)) return value.map((item, i) => serialize(item, `${path}[${i}]`, ctx, ancestors));
    const output: JsonObject = {};
    for (const key of Object.keys(value)) {
      try {
        Object.defineProperty(output, key, { enumerable: true, configurable: true, writable: true,
          value: serialize((value as Record<string, unknown>)[key], `${path}.${key}`, ctx, ancestors) });
      } catch (error) { output[key] = issue(`Could not read ${key}: ${errorMessage(error)}`); }
    }
    return output;
  } finally { ancestors.delete(value); }
}
export function readProperties(node: SceneNode, keys: readonly string[], ctx: SerializationContext): JsonObject {
  const output: JsonObject = {};
  for (const key of keys) {
    if (!(key in node)) continue;
    try { output[key] = serialize((node as unknown as Record<string, unknown>)[key], key, ctx); }
    catch (error) {
      ctx.diagnostics.push({ severity: 'warning', code: 'PROPERTY_READ_FAILED', nodeId: node.id, property: key, message: errorMessage(error) });
      output[key] = { $figris: 'unavailable', reason: errorMessage(error) };
    }
  }
  return output;
}
