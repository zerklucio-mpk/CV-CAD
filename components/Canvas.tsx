
import React, { useRef, useState, PointerEvent as ReactPointerEvent, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { AnyShape, Point, Line, Rectangle, Circle, Dimension, SnapMode, Unit, DrawingProperties, Text, AnyShapePropertyUpdates, SymbolShape, LineType, TitleBlock } from '../types';

// --- Vector Math Helpers ---
const add = (p1: Point, p2: Point): Point => ({ x: p1.x + p2.x, y: p1.y + p2.y });
const subtract = (p1: Point, p2: Point): Point => ({ x: p1.x - p2.x, y: p1.y - p2.y });
const scale = (p: Point, s: number): Point => ({ x: p.x * s, y: p.y * s });
const distance = (p1: Point, p2: Point): number => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
const magnitude = (p: Point): number => Math.sqrt(p.x * p.x + p.y * p.y);
const angle = (p: Point): number => (Math.atan2(-p.y, p.x) * 180 / Math.PI + 360) % 360;
const angleBetween = (p1: Point, p2: Point): number => angle(subtract(p2, p1));
const normalize = (p: Point): Point => {
    const m = magnitude(p);
    return m > 0 ? scale(p, 1 / m) : { x: 0, y: 0 };
};
const perpendicular = (p: Point): Point => ({ x: -p.y, y: p.x });
const dot = (p1: Point, p2: Point): number => p1.x * p2.x + p1.y * p2.y;
const pointOnLineSegment = (p: Point, a: Point, b: Point, tolerance: number): boolean => {
    const d = distance(a, b);
    if (d === 0) return distance(p, a) < tolerance;
    const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (d * d);
    if (t < 0 || t > 1) return false;
    const projection = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    return distance(p, projection) < tolerance;
};

const rotatePoint = (point: Point, center: Point, angleDeg: number): Point => {
    if (!center) return point;
    // Note: angleDeg is CCW.
    // In screen coords (Y down), standard rotation matrix with -angleDeg (CW logic) actually performs CCW visual rotation
    // x' = x cos(-a) - y sin(-a)
    // y' = x sin(-a) + y cos(-a)
    const rad = -angleDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos
    };
};

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY - (radius * Math.sin(angleInRadians))
  };
}

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const startPt = polarToCartesian(x, y, radius, startAngle);
    const endPt = polarToCartesian(x, y, radius, endAngle);

    let angleDiff = endAngle - startAngle;
    if (angleDiff < 0) angleDiff += 360;
    
    const largeArcFlag = angleDiff <= 180 ? "0" : "1";
    
    return [
        "M", startPt.x, startPt.y, 
        "A", radius, radius, 0, largeArcFlag, 0, endPt.x, endPt.y
    ].join(" ");
}

// --- Intersection Helpers ---
const getSegmentIntersection = (p1: Point, p2: Point, p3: Point, p4: Point): Point | null => {
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return null;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return { x: x1 + ua * (x2 - x1), y: y1 + ua * (y2 - y1) };
    }
    return null;
};

const getLineCircleIntersections = (p1: Point, p2: Point, circle: Circle): Point[] => {
    const d = subtract(p2, p1);
    const f = subtract(p1, {x: circle.cx, y: circle.cy});
    const a = dot(d, d);
    const b = 2 * dot(f, d);
    const c = dot(f, f) - circle.r * circle.r;
    let discriminant = b*b - 4*a*c;
    const points: Point[] = [];
    if (discriminant >= 0) {
        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2*a);
        const t2 = (-b + discriminant) / (2*a);
        if (t1 >= 0 && t1 <= 1) points.push(add(p1, scale(d, t1)));
        if (t2 >= 0 && t2 <= 1 && Math.abs(t1 - t2) > 1e-4) points.push(add(p1, scale(d, t2)));
    }
    return points;
};

const getCircleCircleIntersections = (c1: Circle, c2: Circle): Point[] => {
    const d = distance({x: c1.cx, y: c1.cy}, {x: c2.cx, y: c2.cy});
    if (d > c1.r + c2.r || d < Math.abs(c1.r - c2.r) || d === 0) return [];
    
    const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
    const h = Math.sqrt(c1.r * c1.r - a * a);
    
    const x2 = c1.cx + a * (c2.cx - c1.cx) / d;
    const y2 = c1.cy + a * (c2.cy - c1.cy) / d;
    
    return [
        { x: x2 + h * (c2.cy - c1.cy) / d, y: y2 - h * (c2.cx - c1.cx) / d },
        { x: x2 - h * (c2.cy - c1.cy) / d, y: y2 + h * (c2.cx - c1.cx) / d }
    ];
};

// Helper: Calculate Circle Center/Radius from 3 Points
const getCircleFromThreePoints = (p1: Point, p2: Point, p3: Point): { cx: number, cy: number, r: number } | null => {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;

    const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    
    // Check for collinearity
    if (Math.abs(D) < 1e-6) return null; 

    const Ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
    const Uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;

    const r = Math.sqrt(Math.pow(x1 - Ux, 2) + Math.pow(y1 - Uy, 2));

    return { cx: Ux, cy: Uy, r: r };
};

// Helper: Calculate Arcs based on 3 Points direction
const getArcAngles = (p1: Point, p2: Point, p3: Point, center: Point): { startAngle: number, endAngle: number } => {
    const a1 = angle(subtract(p1, center));
    const a2 = angle(subtract(p2, center));
    const a3 = angle(subtract(p3, center));

    let r2 = a2 - a1; if(r2 < 0) r2 += 360;
    let r3 = a3 - a1; if(r3 < 0) r3 += 360;

    if (r2 < r3) {
        return { startAngle: a1, endAngle: a3 };
    } else {
        return { startAngle: a3, endAngle: a1 };
    }
};

// --- Helper to get Rotation Handle Position ---
const getRotationHandlePos = (shape: AnyShape): { handle: Point, center: Point } | null => {
    const OFFSET = 30;
    let center = { x: 0, y: 0 };
    let topPoint = { x: 0, y: 0 };
    let rotation = 0;

    if (shape.type === 'rectangle' || shape.type === 'title_block') {
        center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
        topPoint = { x: center.x, y: shape.y - OFFSET };
        rotation = 'rotation' in shape ? (shape.rotation || 0) : 0;
    } else if (shape.type === 'text' || shape.type === 'symbol') {
         const height = shape.type === 'symbol' ? shape.size : shape.fontSize;
         const width = shape.type === 'symbol' ? shape.size : (shape.content.length * shape.fontSize * 0.6);
         
         if(shape.type === 'symbol') {
              center = { x: shape.x, y: shape.y };
              topPoint = { x: shape.x, y: shape.y - (shape.size/2) - OFFSET };
         } else {
              center = { x: shape.x + width/2, y: shape.y + height/2 };
              topPoint = { x: center.x, y: shape.y - OFFSET };
         }
         rotation = shape.rotation || 0;
    } else if (shape.type === 'circle') {
        center = { x: shape.cx, y: shape.cy };
        topPoint = { x: shape.cx, y: shape.cy - shape.r - OFFSET };
        rotation = 0;
    } else {
        return null;
    }

    const handle = rotatePoint(topPoint, center, rotation);
    return { handle, center };
};

// --- Helper to get Bounding Box of multiple shapes ---
const calculateSelectionBounds = (shapes: AnyShape[]): Rectangle | null => {
    if (shapes.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    shapes.forEach(s => {
        if (s.type === 'line' || s.type === 'dimension') {
            minX = Math.min(minX, s.p1.x, s.p2.x); maxX = Math.max(maxX, s.p1.x, s.p2.x);
            minY = Math.min(minY, s.p1.y, s.p2.y); maxY = Math.max(maxY, s.p1.y, s.p2.y);
            if (s.type === 'dimension') {
                minX = Math.min(minX, s.offsetPoint.x); maxX = Math.max(maxX, s.offsetPoint.x);
                minY = Math.min(minY, s.offsetPoint.y); maxY = Math.max(maxY, s.offsetPoint.y);
            }
        } else if (s.type === 'rectangle' || s.type === 'title_block') {
            let sx = s.x, sy = s.y, sw = s.width, sh = s.height;
            if (sw < 0) { sx += sw; sw = Math.abs(sw); }
            if (sh < 0) { sy += sh; sh = Math.abs(sh); }
            minX = Math.min(minX, sx); maxX = Math.max(maxX, sx + sw);
            minY = Math.min(minY, sy); maxY = Math.max(maxY, sy + sh);
        } else if (s.type === 'circle') {
            minX = Math.min(minX, s.cx - s.r); maxX = Math.max(maxX, s.cx + s.r);
            minY = Math.min(minY, s.cy - s.r); maxY = Math.max(maxY, s.cy + s.r);
        } else if (s.type === 'text') {
             // Approx text bounds
             const width = s.content.length * s.fontSize * 0.6;
             minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x + width);
             minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y + s.fontSize);
        } else if (s.type === 'symbol') {
             const hs = s.size / 2;
             minX = Math.min(minX, s.x - hs); maxX = Math.max(maxX, s.x + hs);
             minY = Math.min(minY, s.y - hs); maxY = Math.max(maxY, s.y + hs);
        }
    });

    if (minX === Infinity) return null;
    return { type: 'rectangle', id: 'bounds', x: minX, y: minY, width: maxX - minX, height: maxY - minY, properties: { color: '', fill: '', strokeWidth: 0, lineType: 'solid' } };
};


// --- Ray Intersection Helpers for Extend Tool ---
const getRaySegmentIntersection = (rayOrigin: Point, rayDir: Point, segStart: Point, segEnd: Point): Point | null => {
    const v1 = subtract(rayOrigin, segStart);
    const v2 = subtract(segEnd, segStart);
    const v3 = { x: -rayDir.y, y: rayDir.x };

    const dot2 = dot(v2, v3);
    if (Math.abs(dot2) < 1e-6) return null;

    const t1 = (v2.x * v1.y - v2.y * v1.x) / dot2;
    const t2 = dot(v1, v3) / dot2;

    if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
        return add(rayOrigin, scale(rayDir, t1));
    }
    return null;
};

const getRayCircleIntersection = (rayOrigin: Point, rayDir: Point, circle: Circle): Point | null => {
    const f = subtract(rayOrigin, {x: circle.cx, y: circle.cy});
    const a = dot(rayDir, rayDir);
    const b = 2 * dot(f, rayDir);
    const c = dot(f, f) - circle.r * circle.r;

    let discriminant = b*b - 4*a*c;
    if (discriminant < 0) return null;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2*a);
    const t2 = (-b + discriminant) / (2*a);

    let t = Infinity;
    const EPSILON = 0.001;

    if (t1 > EPSILON && t1 < t) t = t1;
    if (t2 > EPSILON && t2 < t) t = t2;

    if (t !== Infinity) return add(rayOrigin, scale(rayDir, t));
    return null;
};

// --- Unit Conversion Helper ---
const getUnitConversion = (unit: Unit) => {
    switch (unit) {
        case 'cm': return 10;
        case 'm': return 1000;
        default: return 1;
    }
};

// --- Shape Snap Point Calculation ---
const getShapeSnapPoints = (shape: AnyShape): { point: Point, type: SnapMode, shapeId: string }[] => {
    const points: { point: Point, type: SnapMode, shapeId: string }[] = [];
    const addP = (point: Point, type: SnapMode) => points.push({ point, type, shapeId: shape.id });

    switch (shape.type) {
        case 'line':
            const midPoint = { x: (shape.p1.x + shape.p2.x) / 2, y: (shape.p1.y + shape.p2.y) / 2 };
            addP(shape.p1, 'endpoints');
            addP(shape.p2, 'endpoints');
            addP(midPoint, 'midpoints');
            break;
        case 'dimension':
            if (shape.subType === 'radial' || shape.subType === 'diameter') {
                addP(shape.p1, 'centers');
                addP(shape.p2, 'endpoints');
            } else {
                const dimMidPoint = { x: (shape.p1.x + shape.p2.x) / 2, y: (shape.p1.y + shape.p2.y) / 2 };
                addP(shape.p1, 'endpoints');
                addP(shape.p2, 'endpoints');
                addP(dimMidPoint, 'midpoints');
            }
            addP(shape.offsetPoint, 'endpoints');
            break;
        case 'rectangle':
        case 'title_block':
            const { x, y, width, height } = shape;
            const rotation = 'rotation' in shape ? (shape.rotation || 0) : 0;
            const cx = x + width / 2;
            const cy = y + height / 2;
            const rotate = (px: number, py: number) => rotatePoint({x: px, y: py}, {x: cx, y: cy}, rotation);

            addP(rotate(x, y), 'endpoints');
            addP(rotate(x + width, y), 'endpoints');
            addP(rotate(x + width, y + height), 'endpoints');
            addP(rotate(x, y + height), 'endpoints');
            if (shape.type === 'rectangle') {
                addP(rotate(x + width / 2, y), 'midpoints');
                addP(rotate(x + width, y + height / 2), 'midpoints');
                addP(rotate(x + width / 2, y + height), 'midpoints');
                addP(rotate(x, y + height / 2), 'midpoints');
                addP({ x: cx, y: cy }, 'centers');
            }
            break;
        case 'circle':
            addP({ x: shape.cx, y: shape.cy }, 'centers');
            if (shape.startAngle !== undefined && shape.endAngle !== undefined) {
                 addP(polarToCartesian(shape.cx, shape.cy, shape.r, shape.startAngle), 'endpoints');
                 addP(polarToCartesian(shape.cx, shape.cy, shape.r, shape.endAngle), 'endpoints');
            } else {
                 addP({ x: shape.cx + shape.r, y: shape.cy }, 'endpoints');
                 addP({ x: shape.cx - shape.r, y: shape.cy }, 'endpoints');
                 addP({ x: shape.cx, y: shape.cy + shape.r }, 'endpoints');
                 addP({ x: shape.cx, y: shape.cy - shape.r }, 'endpoints');
            }
            break;
        case 'text':
            addP({ x: shape.x, y: shape.y }, 'endpoints');
            break;
        case 'symbol': {
            const { x, y, size, rotation } = shape;
            const hs = size / 2;
            const rotate = (p: Point) => rotatePoint(p, {x, y}, rotation);
            addP({ x, y }, 'centers');
            addP(rotate({x: x - hs, y: y - hs}), 'endpoints');
            addP(rotate({x: x + hs, y: y - hs}), 'endpoints');
            addP(rotate({x: x + hs, y: y + hs}), 'endpoints');
            addP(rotate({x: x - hs, y: y + hs}), 'endpoints');
            break;
        }
    }
    return points;
};

// Calculate Dash Array based on Line Type and Stroke Width (ISO-like proportions)
const getStrokeDashArray = (lineType: LineType | undefined, strokeWidth: number = 1): string | undefined => {
    const w = Math.max(strokeWidth, 0.1); // Prevent zero width division
    switch (lineType) {
        case 'dashed': return `${10 * w} ${5 * w}`; // Dash 10x, Gap 5x
        case 'dotted': return `${1 * w} ${3 * w}`; // Dot 1x, Gap 3x
        case 'dash-dot': return `${12 * w} ${3 * w} ${1 * w} ${3 * w}`; // Long Dash 12x, Gap 3x, Dot 1x, Gap 3x
        default: return undefined;
    }
};

const ShapeRenderer: React.FC<{ shape: AnyShape | Partial<AnyShape>; isSelected: boolean; isHighlighted?: boolean; conversionFactor: number; isPreview?: boolean; opacity?: number }> = React.memo(({ shape, isSelected, isHighlighted = false, conversionFactor, isPreview = false, opacity }) => {
    const effectivelySelected = isSelected || isHighlighted;
    const strokeWidth = shape.properties?.strokeWidth || 1;
    // For selection, use a fixed dash array. For drawing, use proportional dash array.
    const strokeDasharray = effectivelySelected ? '4 2' : getStrokeDashArray(shape.properties?.lineType, strokeWidth);

    const effectiveOpacity = opacity !== undefined ? opacity : (isPreview ? 0.7 : 1);

    const props = {
        stroke: effectivelySelected ? '#00A8FF' : (shape.properties?.color || '#FFFFFF'),
        fill: shape.properties?.fill || 'transparent',
        strokeWidth: strokeWidth,
        strokeDasharray: strokeDasharray,
        opacity: effectiveOpacity,
        strokeLinecap: 'butt' as 'butt' | 'round' | 'square' | 'inherit',
        strokeLinejoin: 'miter' as 'miter' | 'round' | 'bevel' | 'inherit'
    };
    
    if (!shape.type) return null;
    const isSafeNumber = (n: any) => typeof n === 'number' && Number.isFinite(n) && !Number.isNaN(n);
    
    if (shape.type === 'line') {
        if (!shape.p1 || !shape.p2 || !isSafeNumber(shape.p1.x) || !isSafeNumber(shape.p1.y) || !isSafeNumber(shape.p2.x)) return null;
    } else if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'symbol' || shape.type === 'title_block') {
        if (!isSafeNumber(shape.x) || !isSafeNumber(shape.y)) return null;
        if ((shape.type === 'rectangle' || shape.type === 'title_block') && (!isSafeNumber(shape.width) || !isSafeNumber(shape.height))) return null;
    } else if (shape.type === 'circle') {
        if (!isSafeNumber(shape.cx) || !isSafeNumber(shape.cy) || !isSafeNumber(shape.r)) return null;
    }

    // Only show handles if selected, not a preview, and fully opaque (not being manipulated)
    const showHandles = isSelected && !isPreview && effectiveOpacity > 0.9;
    const rotData = showHandles ? getRotationHandlePos(shape as AnyShape) : null;

    switch (shape.type) {
        case 'line': {
            const s = shape as Partial<Line>;
            if (!s.p1 || !s.p2) return null;
            return <line x1={s.p1.x} y1={s.p1.y} x2={s.p2.x} y2={s.p2.y} {...props} />;
        }
        case 'rectangle': {
            const s = shape as Partial<Rectangle>;
            if (s.x === undefined || s.y === undefined || s.width === undefined || s.height === undefined) return null;
            let renderX = s.x;
            let renderY = s.y;
            let renderW = s.width;
            let renderH = s.height;

            if (renderW < 0) { renderX += renderW; renderW = Math.abs(renderW); }
            if (renderH < 0) { renderY += renderH; renderH = Math.abs(renderH); }

            const centerX = renderX + renderW / 2;
            const centerY = renderY + renderH / 2;
            const transform = s.rotation ? `rotate(${-s.rotation}, ${centerX}, ${centerY})` : undefined;
            return (
                <g>
                    <rect x={renderX} y={renderY} width={renderW} height={renderH} transform={transform} {...props} />
                    {showHandles && (
                        <g transform={transform}>
                             <line x1={centerX - 5} y1={centerY} x2={centerX + 5} y2={centerY} stroke="#00A8FF" strokeWidth="1" />
                             <line x1={centerX} y1={centerY - 5} x2={centerX} y2={centerY + 5} stroke="#00A8FF" strokeWidth="1" />
                        </g>
                    )}
                    {rotData && (
                        <g>
                             <line x1={rotData.center.x} y1={rotData.center.y} x2={rotData.handle.x} y2={rotData.handle.y} stroke="#00A8FF" strokeWidth="1" />
                             <circle cx={rotData.handle.x} cy={rotData.handle.y} r={4} fill="white" stroke="#00A8FF" strokeWidth="1" style={{cursor: 'grab'}} />
                        </g>
                    )}
                </g>
            );
        }
        case 'title_block': {
             const s = shape as TitleBlock;
             const { x, y, width, height, data } = s;
             if (!data) return null; 
             
             const wCol1 = width * 0.25;
             const wCol2 = width * 0.45;
             const wCol3 = width * 0.30;
             const xCol1 = x;
             const xCol2 = x + wCol1;
             const xCol3 = x + wCol1 + wCol2;
             
             const hProject = height * 0.4;
             const hDrawn = height * 0.3;
             const hChecked = height * 0.3;
             const yCol2Row1 = y;
             const yCol2Row2 = y + hProject;
             const yCol2Row3 = y + hProject + hDrawn;

             const hCol3Row = height / 2;
             const yCol3Row1 = y;
             const yCol3Row2 = y + hCol3Row;

             const fontScale = s.fontScale || 1.0;
             const letterSpacing = s.letterSpacing || 0;
             const lineSpacingMult = s.lineSpacing || 1.0;
             const labelSize = Math.max(height * 0.08, 1.5) * fontScale; 
             const valueSize = Math.max(height * 0.11, 2) * fontScale;
             const valueYRatio = 0.3 + (0.55 * lineSpacingMult);
             const stroke = props.stroke;
             const strokeW = props.strokeWidth;

             const RenderCell = ({bx, by, bw, bh, label, value, isTitle=false}: any) => (
                <g>
                    <text x={bx + (bw*0.05)} y={by + (bh * 0.3)} fill={stroke} fontSize={labelSize} fontWeight="bold" fontFamily="sans-serif" style={{userSelect: 'none', letterSpacing}}>{label}</text>
                    <text x={bx + (bw*0.05)} y={by + (bh * valueYRatio)} fill={stroke} fontSize={isTitle ? valueSize * 1.2 : valueSize} fontWeight={isTitle?"bold":"normal"} fontFamily="sans-serif" style={{userSelect: 'none', letterSpacing}}>{value}</text>
                </g>
             );

             return (
                 <g {...props}>
                    <rect x={x} y={y} width={width} height={height} strokeWidth={strokeW} fill={props.fill} />
                    <line x1={xCol2} y1={y} x2={xCol2} y2={y+height} stroke={stroke} strokeWidth={strokeW} />
                    <line x1={xCol3} y1={y} x2={xCol3} y2={y+height} stroke={stroke} strokeWidth={strokeW} />
                    <text x={xCol1 + 5} y={y + 10} fill={stroke} fontSize={labelSize} fontWeight="bold" fontFamily="sans-serif" style={{letterSpacing}}>EMPRESA:</text>
                    <text x={xCol1 + (wCol1/2)} y={y + (height/2) + (valueSize/3)} textAnchor="middle" fill={stroke} fontSize={valueSize * 1.2} fontFamily="sans-serif" fontWeight="bold" style={{letterSpacing}}>{data.company}</text>
                    <line x1={xCol2} y1={yCol2Row2} x2={xCol3} y2={yCol2Row2} stroke={stroke} strokeWidth={strokeW} />
                    <line x1={xCol2} y1={yCol2Row3} x2={xCol3} y2={yCol2Row3} stroke={stroke} strokeWidth={strokeW} />
                    <RenderCell bx={xCol2} by={yCol2Row1} bw={wCol2} bh={hProject} label="PROYECTO:" value={data.project} isTitle={true} />
                    <RenderCell bx={xCol2} by={yCol2Row2} bw={wCol2} bh={hDrawn} label="REALIZÓ:" value={data.drawnBy} />
                    <RenderCell bx={xCol2} by={yCol2Row3} bw={wCol2} bh={hChecked} label="REVISÓ:" value={data.checkedBy} />
                    <line x1={xCol3} y1={yCol3Row2} x2={x+width} y2={yCol3Row2} stroke={stroke} strokeWidth={strokeW} />
                    <line x1={xCol3 + (wCol3/2)} y1={y} x2={xCol3 + (wCol3/2)} y2={y+height} stroke={stroke} strokeWidth={strokeW} />
                    <RenderCell bx={xCol3} by={yCol3Row1} bw={wCol3/2} bh={hCol3Row} label="ESCALA:" value={data.scale} />
                    <RenderCell bx={xCol3 + wCol3/2} by={yCol3Row1} bw={wCol3/2} bh={hCol3Row} label="FECHA:" value={data.date} />
                    <RenderCell bx={xCol3} by={yCol3Row2} bw={wCol3/2} bh={hCol3Row} label="PLANO:" value={data.sheet} isTitle={true} />
                    <RenderCell bx={xCol3 + wCol3/2} by={yCol3Row2} bw={wCol3/2} bh={hCol3Row} label="REV:" value={data.revision} />
                    {showHandles && (
                        <g>
                            <circle cx={x} cy={y} r={5} fill="white" stroke="#00A8FF" strokeWidth="1" />
                            <circle cx={x + width} cy={y} r={5} fill="white" stroke="#00A8FF" strokeWidth="1" />
                            <circle cx={x} cy={y + height} r={5} fill="white" stroke="#00A8FF" strokeWidth="1" />
                            <circle cx={x + width} cy={y + height} r={5} fill="white" stroke="#00A8FF" strokeWidth="1" />
                        </g>
                    )}
                 </g>
             );
        }
        case 'circle': {
            const s = shape as Partial<Circle>;
            if (s.cx === undefined || s.cy === undefined || s.r === undefined) return null;
            const isArc = s.startAngle !== undefined && s.endAngle !== undefined && Math.abs(s.endAngle - s.startAngle) < 359.9;
            
            let arcStartPt = null;
            let arcEndPt = null;
            if (isArc) {
                 arcStartPt = polarToCartesian(s.cx, s.cy, s.r, s.startAngle!);
                 arcEndPt = polarToCartesian(s.cx, s.cy, s.r, s.endAngle!);
            }
            return (
                <g>
                    {isArc ? (
                         <path d={describeArc(s.cx, s.cy, s.r, s.startAngle!, s.endAngle!)} {...props} fill="none" />
                    ) : (
                         <circle cx={s.cx} cy={s.cy} r={s.r} {...props} />
                    )}
                    {showHandles && (
                        <g>
                             <g transform={`translate(${s.cx}, ${s.cy})`}>
                                <line x1={-4} y1={0} x2={4} y2={0} stroke="#00A8FF" strokeWidth="1" />
                                <line x1={0} y1={-4} x2={0} y2={4} stroke="#00A8FF" strokeWidth="1" />
                             </g>
                             {isArc && arcStartPt && arcEndPt && (
                                 <g>
                                     <circle cx={arcStartPt.x} cy={arcStartPt.y} r={3} fill="#00A8FF" stroke="none" />
                                     <circle cx={arcEndPt.x} cy={arcEndPt.y} r={3} fill="#00A8FF" stroke="none" />
                                     <line x1={s.cx} y1={s.cy} x2={arcStartPt.x} y2={arcStartPt.y} stroke="#00A8FF" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
                                     <line x1={s.cx} y1={s.cy} x2={arcEndPt.x} y2={arcEndPt.y} stroke="#00A8FF" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
                                 </g>
                             )}
                             {rotData && !isArc && (
                                <g>
                                    <line x1={s.cx} y1={s.cy} x2={rotData.handle.x} y2={rotData.handle.y} stroke="#00A8FF" strokeWidth="1" />
                                    <circle cx={rotData.handle.x} cy={rotData.handle.y} r={4} fill="white" stroke="#00A8FF" strokeWidth="1" style={{cursor: 'grab'}} />
                                </g>
                             )}
                        </g>
                    )}
                </g>
            );
        }
        case 'dimension': {
             const s = shape as Partial<Dimension>;
            if (!s.p1 || !s.p2 || !s.offsetPoint) return null;
            const FONT_SIZE = s.fontSize ?? 4;
            if (s.subType === 'radial' || s.subType === 'diameter') {
                 const radius = distance(s.p1, s.p2);
                 let dimText = "";
                 let mainLine = null;
                 if (s.subType === 'diameter') {
                     const diameter = radius * 2;
                     dimText = s.textOverride ?? `Ø ${(diameter / conversionFactor).toFixed(2)}`;
                     const vec = subtract(s.p1, s.p2); 
                     const opposite = add(s.p1, vec); 
                     mainLine = <line x1={s.p2.x} y1={s.p2.y} x2={opposite.x} y2={opposite.y} strokeWidth={props.strokeWidth * 0.7} markerStart="url(#arrow)" markerEnd="url(#arrow)" />;
                 } else {
                     dimText = s.textOverride ?? `R ${(radius / conversionFactor).toFixed(2)}`;
                     mainLine = <line x1={s.p1.x} y1={s.p1.y} x2={s.p2.x} y2={s.p2.y} strokeWidth={props.strokeWidth * 0.7} markerEnd="url(#arrow)" />;
                 }
                 const textWidth = dimText.length * FONT_SIZE * 0.6 + FONT_SIZE * 0.4; 
                 const textHeight = FONT_SIZE * 1.2;
                 return (
                    <g {...props}>
                         <line x1={s.p1.x - 5} y1={s.p1.y} x2={s.p1.x + 5} y2={s.p1.y} strokeWidth={props.strokeWidth} />
                         <line x1={s.p1.x} y1={s.p1.y - 5} x2={s.p1.x} y2={s.p1.y + 5} strokeWidth={props.strokeWidth} />
                         {mainLine}
                         {distance(s.p2, s.offsetPoint) > 1 && (
                              <line x1={s.p2.x} y1={s.p2.y} x2={s.offsetPoint.x} y2={s.offsetPoint.y} strokeWidth={props.strokeWidth * 0.7} />
                         )}
                         {!isPreview && <rect x={s.offsetPoint.x - textWidth / 2} y={s.offsetPoint.y - textHeight / 2} width={textWidth} height={textHeight} fill="#303134" stroke="none" />}
                         <text x={s.offsetPoint.x} y={s.offsetPoint.y} fill={props.stroke} fontSize={FONT_SIZE} textAnchor="middle" dominantBaseline="middle" style={{ userSelect: 'none', fontFamily: 'sans-serif' }}>{dimText}</text>
                    </g>
                 );
            } else {
                const vec = subtract(s.p2, s.p1);
                const perpVec = normalize(perpendicular(vec));
                const offsetVec = subtract(s.offsetPoint, s.p1);
                const offsetDist = dot(offsetVec, perpVec);
                const p3 = add(s.p1, scale(perpVec, offsetDist));
                const p4 = add(s.p2, scale(perpVec, offsetDist));
                const sign = Math.sign(offsetDist) || 1;
                const extensionLineOffset = s.extensionLineOffset ?? 2;
                const extensionLineOvershoot = s.extensionLineOvershoot ?? 2;
                const ext1Start = add(s.p1, scale(perpVec, extensionLineOffset * sign));
                const ext1End = add(p3, scale(perpVec, extensionLineOvershoot * sign));
                const ext2Start = add(s.p2, scale(perpVec, extensionLineOffset * sign));
                const ext2End = add(p4, scale(perpVec, extensionLineOvershoot * sign));
                const length = distance(s.p1, s.p2);
                const dimText = s.textOverride ?? (length / conversionFactor).toFixed(2);
                const textMidPoint = { x: (p3.x + p4.x) / 2, y: (p3.y + p4.y) / 2 };
                const lineAngle = angleBetween(p3, p4);
                let textAngle = lineAngle;
                if (textAngle > 90 && textAngle < 270) { textAngle -= 180; }
                const textWidth = dimText.length * FONT_SIZE * 0.6 + FONT_SIZE * 0.4; 
                const textHeight = FONT_SIZE * 1.2;
                return (
                    <g {...props}>
                        <line x1={ext1Start.x} y1={ext1Start.y} x2={ext1End.x} y2={ext1End.y} strokeWidth={props.strokeWidth * 0.7} />
                        <line x1={ext2Start.x} y1={ext2Start.y} x2={ext2End.x} y2={ext2End.y} strokeWidth={props.strokeWidth * 0.7} />
                        <line x1={p3.x} y1={p3.y} x2={p4.x} y2={p4.y} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                        {!isPreview && <rect x={textMidPoint.x - textWidth / 2} y={textMidPoint.y - textHeight / 2} width={textWidth} height={textHeight} fill="#303134" transform={`rotate(${-textAngle} ${textMidPoint.x} ${textMidPoint.y})`} stroke="none" />}
                        <text x={textMidPoint.x} y={textMidPoint.y} transform={`rotate(${-textAngle} ${textMidPoint.x} ${textMidPoint.y})`} dominantBaseline="middle" fill={props.stroke} fontSize={FONT_SIZE} textAnchor="middle" style={{ userSelect: 'none', fontFamily: 'sans-serif' }}>{dimText}</text>
                    </g>
                );
            }
        }
        case 'text': {
             const s = shape as Partial<Text>;
             if (s.x === undefined || s.y === undefined || !s.content || !s.fontSize) return null;
             const transform = s.rotation ? `rotate(${-s.rotation}, ${s.x}, ${s.y})` : undefined;
            return (
                <g>
                    <text x={s.x} y={s.y} fill={effectivelySelected ? '#00A8FF' : props.stroke} fontSize={s.fontSize} dominantBaseline="hanging" transform={transform} style={{ userSelect: 'none', fontFamily: 'sans-serif' }} opacity={props.opacity}>
                        {s.content}
                    </text>
                     {showHandles && rotData && (
                        <g>
                             <line x1={rotData.center.x} y1={rotData.center.y} x2={rotData.center.x} y2={rotData.handle.y} stroke="#00A8FF" strokeWidth="1" />
                             <circle cx={rotData.handle.x} cy={rotData.handle.y} r={4} fill="white" stroke="#00A8FF" strokeWidth="1" style={{cursor: 'grab'}} />
                        </g>
                    )}
                </g>
            );
        }
        case 'symbol': {
            const s = shape as Partial<SymbolShape>;
            if (s.x === undefined || s.y === undefined || !s.size) return null;
             const safeSize = Number.isFinite(s.size) && s.size > 0 ? s.size : 24;
             const symbolProps = { ...props, transform: `translate(${s.x} ${s.y}) rotate(${-s.rotation || 0})` };
             const innerTransform = `scale(${safeSize / 24}) translate(-12, -12)`;
             // Reusing the same paths as existing code
             let content = null;
             switch (s.name) {
                case 'arrow': content = <path transform={innerTransform} d="M7 17l9.2-9.2M17 17V7H7" />; break;
                case 'warning': content = (<g transform={innerTransform}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></g>); break;
                case 'extinguisher': content = (<g transform={innerTransform}><rect x="2" y="2" width="20" height="20" rx="2" strokeWidth="2" /><path d="M12 6v-1" strokeWidth="2" /><path d="M9 10h6" strokeWidth="1.5" /><path d="M12 8a2 2 0 0 0-2 2v8a2 2 0 0 0 4 0v-8a2 2 0 0 0-2-2z" fill="currentColor" fillOpacity="0.2" stroke="none" /><path d="M12 10l3-2" strokeWidth="1.5" /></g>); break;
                case 'emergency_exit': content = (<g transform={innerTransform}><rect x="1" y="4" width="22" height="16" rx="2" strokeWidth="2"  /><rect x="4" y="6" width="6" height="12" strokeWidth="1.5"  /><circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none"/><path d="M13 12l2-1 2 1.5" strokeWidth="1.5" /><path d="M15 11v4" strokeWidth="1.5" /><path d="M15 15l-2 3" strokeWidth="1.5" /><path d="M15 15l2 2 1-1" strokeWidth="1.5" /></g>); break;
                case 'first_aid': content = (<g transform={innerTransform}><rect x="2" y="2" width="20" height="20" rx="2" strokeWidth="2"  /><rect x="10" y="6" width="4" height="12" fill="currentColor" stroke="none"/><rect x="6" y="10" width="12" height="4" fill="currentColor" stroke="none"/></g>); break;
                case 'restroom': content = (<g transform={innerTransform}><rect x="2" y="2" width="20" height="20" rx="2" strokeWidth="2" /><line x1="12" y1="4" x2="12" y2="20" strokeWidth="1" /><circle cx="7" cy="8" r="1.5" fill="currentColor" stroke="none" /><path d="M5.5 11h3v5h-3z" fill="currentColor" stroke="none" /><line x1="6" y1="16" x2="6" y2="19" strokeWidth="1.5" /><line x1="8" y1="16" x2="8" y2="19" strokeWidth="1.5" /><circle cx="17" cy="8" r="1.5" fill="currentColor" stroke="none" /><path d="M17 10l-2 4h4l-2-4z" fill="currentColor" stroke="none" /><line x1="16" y1="14" x2="16" y2="19" strokeWidth="1.5" /><line x1="18" y1="14" x2="18" y2="19" strokeWidth="1.5" /></g>); break;
                case 'trailer': content = (<g transform={innerTransform}><rect x="2" y="4" width="20" height="16" rx="0" strokeWidth="2"  /><line x1="2" y1="4" x2="22" y2="20" strokeWidth="1" opacity="0.2" /><line x1="22" y1="4" x2="2" y2="20" strokeWidth="1" opacity="0.2" /><rect x="6" y="8" width="12" height="8" rx="1" fill="currentColor" fillOpacity="0.3" stroke="none" /><line x1="18" y1="10" x2="21" y2="10" strokeWidth="2"  /><line x1="18" y1="14" x2="21" y2="14" strokeWidth="2"  /></g>); break;
                case 'hydrant': content = (<g transform={innerTransform}><rect x="2" y="2" width="20" height="20" rx="2" strokeWidth="2" /><path d="M8 7v10" strokeWidth="3" /><path d="M16 7v10" strokeWidth="3" /><path d="M8 12h8" strokeWidth="3" /></g>); break;
                case 'forklift': content = (<g transform={innerTransform}><rect x="12" y="2.5" width="13.5" height="13.5" transform="rotate(45 12 2.5)" rx="1" strokeWidth="2"  /><path d="M9 16h3v-5h-2v-1h3l1 6h-5z" fill="currentColor" stroke="none"/><path d="M14 10v6" strokeWidth="1.5" /><line x1="7" y1="16" x2="9" y2="16" strokeWidth="1.5" /><circle cx="10" cy="17" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="1.5" fill="currentColor" stroke="none"/></g>); break;
                case 'pallet': content = (<g transform={innerTransform}><rect x="2" y="2" width="20" height="20" rx="1" strokeWidth="2"  /><rect x="5" y="5" width="14" height="14" strokeWidth="1.5"  /><line x1="5" y1="12" x2="19" y2="12" strokeWidth="1" /><line x1="12" y1="5" x2="12" y2="19" strokeWidth="1" /></g>); break;
                case 'rack': content = (<g transform={innerTransform}><rect x="2" y="2" width="20" height="20" strokeWidth="2" /><line x1="2" y1="8" x2="22" y2="8" strokeWidth="1.5" /><line x1="2" y1="16" x2="22" y2="16" strokeWidth="1.5" /><line x1="7" y1="2" x2="7" y2="22" strokeWidth="1.5" /><line x1="17" y1="2" x2="17" y2="22" strokeWidth="1.5" /></g>); break;
                case 'conveyor': content = (<g transform={innerTransform}><rect x="2" y="6" width="20" height="12" rx="2" strokeWidth="2"  /><circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"/></g>); break;
                case 'container': content = (<g transform={innerTransform}><rect x="2" y="4" width="20" height="16" strokeWidth="2"  /><line x1="6" y1="4" x2="6" y2="20" strokeWidth="1.5" /><line x1="10" y1="4" x2="10" y2="20" strokeWidth="1.5" /><line x1="14" y1="4" x2="14" y2="20" strokeWidth="1.5" /><line x1="18" y1="4" x2="18" y2="20" strokeWidth="1.5" /><rect x="6" y="8" width="12" height="8" rx="1" fill="currentColor" fillOpacity="0.2" stroke="none" /></g>); break;
                case 'door': content = (<g transform={innerTransform}><path d="M3 21V3" strokeWidth="2" /><path d="M3 3h14v18" strokeWidth="1.5" strokeDasharray="2 2" /><path d="M17 21H3" strokeWidth="2" /><path d="M3 21c9.941 0 18-8.059 18-18" strokeDasharray="2 2" strokeWidth="1.5" fill="none" /></g>); break;
                case 'window': content = (<g transform={innerTransform}><rect x="3" y="6" width="18" height="12" strokeWidth="2" /><line x1="3" y1="12" x2="21" y2="12" strokeWidth="1.5" /><line x1="12" y1="6" x2="12" y2="18" strokeWidth="1.5" /></g>); break;
             }
             
             return (
                <g>
                    <g {...symbolProps}>{content}</g>
                    {showHandles && rotData && (
                        <g>
                             <line x1={rotData.center.x} y1={rotData.center.y} x2={rotData.handle.x} y2={rotData.handle.y} stroke="#00A8FF" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                             <circle cx={rotData.handle.x} cy={rotData.handle.y} r={4 / conversionFactor} fill="white" stroke="#00A8FF" strokeWidth="1" style={{cursor: 'grab'}} vectorEffect="non-scaling-stroke" />
                        </g>
                    )}
                </g>
            );
        }
        default: return null;
    }
});

type TrimGeometry = 
    | { type: 'line', p1: Point, p2: Point, tMin: number, tMax: number, sideIndex?: number }
    | { type: 'arc', cx: number, cy: number, r: number, startAngle: number, endAngle: number };

const Canvas: React.FC = () => {
    const {
        shapes, addShapes, addShape, activeTool, setActiveTool, drawingProperties, viewTransform,
        selectedShapeId, setSelectedShapeId, selectedShapeIds, setSelectedShapeIds, toggleShapeSelection,
        snapModes, isOrthoMode, unit,
        clipboard, setClipboard, updateShape, updateShapes, replaceShapes, deleteShape, deleteShapes,
        templateImage
    } = useAppContext();
    const { setViewTransform } = useAppContext();

    // calculateTrimSegments implementation for trim tool
    const calculateTrimSegments = (target: AnyShape, cursor: Point): TrimGeometry | null => {
        // Collect intersections
        const intersections: Point[] = [];
        const otherShapes = shapes.filter(s => s.id !== target.id);
        
        // Helper to get all intersections for a line segment against world
        const getIntersectionsOnSegment = (p1: Point, p2: Point): number[] => {
            const ts: number[] = [0, 1];
            otherShapes.forEach(s => {
                 if (s.type === 'line') {
                      const p = getSegmentIntersection(p1, p2, s.p1, s.p2);
                      if (p) {
                          const v = subtract(p2, p1);
                          const vp = subtract(p, p1);
                          const t = dot(vp, v) / dot(v, v);
                          if (t > 0.001 && t < 0.999) ts.push(t);
                      }
                 } else if (s.type === 'rectangle' || s.type === 'title_block') {
                      const { x, y, width, height } = s;
                      const corners = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
                      const center = { x: x + width/2, y: y + height/2 };
                      const rot = 'rotation' in s ? (s.rotation || 0) : 0;
                      const rotatedCorners = corners.map(p => rotatePoint(p, center, rot));
                      for(let i=0; i<4; i++) {
                          const p = getSegmentIntersection(p1, p2, rotatedCorners[i], rotatedCorners[(i+1)%4]);
                          if (p) {
                             const v = subtract(p2, p1);
                             const vp = subtract(p, p1);
                             const t = dot(vp, v) / dot(v, v);
                             if (t > 0.001 && t < 0.999) ts.push(t);
                          }
                      }
                 } else if (s.type === 'circle') {
                     const points = getLineCircleIntersections(p1, p2, s);
                     points.forEach(p => {
                         const v = subtract(p2, p1);
                         const vp = subtract(p, p1);
                         const t = dot(vp, v) / dot(v, v);
                         if (t > 0.001 && t < 0.999) ts.push(t);
                     });
                 }
            });
            return Array.from(new Set(ts)).sort((a, b) => a - b);
        };

        if (target.type === 'line') {
            const ts = getIntersectionsOnSegment(target.p1, target.p2);
            // Require intersections to trim
            if (ts.length <= 2) return null;

            const v = subtract(target.p2, target.p1);
            const lenSq = dot(v, v);
            if (lenSq === 0) return null;
            const vp = subtract(cursor, target.p1);
            const tCursor = dot(vp, v) / lenSq;
            for (let i = 0; i < ts.length - 1; i++) {
                if (tCursor >= ts[i] && tCursor <= ts[i+1]) return { type: 'line', p1: target.p1, p2: target.p2, tMin: ts[i], tMax: ts[i+1] };
            }
            if (tCursor < 0) return { type: 'line', p1: target.p1, p2: target.p2, tMin: ts[0], tMax: ts[1] };
            if (tCursor > 1) return { type: 'line', p1: target.p1, p2: target.p2, tMin: ts[ts.length-2], tMax: ts[ts.length-1] };
            return null;
        } 
        else if (target.type === 'rectangle') {
            const { x, y, width, height } = target;
            const corners = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
            const center = { x: x + width/2, y: y + height/2 };
            const rot = target.rotation || 0;
            const rotatedCorners = corners.map(p => rotatePoint(p, center, rot));
            
            // Find closest side to cursor
            let bestSideIdx = -1;
            let minDist = Infinity;
            
            for(let i=0; i<4; i++) {
                const p1 = rotatedCorners[i];
                const p2 = rotatedCorners[(i+1)%4];
                // Project cursor onto line segment to find distance
                const v = subtract(p2, p1);
                const w = subtract(cursor, p1);
                const c1 = dot(w, v);
                const c2 = dot(v, v);
                let t = c1/c2;
                if(t < 0) t = 0; if(t > 1) t = 1;
                const closestPoint = add(p1, scale(v, t));
                const d = distance(cursor, closestPoint);
                if(d < minDist) { minDist = d; bestSideIdx = i; }
            }

            if(bestSideIdx !== -1) {
                const p1 = rotatedCorners[bestSideIdx];
                const p2 = rotatedCorners[(bestSideIdx+1)%4];
                const ts = getIntersectionsOnSegment(p1, p2);
                
                // Require intersections
                if (ts.length <= 2) return null;

                const v = subtract(p2, p1);
                const lenSq = dot(v, v);
                const vp = subtract(cursor, p1);
                const tCursor = dot(vp, v) / lenSq;
                
                let tMin = 0, tMax = 1;
                let found = false;
                for (let i = 0; i < ts.length - 1; i++) {
                    if (tCursor >= ts[i] && tCursor <= ts[i+1]) { tMin = ts[i]; tMax = ts[i+1]; found=true; break; }
                }
                if(!found) {
                     if (tCursor < 0) { tMin = ts[0]; tMax = ts[1]; }
                     else if (tCursor > 1) { tMin = ts[ts.length-2]; tMax = ts[ts.length-1]; }
                }
                return { type: 'line', p1, p2, tMin, tMax, sideIndex: bestSideIdx };
            }
            return null;
        }
        else if (target.type === 'circle') {
             // Collect angular intersections
             let angles: number[] = [];
             const center = {x: target.cx, y: target.cy};
             
             otherShapes.forEach(s => {
                  let points: Point[] = [];
                  if(s.type === 'line') {
                       points = getLineCircleIntersections(s.p1, s.p2, target);
                  } else if (s.type === 'rectangle' || s.type === 'title_block') {
                      const { x, y, width, height } = s;
                      const corners = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
                      const c = { x: x + width/2, y: y + height/2 };
                      const rot = 'rotation' in s ? (s.rotation || 0) : 0;
                      const rc = corners.map(p => rotatePoint(p, c, rot));
                      for(let i=0; i<4; i++) {
                           points.push(...getLineCircleIntersections(rc[i], rc[(i+1)%4], target));
                      }
                  } else if (s.type === 'circle') {
                       points = getCircleCircleIntersections(target, s);
                  }
                  
                  points.forEach(p => {
                       angles.push(angle(subtract(p, center)));
                  });
             });
             
             const isArc = target.startAngle !== undefined && target.endAngle !== undefined;
             if (isArc) {
                  angles.push(target.startAngle!);
                  angles.push(target.endAngle!);
             }
             
             angles = Array.from(new Set(angles)).sort((a, b) => a - b);
             if (angles.length === 0) return null; // No intersections to trim against
             
             // Wrap logic for full circles
             if (!isArc && angles.length > 0) {
                  angles.push(angles[0] + 360);
             }

             // Find angle under cursor
             let cursorAngle = angle(subtract(cursor, center));
             
             for(let i=0; i<angles.length-1; i++) {
                  let start = angles[i];
                  let end = angles[i+1];
                  
                  let ca = cursorAngle;
                  // For full circle wrapping
                  if (ca < start && !isArc) ca += 360;
                  
                  if (ca >= start && ca <= end) {
                       return { type: 'arc', cx: target.cx, cy: target.cy, r: target.r, startAngle: start % 360, endAngle: end % 360 };
                  }
             }
             
             return null;
        }

        return null;
    };

    const svgRef = useRef<SVGSVGElement>(null);
    const isInteractingRef = useRef(false);
    // Ref to prevent double-firing of handlePointerUp on the same interaction sequence
    const hasHandledUpRef = useRef(false);
    
    const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 });
    const [panStart, setPanStart] = useState<Point | null>(null);
    const [currentShape, setCurrentShape] = useState<Partial<AnyShape> | null>(null);
    const [dimensionStep, setDimensionStep] = useState(0);
    const [arcStep, setArcStep] = useState(0);
    const [arcPoints, setArcPoints] = useState<Point[]>([]);
    
    const [selectionRect, setSelectionRect] = useState<Rectangle | null>(null);

    const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
    const [activeSnapPoint, setActiveSnapPoint] = useState<{ point: Point, type: SnapMode } | null>(null);
    const [inferenceLines, setInferenceLines] = useState<Line[]>([]);

    const [dragStartScreenPos, setDragStartScreenPos] = useState<Point | null>(null);
    const DRAG_THRESHOLD = 3; 

    const [draggingHandle, setDraggingHandle] = useState<{ 
        shapeId: string, 
        handleIndex: number | 'rotate' | 'move', 
        originalShape: AnyShape,
        groupOriginals?: Record<string, AnyShape>,
        currentPreview?: AnyShape
    } | null>(null);
    const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
    const [hoveredTrimSegment, setHoveredTrimSegment] = useState<{ shapeId: string; geometry: TrimGeometry } | null>(null);
    const [hoveredExtendPreview, setHoveredExtendPreview] = useState<{ originalShape: Line, newEndpoint: Point, endToUpdate: 'p1' | 'p2' } | null>(null);
    const [hoveredDimensionTarget, setHoveredDimensionTarget] = useState<{ type: 'segment' | 'circle', p1: Point, p2: Point, circleId?: string } | null>(null);
    const [moveBasePoint, setMoveBasePoint] = useState<Point | null>(null);
    const [rotateState, setRotateState] = useState<{ startAngle: number, center: Point, groupOriginals: Record<string, AnyShape> } | null>(null);
    
    const MAX_SAFE_RADIUS = 500000;

    // Bounds for Selection Box
    const multiSelectionBounds = useMemo(() => {
        if (selectedShapeIds.size > 1) {
             const selected = shapes.filter(s => selectedShapeIds.has(s.id));
             return calculateSelectionBounds(selected);
        }
        return null;
    }, [selectedShapeIds, shapes]);

    useEffect(() => {
        if (svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setViewTransform({ x: rect.width / 2, y: rect.height / 2, scale: 1 });
            }
        }
    }, [setViewTransform]);

    useEffect(() => {
        const handleGlobalPointerUp = (e: PointerEvent) => {
            // Forward the global pointer event to our handler
            if (isInteractingRef.current || draggingHandle || panStart || currentShape || dragStartScreenPos) {
                 handlePointerUp(e);
            }
        };
        window.addEventListener('pointerup', handleGlobalPointerUp);
        return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
    }, [isInteractingRef.current, draggingHandle, panStart, currentShape, dragStartScreenPos]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                let handled = false;
                if (currentShape || dimensionStep > 0 || arcStep > 0 || draggingHandle || panStart || isInteractingRef.current || activeTool === 'paste') {
                    setCurrentShape(null); setDimensionStep(0); setArcStep(0); setArcPoints([]); setDraggingHandle(null); setPanStart(null);
                    if (activeTool === 'paste') setClipboard(null);
                    isInteractingRef.current = false; handled = true;
                }
                if (activeTool !== 'select') {
                    setActiveTool('select'); setHoveredTrimSegment(null); setHoveredExtendPreview(null); setMoveBasePoint(null); setRotateState(null); handled = true;
                }
                if (!handled && (selectedShapeIds.size > 0)) {
                    setSelectedShapeIds(new Set());
                }
                return;
            }
             if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) return;
             const selectedIds = Array.from(selectedShapeIds);
            if (selectedIds.length > 0) {
                const step = e.shiftKey ? 10 : 1;
                let dx = 0; let dy = 0;
                switch (e.key) {
                    case 'ArrowLeft': dx = -step; break;
                    case 'ArrowRight': dx = step; break;
                    case 'ArrowUp': dy = -step; break;
                    case 'ArrowDown': dy = step; break;
                    case 'Backspace': case 'Delete': e.preventDefault(); deleteShapes(selectedIds); return;
                    default: return;
                }
                e.preventDefault();
                
                // BATCH UPDATE FOR KEYBOARD MOVES
                const batchUpdates: { id: string, updates: AnyShapePropertyUpdates }[] = [];
                selectedIds.forEach(id => {
                    const shape = shapes.find(s => s.id === id);
                    if (!shape) return;
                    const updates: AnyShapePropertyUpdates = {};
                    if (shape.type === 'line' || shape.type === 'dimension') {
                        updates.p1 = { x: shape.p1.x + dx, y: shape.p1.y + dy };
                        updates.p2 = { x: shape.p2.x + dx, y: shape.p2.y + dy };
                        if (shape.type === 'dimension') updates.offsetPoint = { x: shape.offsetPoint.x + dx, y: shape.offsetPoint.y + dy };
                    } else if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'symbol' || shape.type === 'title_block') {
                        updates.x = shape.x + dx; updates.y = shape.y + dy;
                    } else if (shape.type === 'circle') {
                        updates.cx = shape.cx + dx; updates.cy = shape.cy + dy;
                    }
                    batchUpdates.push({ id, updates });
                });
                updateShapes(batchUpdates);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedShapeIds, shapes, updateShape, updateShapes, deleteShape, deleteShapes, setSelectedShapeIds, activeTool, setActiveTool, currentShape, dimensionStep, draggingHandle, panStart, arcStep]);

    useEffect(() => {
        setHoveredTrimSegment(null); setHoveredExtendPreview(null); setMoveBasePoint(null); setRotateState(null);
        if (activeTool !== 'dimension') { setHoveredDimensionTarget(null); setDimensionStep(0); if (currentShape?.type === 'dimension') setCurrentShape(null); }
        if (activeTool !== 'arc') { setArcStep(0); setArcPoints([]); if (currentShape?.type === 'circle' && (currentShape as any).startAngle !== undefined) setCurrentShape(null); }
        setDraggingHandle(null);
    }, [activeTool]);

    const conversionFactor = getUnitConversion(unit);
    
    const screenToWorld = useCallback((localPos: Point): Point => {
        const { x, y, scale } = viewTransform;
        return { x: (localPos.x - x) / scale, y: (localPos.y - y) / scale };
    }, [viewTransform]);
    
    const worldMousePos = useMemo(() => screenToWorld(mousePosition), [mousePosition, screenToWorld]);

    const allSnapPoints = useMemo(() => shapes.flatMap(getShapeSnapPoints), [shapes]);

    const applyConstraints = (p1: Point, p2: Point, shiftKey: boolean): Point => {
        if (shiftKey) return p2; 
        let endPoint = { ...p2 };
        if (isOrthoMode) {
            const dx = Math.abs(endPoint.x - p1.x);
            const dy = Math.abs(endPoint.y - p1.y);
            if (dx > dy) endPoint.y = p1.y; else endPoint.x = p1.x;
        }
        return endPoint;
    };
    
    const getHitTest = (pos: Point, tolerance: number): string | null => {
        for (let i = shapes.length - 1; i >= 0; i--) {
            const shape = shapes[i];
            let hitPos = pos;
            if ((shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'symbol' || shape.type === 'title_block') && ('rotation' in shape ? shape.rotation : 0)) {
                 let center = {x: 0, y: 0};
                 if (shape.type === 'rectangle' || shape.type === 'title_block') center = { x: shape.x + shape.width/2, y: shape.y + shape.height / 2 };
                 else center = { x: shape.x, y: shape.y };
                 hitPos = rotatePoint(pos, center, -(shape.rotation || 0));
            }
            switch (shape.type) {
                case 'line': if (pointOnLineSegment(hitPos, shape.p1, shape.p2, tolerance)) return shape.id; break;
                case 'dimension': if (pointOnLineSegment(hitPos, shape.p1, shape.p2, tolerance)) return shape.id; break;
                case 'rectangle': 
                case 'title_block': {
                    const { x, y, width, height } = shape;
                    const p1 = { x, y }, p2 = { x: x + width, y }, p3 = { x: x + width, y: y + height }, p4 = { x, y: y + height };
                    if (pointOnLineSegment(hitPos, p1, p2, tolerance) || pointOnLineSegment(hitPos, p2, p3, tolerance) || pointOnLineSegment(hitPos, p3, p4, tolerance) || pointOnLineSegment(hitPos, p4, p1, tolerance)) return shape.id;
                    break;
                }
                case 'circle': if (Math.abs(distance(hitPos, { x: shape.cx, y: shape.cy }) - shape.r) < tolerance) return shape.id; break;
                case 'text': {
                    const { x, y, content, fontSize } = shape;
                    if ( hitPos.x >= x && hitPos.x <= x + content.length * fontSize * 0.6 && hitPos.y >= y && hitPos.y <= y + fontSize ) return shape.id;
                    break;
                }
                case 'symbol': {
                    const { x, y, size } = shape;
                    const hs = size / 2;
                    if ( hitPos.x >= x - hs && hitPos.x <= x + hs && hitPos.y >= y - hs && hitPos.y <= y + hs ) return shape.id;
                    break;
                }
            }
        }
        return null;
    }
    
    // ... Event Handlers ...
    const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { }
        isInteractingRef.current = true;
        hasHandledUpRef.current = false;
        setActiveSnapPoint(null);

        const rect = e.currentTarget.getBoundingClientRect();
        const localMousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const startPos = screenToWorld(localMousePos);
        const snapPos = activeSnapPoint ? activeSnapPoint.point : startPos;

        setDragStartScreenPos(localMousePos); 

        if (activeTool === 'pan' || e.button === 1) {
            setPanStart({ x: localMousePos.x - viewTransform.x, y: localMousePos.y - viewTransform.y });
            return;
        }

        // --- Move Tool Specific Click Logic ---
        if (activeTool === 'move') {
            if (selectedShapeIds.size > 0) {
                if (!moveBasePoint) { 
                    setMoveBasePoint(snapPos); 
                } else {
                    // Second click of Click-Click move -> Commit immediately
                    const delta = subtract(snapPos, moveBasePoint);
                    const batchUpdates: { id: string, updates: AnyShapePropertyUpdates }[] = [];
                    
                    Array.from(selectedShapeIds).forEach(id => {
                        const shape = shapes.find(s => s.id === id); if (!shape) return;
                        const updates: AnyShapePropertyUpdates = {};
                        if (shape.type === 'line' || shape.type === 'dimension') { updates.p1 = add(shape.p1, delta); updates.p2 = add(shape.p2, delta); if (shape.type === 'dimension') updates.offsetPoint = add(shape.offsetPoint, delta); } 
                        else if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'symbol' || shape.type === 'title_block') { updates.x = shape.x + delta.x; updates.y = shape.y + delta.y; } 
                        else if (shape.type === 'circle') { updates.cx = shape.cx + delta.x; updates.cy = shape.cy + delta.y; }
                        batchUpdates.push({ id, updates });
                    });
                    
                    if (batchUpdates.length > 0) updateShapes(batchUpdates);
                    setMoveBasePoint(null); 
                }
            }
            return;
        }

        if (activeTool === 'select') {
            const tolerance = 5 / viewTransform.scale;
            
            // Multi-Selection Rotation Handle Check
            if (selectedShapeIds.size > 1 && multiSelectionBounds) {
                const bounds = multiSelectionBounds;
                const topCenter = { x: bounds.x + bounds.width / 2, y: bounds.y };
                const handlePos = { x: topCenter.x, y: topCenter.y - 30 / viewTransform.scale };
                const handleTolerance = 10 / viewTransform.scale;

                if (distance(startPos, handlePos) < handleTolerance) {
                    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                    const groupOriginals: Record<string, AnyShape> = {};
                    selectedShapeIds.forEach(id => { const s = shapes.find(x => x.id === id); if (s) groupOriginals[id] = JSON.parse(JSON.stringify(s)); });

                    setDraggingHandle({ shapeId: 'group-rotator', handleIndex: 'rotate', originalShape: {} as any });
                    setRotateState({
                        startAngle: angle(subtract(startPos, center)),
                        center,
                        groupOriginals
                    });
                    return;
                }
            }

            // Check rotation handles first if single selection
            if (selectedShapeId && selectedShapeIds.size === 1 && !e.shiftKey) {
                const selectedShape = shapes.find(s => s.id === selectedShapeId);
                if (selectedShape) {
                    const rotHandle = getRotationHandlePos(selectedShape);
                    const handleTolerance = 10 / viewTransform.scale;
                    if (rotHandle && distance(rotHandle.handle, startPos) < handleTolerance) {
                        let center = rotHandle.center;
                        setDraggingHandle({ shapeId: selectedShapeId, handleIndex: 'rotate', originalShape: JSON.parse(JSON.stringify(selectedShape)) as AnyShape });
                        setRotateState({ 
                            startAngle: angle(subtract(startPos, center)), 
                            center, 
                            groupOriginals: { [selectedShapeId]: JSON.parse(JSON.stringify(selectedShape)) as AnyShape }
                        });
                        return;
                    }
                    const snapPoints = getShapeSnapPoints(selectedShape);
                    const clickedHandleIndex = snapPoints.findIndex(sp => distance(sp.point, startPos) < handleTolerance);
                    if (clickedHandleIndex !== -1) {
                        setDraggingHandle({ shapeId: selectedShapeId, handleIndex: clickedHandleIndex, originalShape: JSON.parse(JSON.stringify(selectedShape)) as AnyShape });
                        return;
                    }
                }
            }
            
            // Selection Logic (Click to Select / Shift+Click)
            const hitId = getHitTest(startPos, tolerance);
            
            if (hitId) {
                let newSelectedIds = new Set(selectedShapeIds);
                
                if (e.shiftKey) {
                    toggleShapeSelection(hitId);
                    if (selectedShapeIds.has(hitId)) newSelectedIds.delete(hitId); else newSelectedIds.add(hitId);
                } else {
                    if (!selectedShapeIds.has(hitId)) {
                        setSelectedShapeIds(new Set([hitId]));
                        newSelectedIds = new Set([hitId]);
                    }
                }

                if (newSelectedIds.has(hitId)) {
                    // Prepare for Drag Move (Group or Single)
                    // CRITICAL: Ensure ALL items in selection are added to groupOriginals
                    const groupOriginals: Record<string, AnyShape> = {};
                    newSelectedIds.forEach(id => { 
                        const s = shapes.find(x => x.id === id); 
                        if(s) groupOriginals[id] = JSON.parse(JSON.stringify(s)) as AnyShape; 
                    });
                    
                    const originalShape = shapes.find(s=>s.id===hitId)!;
                    
                    setDraggingHandle({ 
                        shapeId: hitId, 
                        handleIndex: 'move', 
                        originalShape: originalShape, 
                        groupOriginals 
                    });
                    setDragStartPos(startPos);
                }
            } else {
                // Clicked on empty space...
                // Check if inside Multi-Selection Box -> Trigger Move for Group
                if (selectedShapeIds.size > 1 && multiSelectionBounds) {
                     const isInside = startPos.x >= multiSelectionBounds.x && startPos.x <= multiSelectionBounds.x + multiSelectionBounds.width &&
                                      startPos.y >= multiSelectionBounds.y && startPos.y <= multiSelectionBounds.y + multiSelectionBounds.height;
                     if (isInside && !e.shiftKey) {
                          // Move the whole group
                          const groupOriginals: Record<string, AnyShape> = {};
                          selectedShapeIds.forEach(id => { const s = shapes.find(x => x.id === id); if(s) groupOriginals[id] = JSON.parse(JSON.stringify(s)) as AnyShape; });
                          // Use bounds ID as dummy
                          setDraggingHandle({ 
                                shapeId: 'bounds', 
                                handleIndex: 'move', 
                                originalShape: {} as any, 
                                groupOriginals 
                          });
                          setDragStartPos(startPos);
                          return;
                     }
                }

                // Otherwise, Start Selection Box
                if (!e.shiftKey) {
                    setSelectedShapeIds(new Set());
                }
            }
            return; 
        }

        if (activeTool === 'trim' && hoveredTrimSegment) {
             const { shapeId, geometry } = hoveredTrimSegment;
             const originalShape = shapes.find(s => s.id === shapeId);
             
             if (originalShape && originalShape.type === 'line' && geometry.type === 'line') {
                  const tMin = geometry.tMin;
                  const tMax = geometry.tMax;
                  const shapesToAdd: Omit<Line, 'id'>[] = [];
                  const vec = subtract(originalShape.p2, originalShape.p1);
                  if (tMin > 0.001) { shapesToAdd.push({ ...originalShape, p1: originalShape.p1, p2: add(originalShape.p1, scale(vec, tMin)) }); }
                  if (tMax < 0.999) { shapesToAdd.push({ ...originalShape, p1: add(originalShape.p1, scale(vec, tMax)), p2: originalShape.p2 }); }
                  replaceShapes([shapeId], shapesToAdd);
                  setHoveredTrimSegment(null);
             } else if (originalShape && originalShape.type === 'rectangle' && geometry.type === 'line') {
                  // Explode rectangle into lines, keeping 3 lines and trimming the 4th
                  const { x, y, width, height } = originalShape;
                  const corners = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
                  const center = { x: x + width/2, y: y + height/2 };
                  const rot = originalShape.rotation || 0;
                  const rc = corners.map(p => rotatePoint(p, center, rot));
                  
                  const shapesToAdd: Omit<Line, 'id'>[] = [];
                  
                  for(let i=0; i<4; i++) {
                       const p1 = rc[i];
                       const p2 = rc[(i+1)%4];
                       
                       // Approximate match (geometry p1/p2 are same as side p1/p2)
                       if (geometry.sideIndex !== undefined && i === geometry.sideIndex) {
                            // This is the trimmed side. Add split lines.
                            const vec = subtract(p2, p1);
                            const tMin = geometry.tMin;
                            const tMax = geometry.tMax;
                            // Validate lengths to avoid micro segments
                            const sideLen = distance(p1, p2);
                            if (tMin > 0.001 && (tMin * sideLen) > 0.001) { shapesToAdd.push({ type: 'line', p1: p1, p2: add(p1, scale(vec, tMin)), properties: originalShape.properties } as Omit<Line, 'id'>); }
                            if (tMax < 0.999 && ((1 - tMax) * sideLen) > 0.001) { shapesToAdd.push({ type: 'line', p1: add(p1, scale(vec, tMax)), p2: p2, properties: originalShape.properties } as Omit<Line, 'id'>); }
                       } else {
                            // Keep side as is
                            shapesToAdd.push({ type: 'line', p1: p1, p2: p2, properties: originalShape.properties } as Omit<Line, 'id'>);
                       }
                  }
                  replaceShapes([shapeId], shapesToAdd);
                  setHoveredTrimSegment(null);

             } else if (originalShape && originalShape.type === 'circle' && geometry.type === 'arc') {
                  const shapesToAdd: Omit<Circle, 'id'>[] = [];
                  
                  // Original interval (0-360 or Start-End)
                  const origStart = (originalShape.startAngle !== undefined) ? originalShape.startAngle : 0;
                  const origEnd = (originalShape.endAngle !== undefined) ? originalShape.endAngle : 360;

                  // Cut interval
                  const cutStart = geometry.startAngle;
                  const cutEnd = geometry.endAngle;
                  
                  // We need to keep [origStart, cutStart] and [cutEnd, origEnd]
                  const diff1 = (cutStart - origStart + 360) % 360;
                  if (diff1 > 0.1) {
                       shapesToAdd.push({ ...originalShape, startAngle: origStart, endAngle: cutStart });
                  }
                  
                  const diff2 = (origEnd - cutEnd + 360) % 360;
                  if (diff2 > 0.1) {
                       shapesToAdd.push({ ...originalShape, startAngle: cutEnd, endAngle: origEnd });
                  }
                  
                  replaceShapes([shapeId], shapesToAdd);
                  setHoveredTrimSegment(null);
             }
             else if (originalShape) {
                  deleteShape(shapeId); setHoveredTrimSegment(null);
             }
             return;
        }

        if (activeTool === 'arc') {
             if (arcStep === 0) { setArcPoints([snapPos]); setArcStep(1); setCurrentShape(null); } 
             else if (arcStep === 1) { setArcPoints(prev => [...prev, snapPos]); setArcStep(2); } 
             else if (arcStep === 2) {
                const [p1, p2] = arcPoints; const p3 = snapPos;
                const circleData = getCircleFromThreePoints(p1, p2, p3);
                if (circleData && circleData.r < MAX_SAFE_RADIUS) {
                    const { cx, cy, r } = circleData;
                    const { startAngle, endAngle } = getArcAngles(p1, p2, p3, {x: cx, y: cy});
                    addShape({ type: 'circle', cx, cy, r, startAngle, endAngle, properties: drawingProperties } as Omit<Circle, 'id'>);
                } else {
                    addShape({ type: 'line', p1: p1, p2: p3, properties: drawingProperties } as Omit<Line, 'id'>);
                }
                setArcStep(0); setArcPoints([]); setCurrentShape(null); setActiveTool('select'); isInteractingRef.current = false;
            }
            return;
        }
        
        if (activeTool === 'rotate') {
             // Try to hit a shape, but if nothing hit and we have selection, use selection as target
             const hitId = getHitTest(startPos, 5 / viewTransform.scale);
             let targetIds = new Set<string>();
             
             if (hitId && selectedShapeIds.has(hitId)) {
                  targetIds = selectedShapeIds; // Clicked on one of the selected items
             } else if (hitId) {
                  targetIds = new Set([hitId]); // Clicked on unselected item
             } else if (selectedShapeIds.size > 0) {
                  targetIds = selectedShapeIds; // Clicked on empty space but have selection
             }

             if (targetIds.size > 0) {
                 if(hitId && !selectedShapeIds.has(hitId)) setSelectedShapeIds(new Set([hitId]));
                 
                 const shapesToRotate = Array.from(targetIds).map(id => shapes.find(s => s.id === id)).filter(Boolean) as AnyShape[];
                 
                 if (shapesToRotate.length > 0) {
                      let center = { x: 0, y: 0 };
                      
                      if (shapesToRotate.length === 1) {
                           const shape = shapesToRotate[0];
                           if (shape.type === 'rectangle' || shape.type === 'title_block') center = { x: shape.x + shape.width/2, y: shape.y + shape.height/2 };
                           else if (shape.type === 'symbol' || shape.type === 'text') center = { x: shape.x, y: shape.y };
                           else if (shape.type === 'line' || shape.type === 'dimension') center = { x: (shape.p1.x + shape.p2.x)/2, y: (shape.p1.y + shape.p2.y)/2 };
                           else if (shape.type === 'circle') center = { x: shape.cx, y: shape.cy };
                      } else {
                           // Group rotation center
                           const bounds = calculateSelectionBounds(shapesToRotate);
                           if (bounds) {
                                center = { x: bounds.x + bounds.width/2, y: bounds.y + bounds.height/2 };
                           }
                      }
                      
                      const groupOriginals: Record<string, AnyShape> = {};
                      shapesToRotate.forEach(s => groupOriginals[s.id] = JSON.parse(JSON.stringify(s)) as AnyShape);

                      setRotateState({ 
                          startAngle: angle(subtract(startPos, center)), 
                          center, 
                          groupOriginals 
                      });
                 }
             }
             return;
        }

        if (activeTool === 'extend' && hoveredExtendPreview) {
            const { originalShape, newEndpoint, endToUpdate } = hoveredExtendPreview;
            const updates: AnyShapePropertyUpdates = {};
            if (endToUpdate === 'p1') updates.p1 = newEndpoint; else updates.p2 = newEndpoint;
            updateShape(originalShape.id, updates);
            setHoveredExtendPreview(null);
            return;
        }
        
        if (activeTool === 'paste' && clipboard) {
             const { shapes: clipboardShapes, origin: clipboardOrigin } = clipboard;
             const translation = subtract(worldMousePos, clipboardOrigin);
             const shapesToPaste = clipboardShapes.map(shape => {
                 const newShape = JSON.parse(JSON.stringify(shape)) as AnyShape; delete newShape.id;
                 if (newShape.type === 'line' || newShape.type === 'dimension') { newShape.p1 = add(newShape.p1, translation); newShape.p2 = add(newShape.p2, translation); if(newShape.type === 'dimension') newShape.offsetPoint = add(newShape.offsetPoint, translation); } 
                 else if (newShape.type === 'rectangle' || newShape.type === 'text' || newShape.type === 'symbol' || newShape.type === 'title_block') { newShape.x += translation.x; newShape.y += translation.y; } 
                 else if (newShape.type === 'circle') { newShape.cx += translation.x; newShape.cy += translation.y; }
                 return newShape;
             });
             addShapes(shapesToPaste); setActiveTool('select');
             return;
        }
        
        if (activeTool === 'copy-area') { setSelectionRect({ type: 'rectangle', id: 'selection', x: startPos.x, y: startPos.y, width: 0, height: 0, properties: { color: '', fill: '', strokeWidth: 0, lineType: 'solid' }}); return; }
        
        if (activeTool === 'dimension') {
             if(hoveredDimensionTarget) {
                  const isRadial = hoveredDimensionTarget.type === 'circle';
                  setCurrentShape({ type: 'dimension', subType: isRadial ? 'radial' : 'linear', p1: hoveredDimensionTarget.p1, p2: hoveredDimensionTarget.p2, offsetPoint: snapPos, properties: drawingProperties, fontSize: 4, extensionLineOffset: 2, extensionLineOvershoot: 2, textOverride: null });
                  setDimensionStep(2); setHoveredDimensionTarget(null);
             } else if (dimensionStep === 0) {
                  setCurrentShape({ type: 'dimension', subType: 'linear', p1: snapPos, p2: snapPos, offsetPoint: snapPos, properties: drawingProperties, fontSize: 4, extensionLineOffset: 2, extensionLineOvershoot: 2, textOverride: null });
                  setDimensionStep(1);
             } else if (dimensionStep === 1 && currentShape?.type === 'dimension') {
                  setCurrentShape({ ...currentShape, p2: snapPos }); setDimensionStep(2);
             } else if (dimensionStep === 2 && currentShape?.type === 'dimension') {
                  addShape(currentShape as Omit<Dimension, 'id'>); setCurrentShape(null); setDimensionStep(0); isInteractingRef.current = false; setActiveTool('select');
             }
             return;
        }
        
        if (activeTool === 'text') { addShape({ type: 'text', x: snapPos.x, y: snapPos.y, content: 'Texto', fontSize: 12, properties: drawingProperties, rotation: 0 } as Omit<Text, 'id'>); isInteractingRef.current = false; setActiveTool('select'); return; }
        
        if (activeTool === 'title_block') {
            addShape({
                type: 'title_block', x: snapPos.x, y: snapPos.y, width: 200, height: 35, properties: drawingProperties,
                data: { company: 'NOMBRE DE LA EMPRESA', project: 'PROYECTO EJECUTIVO', title: 'PLANTA ARQUITECTÓNICA', sheet: 'A-101', revision: '00', scale: '1:100', drawnBy: 'ARQ.', checkedBy: 'ING.', date: new Date().toLocaleDateString('es-MX') },
                fontScale: 1.0, letterSpacing: 0, lineSpacing: 1.0
            } as Omit<TitleBlock, 'id'>);
            isInteractingRef.current = false; setActiveTool('select'); return;
        }
        
        if (activeTool.startsWith('icon_') || activeTool === 'arrow_symbol' || activeTool === 'warning_symbol') {
             let symbolName: SymbolShape['name'] = 'arrow';
             if (activeTool.startsWith('icon_')) symbolName = activeTool.replace('icon_', '') as any; else if (activeTool === 'warning_symbol') symbolName = 'warning';
             addShape({ type: 'symbol', name: symbolName, x: snapPos.x, y: snapPos.y, size: 24, rotation: 0, properties: drawingProperties } as Omit<SymbolShape, 'id'>);
             isInteractingRef.current = false; setActiveTool('select'); return;
        }
        
        const baseShape = { properties: drawingProperties };
        if (activeTool === 'line') setCurrentShape({ ...baseShape, type: 'line', p1: snapPos, p2: snapPos });
        else if (activeTool === 'rectangle') setCurrentShape({ ...baseShape, type: 'rectangle', x: snapPos.x, y: snapPos.y, width: 0, height: 0, rotation: 0 });
        else if (activeTool === 'circle') setCurrentShape({ ...baseShape, type: 'circle', cx: snapPos.x, cy: snapPos.y, r: 0 });
    };
    
    const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const localMousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setMousePosition(localMousePos);
        
        if (panStart) {
            setViewTransform({ ...viewTransform, x: localMousePos.x - panStart.x, y: localMousePos.y - panStart.y });
            return;
        }
        
        const worldPos = screenToWorld(localMousePos);
        if (!Number.isFinite(worldPos.x) || !Number.isFinite(worldPos.y)) return;

        let finalPos = { ...worldPos };
        let currentHoveredId: string | null = null;
        let currentSnapPoint: { point: Point; type: SnapMode; } | null = null;
        let currentInferenceLines: Line[] = [];

        // Logic for Select Tool Dragging (Box Selection)
        if (activeTool === 'select' && dragStartScreenPos && !draggingHandle && !rotateState) {
            const screenDist = distance(dragStartScreenPos, localMousePos);
            if (screenDist > DRAG_THRESHOLD || selectionRect) {
                const startWorld = screenToWorld(dragStartScreenPos);
                
                // If we are already dragging a box, update it
                if (selectionRect) {
                     setSelectionRect({ ...selectionRect, width: worldPos.x - selectionRect.x, height: worldPos.y - selectionRect.y });
                } else {
                    // Check if we dragged on empty space to start selection box
                    // Also check if we are NOT inside a multi-selection box (if moving group)
                    let isMovingGroup = false;
                    if (selectedShapeIds.size > 1 && multiSelectionBounds) {
                         const isInside = startWorld.x >= multiSelectionBounds.x && startWorld.x <= multiSelectionBounds.x + multiSelectionBounds.width &&
                                          startWorld.y >= multiSelectionBounds.y && startWorld.y <= multiSelectionBounds.y + multiSelectionBounds.height;
                         if(isInside) isMovingGroup = true;
                    }
                    
                    const hitId = getHitTest(startWorld, 5 / viewTransform.scale);
                    if (!hitId && !isMovingGroup) {
                         setSelectionRect({ type: 'rectangle', id: 'selection', x: startWorld.x, y: startWorld.y, width: 0, height: 0, properties: { color: '', fill: '', strokeWidth: 0, lineType: 'solid' }});
                    }
                }
            }
        }

        // ... Trim and Extend logic (preserved) ...
        if (activeTool === 'trim') {
             const tolerance = 10 / viewTransform.scale;
             const hitId = getHitTest(worldPos, tolerance);
             if(hitId) {
                  const targetShape = shapes.find(s => s.id === hitId);
                  if (targetShape) {
                       const seg = calculateTrimSegments(targetShape, worldPos);
                       if (seg) setHoveredTrimSegment({ shapeId: hitId, geometry: seg });
                       else setHoveredTrimSegment(null);
                  }
             } else { setHoveredTrimSegment(null); }
        }
        if (activeTool === 'extend') {
            const tolerance = 10 / viewTransform.scale;
            const hitId = getHitTest(worldPos, tolerance);
            let extendCandidate = null;
            if (hitId) {
                const targetShape = shapes.find(s => s.id === hitId);
                if (targetShape && targetShape.type === 'line') {
                    const d1 = distance(worldPos, targetShape.p1); const d2 = distance(worldPos, targetShape.p2);
                    const endToUpdate = d1 < d2 ? 'p1' : 'p2';
                    const startPoint = endToUpdate === 'p2' ? targetShape.p1 : targetShape.p2; 
                    const rayOrigin = endToUpdate === 'p2' ? targetShape.p2 : targetShape.p1;
                    const rawDir = subtract(rayOrigin, startPoint); const rayDir = normalize(rawDir);
                    let closestInt: Point | null = null; let minD = Infinity;

                    shapes.forEach(s => {
                        if (s.id === targetShape.id) return;
                        let intersections: Point[] = [];
                        if (s.type === 'line') { const i = getRaySegmentIntersection(rayOrigin, rayDir, s.p1, s.p2); if (i) intersections.push(i); } 
                        else if (s.type === 'rectangle' || s.type === 'title_block') {
                            const { x, y, width, height } = s; const corners = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
                            const center = { x: x + width/2, y: y + height/2 }; const rot = 'rotation' in s ? (s.rotation || 0) : 0;
                            const rotatedCorners = corners.map(p => rotatePoint(p, center, rot));
                            for(let k=0; k<4; k++) { const i = getRaySegmentIntersection(rayOrigin, rayDir, rotatedCorners[k], rotatedCorners[(k+1)%4]); if(i) intersections.push(i); }
                        }
                        else if (s.type === 'circle') { const i = getRayCircleIntersection(rayOrigin, rayDir, s); if (i) intersections.push(i); }
                        intersections.forEach(p => { const d = distance(rayOrigin, p); if (d > 0.01 && d < minD) { minD = d; closestInt = p; } });
                    });
                    if (closestInt) extendCandidate = { originalShape: targetShape, newEndpoint: closestInt, endToUpdate };
                }
            }
            setHoveredExtendPreview(extendCandidate);
        }

        const isRotating = activeTool === 'rotate' || draggingHandle?.handleIndex === 'rotate';

        if (isInteractingRef.current || activeTool === 'move' || activeTool === 'rotate' || activeTool === 'trim' || activeTool === 'extend' || ['line', 'rectangle', 'circle', 'dimension', 'text', 'arc', 'title_block'].includes(activeTool) || draggingHandle) {
            
            // Disable snapping when rotating to prevent erratic jumping
            if (!isRotating) {
                const snapThreshold = 10 / viewTransform.scale;
                const inferenceThreshold = 20 / viewTransform.scale; 

                const hitId = getHitTest(worldPos, snapThreshold);
                const ignoreId = draggingHandle?.shapeId || selectedShapeId;
                if (hitId && hitId !== ignoreId) {
                    currentHoveredId = hitId;
                    const hoveredShape = shapes.find(s => s.id === hitId);
                    if (hoveredShape) {
                        const snapPoints = getShapeSnapPoints(hoveredShape);
                        let closestDist = Infinity;
                        for (const sp of snapPoints) {
                            if (snapModes.has(sp.type)) {
                                const d = distance(worldPos, sp.point);
                                if (d < snapThreshold && d < closestDist) { closestDist = d; currentSnapPoint = { point: sp.point, type: sp.type }; }
                            }
                        }
                    }
                }
                 if (snapModes.has('inference')) {
                    const pointsToCheck = ignoreId ? allSnapPoints.filter(sp => sp.shapeId !== ignoreId) : allSnapPoints;
                    const SCREEN_PROXIMITY_LIMIT = 250; 
                    const worldProximityLimit = SCREEN_PROXIMITY_LIMIT / viewTransform.scale;
                    let bestXSnap: Point | null = null; let bestYSnap: Point | null = null; let minXDist = Infinity; let minYDist = Infinity;
                    for (const sp of pointsToCheck) {
                        const dist = distance(worldPos, sp.point);
                        if (dist > worldProximityLimit) continue;
                        if (Math.abs(worldPos.x - sp.point.x) < inferenceThreshold) { if (dist < minXDist) { minXDist = dist; bestXSnap = sp.point; } }
                        if (Math.abs(worldPos.y - sp.point.y) < inferenceThreshold) { if (dist < minYDist) { minYDist = dist; bestYSnap = sp.point; } }
                    }
                    if (bestXSnap) { currentInferenceLines.push({id: 'inf-x', type: 'line', p1: bestXSnap, p2: {x: bestXSnap.x, y: worldPos.y}, properties: drawingProperties} as Line); finalPos.x = bestXSnap.x; }
                    if (bestYSnap) { currentInferenceLines.push({id: 'inf-y', type: 'line', p1: bestYSnap, p2: {x: worldPos.x, y: bestYSnap.y}, properties: drawingProperties} as Line); finalPos.y = bestYSnap.y; }
                    if (bestXSnap && bestYSnap) {
                         currentInferenceLines = [ {id: 'inf-x', type: 'line', p1: bestXSnap, p2: {x: bestXSnap.x, y: bestYSnap.y}, properties: drawingProperties} as Line, {id: 'inf-y', type: 'line', p1: bestYSnap, p2: {x: bestXSnap.x, y: bestYSnap.y}, properties: drawingProperties} as Line ];
                         finalPos = { x: bestXSnap.x, y: bestYSnap.y };
                    }
                }
                if (currentSnapPoint) { finalPos = currentSnapPoint.point; currentInferenceLines = []; }
            }
        }
        
        setHoveredShapeId(currentHoveredId); setActiveSnapPoint(currentSnapPoint); setInferenceLines(currentInferenceLines);

        if (activeTool === 'arc') {
            if (arcStep === 1) {
                setCurrentShape({ type: 'line', p1: arcPoints[0], p2: finalPos, properties: { ...drawingProperties, color: '#00A8FF', lineType: 'dashed' } });
            } else if (arcStep === 2) {
                const p1 = arcPoints[0]; const p2 = arcPoints[1]; const p3 = finalPos;
                const circleData = getCircleFromThreePoints(p1, p2, p3);
                if (circleData && circleData.r < MAX_SAFE_RADIUS) {
                    const { cx, cy, r } = circleData; const { startAngle, endAngle } = getArcAngles(p1, p2, p3, {x: cx, y: cy});
                    setCurrentShape({ type: 'circle', cx, cy, r, startAngle, endAngle, properties: drawingProperties });
                } else { setCurrentShape({ type: 'line', p1: p1, p2: p3, properties: drawingProperties }); }
            }
        }

        if (draggingHandle) {
             const { shapeId, handleIndex, originalShape } = draggingHandle;
            if (handleIndex === 'rotate') return;
            // Removed early return for 'move' to allow snap calculation above to persist
            if (handleIndex === 'move') return;
            
            if (typeof handleIndex !== 'number') return;
            
            const previewShape = JSON.parse(JSON.stringify(originalShape)) as AnyShape;
            let updates: AnyShapePropertyUpdates = {};
            if (previewShape.type === 'line') { if (handleIndex === 0) updates.p1 = finalPos; else if (handleIndex === 1) updates.p2 = finalPos; } 
            else if (previewShape.type === 'circle') { if (handleIndex === 0) { updates.cx = finalPos.x; updates.cy = finalPos.y; } else if (handleIndex > 0) { updates.r = distance({x: previewShape.cx, y: previewShape.cy}, finalPos); } } 
            else if (previewShape.type === 'dimension') { if (handleIndex === 0) updates.p1 = finalPos; else if (handleIndex === 1) updates.p2 = finalPos; else if (handleIndex === 3) updates.offsetPoint = finalPos; } 
            else if (previewShape.type === 'rectangle' || previewShape.type === 'title_block') {
                const orig = originalShape as Rectangle; 
                if (handleIndex === 8) { updates.x = finalPos.x - orig.width / 2; updates.y = finalPos.y - orig.height / 2; } 
                else {
                     const origCorners = [ { x: orig.x, y: orig.y }, { x: orig.x + orig.width, y: orig.y }, { x: orig.x + orig.width, y: orig.y + orig.height }, { x: orig.x, y: orig.y + orig.height } ];
                     const oppositeIndex = (handleIndex + 2) % 4;
                     if (handleIndex >= 0 && handleIndex <= 3) {
                          const fixedPoint = origCorners[oppositeIndex];
                          const newX = Math.min(fixedPoint.x, finalPos.x); const newY = Math.min(fixedPoint.y, finalPos.y);
                          const newW = Math.abs(fixedPoint.x - finalPos.x); const newH = Math.abs(fixedPoint.y - finalPos.y);
                          updates = { x: newX, y: newY, width: newW, height: newH };
                     }
                }
            } else if (previewShape.type === 'symbol') {
                if (handleIndex === 0) { updates.x = finalPos.x; updates.y = finalPos.y; } 
                else { const center = { x: (originalShape as SymbolShape).x, y: (originalShape as SymbolShape).y }; const dist = distance(center, finalPos); const newSize = dist * Math.sqrt(2); if (Number.isFinite(newSize) && newSize > 0) updates.size = Math.max(5, newSize); }
            }
            if (Object.keys(updates).length > 0) { Object.assign(previewShape, updates); setDraggingHandle(prev => prev ? ({ ...prev, currentPreview: previewShape }) : null); }
            return;
        }

        if (isInteractingRef.current) {
            if (activeTool === 'copy-area' && selectionRect) { setSelectionRect({ ...selectionRect, width: worldPos.x - selectionRect.x, height: worldPos.y - selectionRect.y }); } 
            else if (currentShape) {
                 if(currentShape.type === 'line') { const constrained = applyConstraints(currentShape.p1!, finalPos, e.shiftKey); setCurrentShape({ ...currentShape, p2: constrained }); }
                 else if (currentShape.type === 'rectangle') { const start = {x: currentShape.x!, y: currentShape.y!}; let w = finalPos.x - start.x; let h = finalPos.y - start.y; if(e.shiftKey) { const max = Math.max(Math.abs(w), Math.abs(h)); w = w<0?-max:max; h = h<0?-max:max; } setCurrentShape({ ...currentShape, width: w, height: h }); } 
                 else if (currentShape.type === 'circle' && activeTool === 'circle') { setCurrentShape({ ...currentShape, r: distance({x: currentShape.cx!, y: currentShape.cy!}, finalPos) }); }
            }
        }
    };

    const isShapeInBounds = (shape: AnyShape, bounds: Rectangle): boolean => {
        const isPointInBounds = (p: Point) => p.x >= bounds.x && p.x <= bounds.x + bounds.width && p.y >= bounds.y && p.y <= bounds.y + bounds.height;
        switch (shape.type) {
            case 'line': return isPointInBounds(shape.p1) && isPointInBounds(shape.p2);
            case 'rectangle':
            case 'title_block': { const corners = [ { x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y }, { x: shape.x, y: shape.y + shape.height }, { x: shape.x + shape.width, y: shape.y + shape.height }, ]; return corners.every(isPointInBounds); }
            case 'circle': { return isPointInBounds({x: shape.cx, y: shape.cy}); }
            case 'dimension': return isPointInBounds(shape.p1) && isPointInBounds(shape.p2);
            case 'text': return isPointInBounds({x: shape.x, y: shape.y});
            case 'symbol': return isPointInBounds({x: shape.x, y: shape.y});
            default: return false;
        }
    };
    
    // ... PointerUp & Wheel (preserved) ...
    const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement> | PointerEvent) => {
        if (hasHandledUpRef.current) return;
        hasHandledUpRef.current = true;

        // Safe release of capture
        if (svgRef.current && svgRef.current.hasPointerCapture && (e as any).pointerId) {
             try { svgRef.current.releasePointerCapture((e as any).pointerId); } catch(err){}
        }

        // Use svgRef instead of currentTarget to ensure we have the element even on global window events
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        
        // Handle coordinates safely
        const clientX = (e as any).clientX;
        const clientY = (e as any).clientY;
        const localMousePos = { x: clientX - rect.left, y: clientY - rect.top };
        
        if (draggingHandle?.handleIndex === 'move' && dragStartPos) {
            let finalPos = screenToWorld(localMousePos);
            // Re-check snap on release to be sure
            if (activeSnapPoint) finalPos = activeSnapPoint.point;
            
            const delta = subtract(finalPos, dragStartPos);
            // Commit only if significant move occurred (prevent accidental micro-shifts) and coordinates are safe
            if (magnitude(delta) > 0.1 && Number.isFinite(delta.x) && Number.isFinite(delta.y)) {
                const { groupOriginals, shapeId, originalShape } = draggingHandle;
                
                // CRITICAL FIX: Use batch updates instead of looping updateShape
                // iterating updateShape causes race conditions with state
                const batchUpdates: { id: string, updates: AnyShapePropertyUpdates }[] = [];
                
                // Safely iterate group items
                const itemsToMove: [string, AnyShape][] = groupOriginals ? Object.entries(groupOriginals) : [[shapeId, originalShape]];
                
                itemsToMove.forEach(([id, origShape]) => {
                     // Ensure origShape is valid before update
                     if (!origShape) return;
                     const s = origShape as AnyShape; 
                     const updates: AnyShapePropertyUpdates = {};
                     
                     if (s.type === 'line' || s.type === 'dimension') { 
                         updates.p1 = add(s.p1, delta); 
                         updates.p2 = add(s.p2, delta); 
                         if(s.type === 'dimension') updates.offsetPoint = add(s.offsetPoint, delta); 
                     } 
                     else if (s.type === 'rectangle' || s.type === 'text' || s.type === 'symbol' || s.type === 'title_block') { 
                         updates.x = s.x + delta.x; 
                         updates.y = s.y + delta.y; 
                     } 
                     else if (s.type === 'circle') { 
                         updates.cx = s.cx + delta.x; 
                         updates.cy = s.cy + delta.y; 
                     }
                     
                     batchUpdates.push({ id, updates });
                });
                
                if (batchUpdates.length > 0) {
                    updateShapes(batchUpdates);
                }
            }
        }
        if (draggingHandle?.currentPreview && typeof draggingHandle.handleIndex === 'number') {
             const { currentPreview, shapeId } = draggingHandle; const updates: AnyShapePropertyUpdates = {};
             if(currentPreview.type === 'line' || currentPreview.type === 'dimension') { updates.p1 = currentPreview.p1; updates.p2 = currentPreview.p2; if(currentPreview.type === 'dimension') updates.offsetPoint = currentPreview.offsetPoint; } 
             else if (currentPreview.type === 'rectangle' || currentPreview.type === 'title_block' || currentPreview.type === 'symbol' || currentPreview.type === 'text') { updates.x = currentPreview.x; updates.y = currentPreview.y; if('width' in currentPreview) { updates.width = currentPreview.width; updates.height = currentPreview.height; } if('size' in currentPreview) updates.size = currentPreview.size; } 
             else if (currentPreview.type === 'circle') { updates.cx = currentPreview.cx; updates.cy = currentPreview.cy; updates.r = currentPreview.r; }
             updateShape(shapeId, updates);
        }

        // Logic for Selection Box completion
        const worldPos = screenToWorld(localMousePos);
        if ((activeTool === 'select' || activeTool === 'copy-area') && selectionRect) {
             const normalizedRect = { x: selectionRect.width < 0 ? selectionRect.x + selectionRect.width : selectionRect.x, y: selectionRect.height < 0 ? selectionRect.y + selectionRect.height : selectionRect.y, width: Math.abs(selectionRect.width), height: Math.abs(selectionRect.height) };
            if (normalizedRect.width > 1 && normalizedRect.height > 1) {
                const shapesToProcess = shapes.filter(s => isShapeInBounds(s, normalizedRect as Rectangle));
                if (shapesToProcess.length > 0) { 
                    if (activeTool === 'copy-area') { 
                        setClipboard({ shapes: shapesToProcess, origin: { x: normalizedRect.x + normalizedRect.width / 2, y: normalizedRect.y + normalizedRect.height / 2 } }); 
                        // Optional: temporarily highlight
                        setSelectedShapeIds(new Set(shapesToProcess.map(s => s.id)));
                    } else { 
                        // Multi-Select Box
                        const newSelection = new Set(e.shiftKey ? selectedShapeIds : []);
                        shapesToProcess.forEach(s => newSelection.add(s.id));
                        setSelectedShapeIds(newSelection);
                    } 
                } else if (!e.shiftKey && activeTool === 'select') {
                    // Clicked empty space with box logic but found nothing
                     setSelectedShapeIds(new Set());
                }
            } else if (activeTool === 'select' && !dragStartScreenPos && !e.shiftKey) { 
                 // Simple click on nothing
                 setSelectedShapeIds(new Set()); 
            }
            setSelectionRect(null); if (activeTool === 'copy-area') setActiveTool('select');
        }

        if (activeTool === 'move' && moveBasePoint) {
            // Apply Move Tool logic (only if significantly moved)
            // If delta is 0, user just clicked base point, so DO NOT clear moveBasePoint yet.
            const targetPoint = activeSnapPoint ? activeSnapPoint.point : worldPos;
            const delta = subtract(targetPoint, moveBasePoint);
            if (magnitude(delta) > 0.1 && Number.isFinite(delta.x) && Number.isFinite(delta.y)) {
                
                // CRITICAL FIX: Use batch updates
                const batchUpdates: { id: string, updates: AnyShapePropertyUpdates }[] = [];
                
                Array.from(selectedShapeIds).forEach(id => {
                    const shape = shapes.find(s => s.id === id); if (!shape) return;
                    const updates: AnyShapePropertyUpdates = {};
                    if (shape.type === 'line' || shape.type === 'dimension') { updates.p1 = add(shape.p1, delta); updates.p2 = add(shape.p2, delta); if (shape.type === 'dimension') updates.offsetPoint = add(shape.offsetPoint, delta); }
                    else if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'symbol' || shape.type === 'title_block') { updates.x = shape.x + delta.x; updates.y = shape.y + delta.y; }
                    else if (shape.type === 'circle') { updates.cx = shape.cx + delta.x; updates.cy = shape.cy + delta.y; }
                    batchUpdates.push({ id, updates });
                });
                
                if (batchUpdates.length > 0) updateShapes(batchUpdates);
                setMoveBasePoint(null); // Clear base point after successful move
            }
            // If delta ~ 0, we treat it as the first click (Base Point Set in PointerDown), so we keep waiting for second click or drag.
        }
        
        if (activeTool === 'arc' && arcStep > 0) return;
        
        // COMMIT ROTATION
        if ((activeTool === 'rotate' || draggingHandle?.handleIndex === 'rotate') && rotateState) {
             const currentAngle = angle(subtract(worldPos, rotateState.center)); 
             // FIX: Reversed calculation to match mouse movement. Positive = CCW.
             let deltaAngle = currentAngle - rotateState.startAngle; 
             
             // Normalize angle to handle wrapping (e.g. 350 -> 10 should be +20, not -340)
             if (deltaAngle > 180) deltaAngle -= 360;
             if (deltaAngle < -180) deltaAngle += 360;

             // Commit rotation using BATCH UPDATES
             const batchUpdates: { id: string, updates: AnyShapePropertyUpdates }[] = [];

             Object.entries(rotateState.groupOriginals).forEach(([id, original]) => {
                 const updates: AnyShapePropertyUpdates = {};
                 
                 if (original.type === 'rectangle' || original.type === 'symbol' || original.type === 'text' || original.type === 'title_block') {
                      const origRot = 'rotation' in original ? (original.rotation || 0) : 0;
                      updates.rotation = (origRot + deltaAngle) % 360;
                      
                      // Also rotate position if we are in a group (orbit around center)
                      let shapeCenter = {x: 0, y: 0};
                      if (original.type === 'rectangle' || original.type === 'title_block') {
                           shapeCenter = { x: original.x + original.width/2, y: original.y + original.height/2 };
                      } else {
                           shapeCenter = { x: original.x, y: original.y };
                      }
                      
                      const newCenter = rotatePoint(shapeCenter, rotateState.center, deltaAngle);
                      if (original.type === 'rectangle' || original.type === 'title_block') {
                           updates.x = newCenter.x - original.width/2;
                           updates.y = newCenter.y - original.height/2;
                      } else {
                           updates.x = newCenter.x;
                           updates.y = newCenter.y;
                      }
                 } else if (original.type === 'line' || original.type === 'dimension') { 
                      const rotateP = (p: Point) => rotatePoint(p, rotateState.center, deltaAngle); 
                      updates.p1 = rotateP(original.p1); 
                      updates.p2 = rotateP(original.p2); 
                      if (original.type === 'dimension' && 'offsetPoint' in original) updates.offsetPoint = rotateP((original as Dimension).offsetPoint); 
                 } else if (original.type === 'circle') {
                      const newCenter = rotatePoint({x: original.cx, y: original.cy}, rotateState.center, deltaAngle);
                      updates.cx = newCenter.x;
                      updates.cy = newCenter.y;
                 }
                 
                 batchUpdates.push({ id, updates });
             });

             if (batchUpdates.length > 0) updateShapes(batchUpdates);

             setRotateState(null); 
             if (draggingHandle?.handleIndex === 'rotate') setDraggingHandle(null); 
             return;
        }

        if (activeTool === 'dimension' && dimensionStep === 2) return;
        
        isInteractingRef.current = false; setPanStart(null); setDraggingHandle(null); setDragStartPos(null); setDragStartScreenPos(null);
        // Do NOT clear moveBasePoint here blindly, handled above
        if (activeTool !== 'move') setMoveBasePoint(null);

        if (currentShape && activeTool !== 'dimension') {
            if (currentShape.type === 'line' && distance(currentShape.p1!, currentShape.p2!) > 0.1) addShape(currentShape as Omit<Line, 'id'>);
            else if (currentShape.type === 'rectangle' && currentShape.width! !== 0 && currentShape.height! !== 0) { const newRect: Omit<Rectangle, 'id'> = { type: 'rectangle', x: currentShape.width! < 0 ? currentShape.x! + currentShape.width! : currentShape.x!, y: currentShape.height! < 0 ? currentShape.y! + currentShape.height! : currentShape.y!, width: Math.abs(currentShape.width!), height: Math.abs(currentShape.height!), properties: currentShape.properties as DrawingProperties, rotation: 0 }; addShape(newRect); } else if (currentShape.type === 'circle' && currentShape.r! > 0.1) addShape(currentShape as Omit<Circle, 'id'>);
        }
        if (activeTool !== 'dimension' || dimensionStep !== 2) setCurrentShape(null);
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if(e.ctrlKey) e.preventDefault(); 
        const rect = e.currentTarget.getBoundingClientRect();
        const localMousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const zoomFactor = 1 - Math.sign(e.deltaY) * 0.1;
        const prevTransform = viewTransform;
        const newScale = Math.min(Math.max(prevTransform.scale * zoomFactor, 0.05), 200);
        const ratio = newScale / prevTransform.scale;
        const newX = localMousePos.x - (localMousePos.x - prevTransform.x) * ratio;
        const newY = localMousePos.y - (localMousePos.y - prevTransform.y) * ratio;
        setViewTransform({ scale: newScale, x: newX, y: newY });
    };
    
    const cursor = panStart ? 'grabbing' : activeTool === 'pan' ? 'grab' : activeTool === 'select' ? 'default' : (activeTool === 'copy-area' || activeTool === 'trim' || activeTool === 'extend') ? 'crosshair' : activeTool === 'text' ? 'text' : activeTool === 'paste' ? 'copy' : activeTool === 'move' ? 'default' : activeTool === 'rotate' ? 'alias' : activeTool === 'title_block' ? 'copy' : 'none';
    
    return (
        <div className="flex-grow bg-dark-base-200 overflow-hidden relative" onWheel={handleWheel}>
            <svg 
                ref={svgRef} width="100%" height="100%" 
                onDragStart={(e) => e.preventDefault()} 
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} 
                onPointerCancel={handlePointerUp} onLostPointerCapture={handlePointerUp}
                style={{ cursor, touchAction: 'none' }}
            >
                <defs>
                    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                         <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
                         <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5"/>
                    </pattern>
                     <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                    </marker>
                </defs>
                <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.scale})`}>
                    
                    {templateImage && templateImage.isVisible && (
                         <image href={templateImage.data} x={templateImage.x} y={templateImage.y} width={templateImage.width} height={templateImage.height} opacity={templateImage.opacity} preserveAspectRatio="none" />
                    )}
                    
                    <rect width="50000" height="50000" x="-25000" y="-25000" fill="url(#grid)" />
                     <circle cx="0" cy="0" r={3 / viewTransform.scale} fill="red" />
                    
                    {/* --- MAIN SHAPES RENDER LOOP --- */}
                    {shapes.map(shape => {
                         const isSelected = selectedShapeIds.has(shape.id);

                         // Check if this shape is part of an active drag/rotate operation
                         let isBeingManipulated = false;
                         
                         // Case A: Dragging Handle (Move or Resize)
                         if (draggingHandle) {
                             if (draggingHandle.handleIndex === 'move' && draggingHandle.groupOriginals && draggingHandle.groupOriginals[shape.id]) {
                                 isBeingManipulated = true;
                             } else if (typeof draggingHandle.handleIndex === 'number' && draggingHandle.shapeId === shape.id) {
                                 // Resizing single shape: Replace with preview
                                 if (draggingHandle.currentPreview) return <ShapeRenderer key={shape.id} shape={draggingHandle.currentPreview} isSelected={true} conversionFactor={conversionFactor} isPreview={true} />; 
                             }
                         }
                         
                         // Case B: Rotate Tool or Handle
                         if (rotateState && rotateState.groupOriginals[shape.id]) {
                             isBeingManipulated = true;
                         }
                         
                         // Case C: Move Tool (Explicit)
                         if (activeTool === 'move' && moveBasePoint && isSelected) {
                              isBeingManipulated = true;
                         }
                         
                         // If being manipulated, render ORIGINAL at LOW opacity (Ghost).
                         // Use 0.5 opacity so it is clearly visible as the "source" position.
                         if (isBeingManipulated) {
                             return <ShapeRenderer key={shape.id} shape={shape} isSelected={false} conversionFactor={conversionFactor} opacity={0.5} />; 
                         }
                        
                        // Default Render (Originals during normal state)
                        return <ShapeRenderer key={shape.id} shape={shape} isSelected={isSelected} isHighlighted={false} conversionFactor={conversionFactor} />
                    })}

                    {currentShape && <ShapeRenderer shape={currentShape as AnyShape} isSelected={false} conversionFactor={conversionFactor} />}
                    
                     {activeTool === 'arc' && arcPoints.length > 0 && (
                        <g>
                            <circle cx={arcPoints[0].x} cy={arcPoints[0].y} r={4 / viewTransform.scale} fill="#00A8FF" />
                            {arcPoints.length > 1 && ( <circle cx={arcPoints[1].x} cy={arcPoints[1].y} r={4 / viewTransform.scale} fill="#00A8FF" opacity="0.7" /> )}
                        </g>
                     )}
                    
                     {hoveredShapeId && (() => { const shape = shapes.find(s => s.id === hoveredShapeId); if (!shape) return null; return getShapeSnapPoints(shape).map((sp, i) => ( <circle key={i} cx={sp.point.x} cy={sp.point.y} r={5 / viewTransform.scale} fill="cyan" fillOpacity="0.5" /> )); })()}
                    
                    {/* Render snap points for SINGLE selected shape to avoid clutter */}
                    {selectedShapeId && selectedShapeIds.size === 1 && (() => { const s=shapes.find(x=>x.id===selectedShapeId); return s ? getShapeSnapPoints(s).map((sp, i) => (<circle key={`node-${i}`} cx={sp.point.x} cy={sp.point.y} r={5 / viewTransform.scale} fill="white" stroke="#00A8FF" strokeWidth={1.5 / viewTransform.scale} />)) : null })()}

                    {/* Multi-Selection Bounding Box & Rotation Handle */}
                    {multiSelectionBounds && !rotateState && (() => {
                        const { x, y, width, height } = multiSelectionBounds;
                        const centerX = x + width / 2;
                        const handleY = y - 30 / viewTransform.scale;
                        
                        return (
                             <g>
                                <rect 
                                    x={x} y={y} 
                                    width={width} height={height} 
                                    fill="none" stroke="#00A8FF" strokeWidth={1.5 / viewTransform.scale} strokeDasharray={`${5/viewTransform.scale} ${5/viewTransform.scale}`} 
                                />
                                {/* Group Rotation Handle */}
                                <line x1={centerX} y1={y} x2={centerX} y2={handleY} stroke="#00A8FF" strokeWidth={1.5 / viewTransform.scale} vectorEffect="non-scaling-stroke" />
                                <circle cx={centerX} cy={handleY} r={4 / viewTransform.scale} fill="white" stroke="#00A8FF" strokeWidth={1.5 / viewTransform.scale} style={{cursor: 'grab'}} vectorEffect="non-scaling-stroke" />
                             </g>
                        );
                    })()}

                    {activeSnapPoint && ( <g> <circle cx={activeSnapPoint.point.x} cy={activeSnapPoint.point.y} r={8 / viewTransform.scale} fill="magenta" fillOpacity="0.7"/> <circle cx={activeSnapPoint.point.x} cy={activeSnapPoint.point.y} r={1.5 / viewTransform.scale} fill="white"/> </g> )}
                    
                    {inferenceLines.map((line, i) => ( <g key={i}> <line x1={line.p1.x} y1={line.p1.y} x2={line.p2.x} y2={line.p2.y} stroke="lime" strokeWidth={1 / viewTransform.scale} strokeDasharray={`${5/viewTransform.scale} ${5/viewTransform.scale}`} opacity="0.8" /> <line x1={line.p1.x - 3/viewTransform.scale} y1={line.p1.y} x2={line.p1.x + 3/viewTransform.scale} y2={line.p1.y} stroke="lime" strokeWidth={1/viewTransform.scale} /> <line x1={line.p1.x} y1={line.p1.y - 3/viewTransform.scale} x2={line.p1.x} y2={line.p1.y + 3/viewTransform.scale} stroke="lime" strokeWidth={1/viewTransform.scale} /> </g> ))}

                    {selectionRect && (() => {
                         const rX = selectionRect.width < 0 ? selectionRect.x + selectionRect.width : selectionRect.x;
                         const rY = selectionRect.height < 0 ? selectionRect.y + selectionRect.height : selectionRect.y;
                         const rW = Math.abs(selectionRect.width); const rH = Math.abs(selectionRect.height);
                         return <rect x={rX} y={rY} width={rW} height={rH} fill="rgba(0, 168, 255, 0.2)" stroke="rgba(0, 168, 255, 0.8)" strokeWidth={1 / viewTransform.scale} strokeDasharray={`4 ${2 / viewTransform.scale}`} />;
                    })()}

                    {activeTool === 'trim' && hoveredTrimSegment && (() => {
                         const { geometry } = hoveredTrimSegment; 
                         const s = 4 / viewTransform.scale;
                         const crossSize = 10 / viewTransform.scale;
                         const crossProps = { stroke: "red", strokeWidth: 2 / viewTransform.scale };
                         
                         let segmentRender = null;
                         if (geometry.type === 'line') {
                             const p1 = geometry.p1; const p2 = geometry.p2; 
                             // Calculate interpolated start/end points based on tMin/tMax
                             const vec = subtract(p2, p1);
                             const start = add(p1, scale(vec, geometry.tMin));
                             const end = add(p1, scale(vec, geometry.tMax));
                             
                             segmentRender = <line key="trim-hover" x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="red" strokeWidth={4 / viewTransform.scale} strokeLinecap="round" strokeDasharray={`${10/viewTransform.scale} ${5/viewTransform.scale}`} opacity="0.8" />;
                         } else {
                             const { cx, cy, r, startAngle, endAngle } = geometry;
                             segmentRender = <path d={describeArc(cx, cy, r, startAngle, endAngle)} stroke="red" strokeWidth={4 / viewTransform.scale} strokeDasharray={`${10/viewTransform.scale} ${5/viewTransform.scale}`} fill="none" opacity="0.8" />;
                         }

                         return ( 
                            <g> 
                                {segmentRender}
                                <line x1={worldMousePos.x - crossSize/2} y1={worldMousePos.y - crossSize/2} x2={worldMousePos.x + crossSize/2} y2={worldMousePos.y + crossSize/2} {...crossProps} />
                                <line x1={worldMousePos.x + crossSize/2} y1={worldMousePos.y - crossSize/2} x2={worldMousePos.x - crossSize/2} y2={worldMousePos.y + crossSize/2} {...crossProps} />
                            </g> 
                         );
                    })()}

                    {activeTool === 'extend' && hoveredExtendPreview && (() => { const { originalShape, newEndpoint, endToUpdate } = hoveredExtendPreview; const start = endToUpdate === 'p1' ? originalShape.p1 : originalShape.p2; return ( <g> <line x1={start.x} y1={start.y} x2={newEndpoint.x} y2={newEndpoint.y} stroke="lime" strokeWidth={2 / viewTransform.scale} strokeDasharray={`${4/viewTransform.scale}`} /> <circle cx={newEndpoint.x} cy={newEndpoint.y} r={4 / viewTransform.scale} fill="lime" /> </g> ) })()}

                    {activeTool === 'dimension' && hoveredDimensionTarget && hoveredDimensionTarget.type === 'segment' && ( <line x1={hoveredDimensionTarget.p1.x} y1={hoveredDimensionTarget.p1.y} x2={hoveredDimensionTarget.p2.x} y2={hoveredDimensionTarget.p2.y} stroke="cyan" strokeWidth={2 / viewTransform.scale} strokeDasharray={`${4/viewTransform.scale}`} /> )}
                    {activeTool === 'dimension' && hoveredDimensionTarget && hoveredDimensionTarget.type === 'circle' && ( <circle cx={hoveredDimensionTarget.p1.x} cy={hoveredDimensionTarget.p1.y} r={distance(hoveredDimensionTarget.p1, hoveredDimensionTarget.p2)} fill="none" stroke="cyan" strokeWidth={2 / viewTransform.scale} strokeDasharray={`${4/viewTransform.scale}`} /> )}

                    {activeTool === 'paste' && clipboard && clipboard.shapes.map(shape => {
                        const translation = subtract(worldMousePos, clipboard.origin); 
                        const newShape = JSON.parse(JSON.stringify(shape)) as AnyShape;
                        if (newShape.type === 'line' || newShape.type === 'dimension') { newShape.p1 = add(newShape.p1, translation); newShape.p2 = add(newShape.p2, translation); if(newShape.type === 'dimension') newShape.offsetPoint = add(newShape.offsetPoint, translation); } 
                        else if (newShape.type === 'rectangle' || newShape.type === 'text' || newShape.type === 'symbol' || newShape.type === 'title_block') { newShape.x += translation.x; newShape.y += translation.y; } 
                        else if (newShape.type === 'circle') { newShape.cx += translation.x; newShape.cy += translation.y; }
                        return <ShapeRenderer key={'preview-' + shape.id} shape={newShape} isSelected={false} conversionFactor={conversionFactor} isPreview={true} />
                    })}
                    
                    {/* --- PREVIEW: DRAG MOVE (Select Tool) using SVG TRANSFORM --- */}
                    {(draggingHandle?.handleIndex === 'move' && draggingHandle.groupOriginals && dragStartPos) ? (() => {
                         // Critical Fix: Pass dragStartPos directly and calculate delta safely to prevent disappearing elements
                         const currentPos = activeSnapPoint ? activeSnapPoint.point : worldMousePos; 
                         const delta = subtract(currentPos, dragStartPos); 
                         const safeX = Number.isFinite(delta.x) ? delta.x : 0;
                         const safeY = Number.isFinite(delta.y) ? delta.y : 0;
                         
                         // Ensure groupOriginals are valid
                         const shapesToPreview = Object.values(draggingHandle.groupOriginals).filter(s => !!s);
                         if (shapesToPreview.length === 0) return null;

                         return (
                            <g transform={`translate(${safeX} ${safeY})`} style={{pointerEvents: 'none'}}>
                                {shapesToPreview.map((shape) => (
                                    <ShapeRenderer key={'preview-drag-' + shape.id} shape={shape} isSelected={false} conversionFactor={conversionFactor} isPreview={true} />
                                ))}
                            </g>
                         );
                    })() : null}

                    {/* --- PREVIEW: MOVE TOOL (Click-Click) using SVG TRANSFORM --- */}
                    {(activeTool === 'move' && moveBasePoint) ? (() => {
                        const snapPos = activeSnapPoint ? activeSnapPoint.point : worldMousePos; 
                        const delta = subtract(snapPos, moveBasePoint); 
                        const safeX = Number.isFinite(delta.x) ? delta.x : 0;
                        const safeY = Number.isFinite(delta.y) ? delta.y : 0;

                        return (
                             <g transform={`translate(${safeX} ${safeY})`} style={{pointerEvents: 'none'}}>
                                {Array.from(selectedShapeIds).map(id => {
                                    const shape = shapes.find(s => s.id === id); 
                                    if (!shape) return null;
                                    return <ShapeRenderer key={'preview-trans-' + id} shape={shape} isSelected={false} conversionFactor={conversionFactor} isPreview={true} />
                                })}
                             </g>
                        );
                    })() : null}
                    
                    {/* --- PREVIEW: ROTATE using SVG TRANSFORM --- */}
                    {(rotateState) ? (() => {
                         const currentAngle = angle(subtract(worldMousePos, rotateState.center));
                         // FIX: Delta is CCW (Standard Math).
                         let deltaAngle = currentAngle - rotateState.startAngle;
                         if (deltaAngle > 180) deltaAngle -= 360;
                         if (deltaAngle < -180) deltaAngle += 360;

                         const safeAngle = Number.isFinite(deltaAngle) ? deltaAngle : 0;
                         // SVG Rotation is CW. So we render with -safeAngle (CCW).
                         
                         return (
                             <g transform={`rotate(${-safeAngle} ${rotateState.center.x} ${rotateState.center.y})`} style={{pointerEvents: 'none'}}>
                                 {Object.values(rotateState.groupOriginals).map((shape) => (
                                      <ShapeRenderer key={'preview-rot-' + shape.id} shape={shape} isSelected={false} conversionFactor={conversionFactor} isPreview={true} />
                                 ))}
                             </g>
                         );
                    })() : null}
                </g>
            </svg>
            <div className="pointer-events-none absolute inset-0">
                {cursor === 'none' && ( <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}> <rect x={mousePosition.x - 10} y={mousePosition.y - 10} width="20" height="20" fill="none" stroke="white" strokeWidth="0.5" /> <line x1={mousePosition.x} y1={0} x2={mousePosition.x} y2={5000} stroke="white" strokeWidth="0.5" /> <line x1={0} y1={mousePosition.y} x2={5000} y2={mousePosition.y} stroke="white" strokeWidth="0.5" /> </svg> )}
                {(isInteractingRef.current && (currentShape?.type === 'line' || currentShape?.type === 'dimension') && currentShape.p1) && ( <div className="absolute px-2 py-1 bg-blue-600 text-white text-xs rounded" style={{ left: mousePosition.x + 20, top: mousePosition.y + 20 }}> {`L: ${(distance(currentShape.p1!, worldMousePos) / conversionFactor).toFixed(2)} ${unit} | A: ${angleBetween(currentShape.p1!, worldMousePos).toFixed(2)}°`} </div> )}
                {selectedShapeId && !selectedShapeIds.size && (() => { const s=shapes.find(x=>x.id===selectedShapeId); if(s && (s.type === 'line' || s.type === 'dimension')) return ( <div className="absolute px-2 py-1 bg-blue-600 text-white text-xs rounded" style={{ left: (s.p1.x + s.p2.x)/2 * viewTransform.scale + viewTransform.x + 10, top: (s.p1.y + s.p2.y)/2 * viewTransform.scale + viewTransform.y + 10, }}> {`L: ${(distance(s.p1, s.p2) / conversionFactor).toFixed(2)} ${unit} | A: ${angleBetween(s.p1, s.p2).toFixed(2)}°`} </div> ); })()}
                {rotateState && ( <div className="absolute px-2 py-1 bg-purple-600 text-white text-xs rounded" style={{ left: mousePosition.x + 20, top: mousePosition.y + 20 }}> {`Rot: ${((angle(subtract(worldMousePos, rotateState.center)) - rotateState.startAngle + 360) % 360).toFixed(1)}°`} {rotateState.center && ( <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}> <line x1={(rotateState.center.x * viewTransform.scale) + viewTransform.x} y1={(rotateState.center.y * viewTransform.scale) + viewTransform.y} x2={mousePosition.x + 20} y2={mousePosition.y + 20} stroke="purple" strokeWidth="1" strokeDasharray="4 2" /> <circle cx={(rotateState.center.x * viewTransform.scale) + viewTransform.x} cy={(rotateState.center.y * viewTransform.scale) + viewTransform.y} r="4" fill="purple" /> </svg> )} </div> )}
                 <div className="absolute bottom-2 right-2 text-xs text-dark-base-content/60 bg-dark-base-100/50 px-2 py-1 rounded"> {`${(worldMousePos.x / conversionFactor).toFixed(2)} ${unit}, ${(worldMousePos.y / conversionFactor).toFixed(2)} ${unit}`} </div>
            </div>
        </div>
    );
};

export default Canvas;
