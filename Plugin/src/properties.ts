/** Explicit allowlist: never enumerate a node (parent references are cyclic). */
type KeysOfUnion<T> = T extends unknown ? keyof T : never;
type SceneProperty = KeysOfUnion<SceneNode>;
export const APPEARANCE = [
  'visible', 'opacity', 'blendMode', 'isMask', 'maskType', 'clipsContent',
  'fills', 'fillStyleId', 'strokes', 'strokeStyleId', 'strokeWeight',
  'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight',
  'strokeAlign', 'strokeCap', 'strokeJoin', 'strokeMiterLimit', 'dashPattern',
  'strokeGeometry', 'fillGeometry',
  'effects', 'effectStyleId', 'cornerRadius', 'cornerSmoothing',
  'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
  'backgrounds', 'backgroundStyleId',
] as const satisfies readonly SceneProperty[];
export const LAYOUT = [
  'constraints', 'layoutMode', 'layoutWrap', 'primaryAxisSizingMode', 'counterAxisSizingMode',
  'primaryAxisAlignItems', 'counterAxisAlignItems', 'counterAxisAlignContent',
  'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'itemSpacing',
  'counterAxisSpacing', 'itemReverseZIndex', 'strokesIncludedInLayout',
  'layoutAlign', 'layoutGrow', 'layoutPositioning', 'layoutSizingHorizontal',
  'layoutSizingVertical', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'layoutGrids', 'gridStyleId', 'gridRowCount', 'gridColumnCount',
  'gridRowGap', 'gridColumnGap', 'gridRowSizes', 'gridColumnSizes',
  'gridRowAnchorIndex', 'gridColumnAnchorIndex', 'gridRowSpan', 'gridColumnSpan',
  'gridChildHorizontalAlign', 'gridChildVerticalAlign', 'gridAutoTracks', 'overflowDirection',
] as const satisfies readonly SceneProperty[];
export const TEXT = [
  'characters', 'fontName', 'fontSize', 'fontWeight', 'textCase',
  'textDecoration', 'textAlignHorizontal', 'textAlignVertical', 'textAutoResize',
  'textTruncation', 'maxLines', 'paragraphIndent', 'paragraphSpacing', 'listSpacing',
  'hangingPunctuation', 'hangingList', 'lineHeight', 'letterSpacing', 'textStyleId',
  'hasMissingFont', 'hyperlink', 'autoRename', 'textWrapStyle', 'openTypeFeatures',
] as const satisfies readonly SceneProperty[];
export const TEXT_SEGMENTS: (keyof Omit<StyledTextSegment, 'characters' | 'start' | 'end'>)[] = [
  'fontName', 'fontSize', 'fontWeight', 'fontStyle', 'textCase', 'textDecoration',
  'textDecorationStyle', 'textDecorationOffset', 'textDecorationThickness',
  'textDecorationColor', 'textDecorationSkipInk', 'lineHeight', 'letterSpacing',
  'fills', 'textStyleId', 'fillStyleId', 'listOptions', 'listSpacing', 'indentation',
  'paragraphIndent', 'paragraphSpacing', 'hyperlink', 'boundVariables',
  'textStyleOverrides', 'openTypeFeatures', 'textWrapStyle',
];
export const VECTOR = ['vectorPaths', 'vectorNetwork', 'arcData', 'pointCount', 'innerRadius', 'booleanOperation'] as const satisfies readonly SceneProperty[];
export const COMPONENT = [
  'key', 'description', 'descriptionMarkdown', 'componentPropertyDefinitions',
  'componentProperties', 'componentPropertyReferences', 'variantProperties',
  'isExposedInstance', 'overrides',
] as const satisfies readonly SceneProperty[];
export const METADATA = [
  'locked', 'exportSettings', 'boundVariables', 'explicitVariableModes',
  'resolvedVariableModes', 'annotations', 'devStatus', 'reactions',
] as const satisfies readonly SceneProperty[];
export const SUPPORTED = new Set<SceneNode['type']>([
  'RECTANGLE', 'FRAME', 'GROUP', 'TEXT', 'ELLIPSE', 'VECTOR', 'COMPONENT',
  'COMPONENT_SET', 'INSTANCE', 'LINE', 'POLYGON', 'STAR', 'BOOLEAN_OPERATION',
]);
