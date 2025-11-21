
// Basic geometric types
export interface Point {
  x: number;
  y: number;
}

// Drawing properties that can be applied to any shape
export interface DrawingProperties {
  color: string;
  fill: string;
  strokeWidth: number;
}

// Base interface for all shapes
interface ShapeBase {
  id: string;
  properties: DrawingProperties;
}

// Template Image Interface
export interface TemplateImage {
    id: string;
    data: string; // Base64 Data URL
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    isVisible: boolean;
    fileName: string;
}

// Specific shape definitions
export interface Line extends ShapeBase {
  type: 'line';
  p1: Point;
  p2: Point;
}

export interface Rectangle extends ShapeBase {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // Added rotation
}

export interface Circle extends ShapeBase {
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
  startAngle?: number; // Degrees, CCW, 0 = Right. If undefined, full circle.
  endAngle?: number;   // Degrees, CCW.
}

export interface Dimension extends ShapeBase {
    type: 'dimension';
    subType?: 'linear' | 'radial' | 'diameter'; // Added diameter
    p1: Point; // Linear: Start | Radial/Dia: Center
    p2: Point; // Linear: End   | Radial/Dia: Point on Circle
    offsetPoint: Point;
    // New editable properties
    textOverride?: string | null;
    fontSize?: number;
    extensionLineOffset?: number; // Gap between the shape and the start of the extension line
    extensionLineOvershoot?: number; // How far the extension line goes past the dimension line
}

export interface Text extends ShapeBase {
  type: 'text';
  x: number;
  y: number;
  content: string;
  fontSize: number;
  rotation?: number; // Added rotation
}

export interface SymbolShape extends ShapeBase {
  type: 'symbol';
  x: number;
  y: number;
  name: 'arrow' | 'warning' | 'extinguisher' | 'emergency_exit' | 'first_aid' | 'restroom' | 'trailer' | 'hydrant' | 'forklift' | 'pallet' | 'rack' | 'conveyor' | 'container';
  size: number;
  rotation: number;
}

// A union of all possible shapes
export type AnyShape = Line | Rectangle | Circle | Dimension | Text | SymbolShape;

// A type for property updates.
export type AnyShapePropertyUpdates = {
    p1?: Point;
    p2?: Point;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    cx?: number;
    cy?: number;
    r?: number;
    startAngle?: number;
    endAngle?: number;
    offsetPoint?: Point;
    textOverride?: string | null;
    fontSize?: number;
    extensionLineOffset?: number;
    extensionLineOvershoot?: number;
    content?: string;
    properties?: Partial<DrawingProperties>;
    name?: 'arrow' | 'warning' | 'extinguisher' | 'emergency_exit' | 'first_aid' | 'restroom' | 'trailer' | 'hydrant' | 'forklift' | 'pallet' | 'rack' | 'conveyor' | 'container';
    size?: number;
    rotation?: number;
    subType?: 'linear' | 'radial' | 'diameter';
};

// Tool definitions
export type Tool = 'select' | 'pan' | 'line' | 'rectangle' | 'circle' | 'dimension' | 'copy-area' | 'paste' | 'trim' | 'extend' | 'rotate' | 'text' | 'move' | 'arrow_symbol' | 'warning_symbol' | 'icon' | 'icon_extinguisher' | 'icon_emergency_exit' | 'icon_first_aid' | 'icon_restroom' | 'icon_trailer' | 'icon_hydrant' | 'icon_forklift' | 'icon_pallet' | 'icon_rack' | 'icon_conveyor' | 'icon_container';

// Snap mode definitions
export type SnapMode = 'grid' | 'endpoints' | 'midpoints' | 'centers' | 'inference';

// Unit definitions
export type Unit = 'mm' | 'cm' | 'm';