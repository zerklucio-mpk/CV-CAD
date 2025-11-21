
import React, { useRef, useState, PointerEvent as ReactPointerEvent, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { AnyShape, Point, Line, Rectangle, Circle, Dimension, SnapMode, Unit, DrawingProperties, Text, AnyShapePropertyUpdates, SymbolShape } from '../types';

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

// --- Helper to get Rotation Handle Position ---
const getRotationHandlePos = (shape: AnyShape): { handle: Point, center: Point } | null => {
    const OFFSET = 30;
    let center = { x: 0, y: 0 };
    let topPoint = { x: 0, y: 0 };
    let rotation = 0;

    if (shape.type === 'rectangle') {
        center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
        topPoint = { x: center.x, y: shape.y - OFFSET };
        rotation = shape.rotation || 0;
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
            const { x, y, width, height, rotation } = shape;
            const cx = x + width / 2;
            const cy = y + height / 2;
            const rot = rotation || 0;
            const rotate = (px: number, py: number) => rotatePoint({x: px, y: py}, {x: cx, y: cy}, rot);

            addP(rotate(x, y), 'endpoints');
            addP(rotate(x + width, y), 'endpoints');
            addP(rotate(x + width, y + height), 'endpoints');
            addP(rotate(x, y + height), 'endpoints');
            addP(rotate(x + width / 2, y), 'midpoints');
            addP(rotate(x + width, y + height / 2), 'midpoints');
            addP(rotate(x + width / 2, y + height), 'midpoints');
            addP(rotate(x, y + height / 2), 'midpoints');
            addP({ x: cx, y: cy }, 'centers');
            break;
        case 'circle':
            addP({ x: shape.cx, y: shape.cy }, 'centers');
            addP({ x: shape.cx + shape.r, y: shape.cy }, 'endpoints');
            addP({ x: shape.cx - shape.r, y: shape.cy }, 'endpoints');
            addP({ x: shape.cx, y: shape.cy + shape.r }, 'endpoints');
            addP({ x: shape.cx, y: shape.cy - shape.r }, 'endpoints');
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

const ShapeRenderer: React.FC<{ shape: AnyShape | Partial<AnyShape>; isSelected: boolean; isHighlighted?: boolean; conversionFactor: number; isPreview?: boolean; isGhost?: boolean; }> = React.memo(({ shape, isSelected, isHighlighted = false, conversionFactor, isPreview = false, isGhost = false }) => {
    const effectivelySelected = isSelected || isHighlighted;
    const props = {
        stroke: effectivelySelected ? '#00A8FF' : (shape.properties?.color || '#FFFFFF'),
        fill: shape.properties?.fill || 'transparent',
        strokeWidth: shape.properties?.strokeWidth || 1,
        strokeDasharray: effectivelySelected ? '4 2' : undefined,
        opacity: isGhost ? 0.2 : (isPreview ? 0.5 : 1),
    };
    
    if (!shape.type) return null;
    const isSafeNumber = (n: any) => typeof n === 'number' && Number.isFinite(n) && !Number.isNaN(n);
    
    if (shape.type === 'line') {
        if (!shape.p1 || !shape.p2 || !isSafeNumber(shape.p1.x) || !isSafeNumber(shape.p1.y) || !isSafeNumber(shape.p2.x)) return null;
    } else if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'symbol') {
        if (!isSafeNumber(shape.x) || !isSafeNumber(shape.y)) return null;
        if (shape.type === 'rectangle' && (!isSafeNumber(shape.width) || !isSafeNumber(shape.height))) return null;
    } else if (shape.type === 'circle') {
        if (!isSafeNumber(shape.cx) || !isSafeNumber(shape.cy) || !isSafeNumber(shape.r)) return null;
    }

    const rotData = isSelected ? getRotationHandlePos(shape as AnyShape) : null;

    switch (shape.type) {
        case 'line': {
            const s = shape as Partial<Line>;
            if (!s.p1 || !s.p2) return null;
            return <line x1={s.p1.x} y1={s.p1.y} x2={s.p2.x} y2={s.p2.y} {...props} />;
        }
        case 'rectangle': {
            const s = shape as Partial<Rectangle>;
            if (s.x === undefined || s.y === undefined || s.width === undefined || s.height === undefined) return null;
            
            // FIX: Normalize for visual rendering (SVG does not handle negative width/height)
            let renderX = s.x;
            let renderY = s.y;
            let renderW = s.width;
            let renderH = s.height;

            if (renderW < 0) {
                renderX += renderW;
                renderW = Math.abs(renderW);
            }
            if (renderH < 0) {
                renderY += renderH;
                renderH = Math.abs(renderH);
            }

            const centerX = renderX + renderW / 2;
            const centerY = renderY + renderH / 2;
            const transform = s.rotation ? `rotate(${-s.rotation}, ${centerX}, ${centerY})` : undefined;
            return (
                <g>
                    <rect x={renderX} y={renderY} width={renderW} height={renderH} transform={transform} {...props} />
                    {isSelected && (
                        <g transform={transform}>
                             <line x1={centerX - 5} y1={centerY} x2={centerX + 5} y2={centerY} stroke="#00A8FF" strokeWidth="1" />
                             <line x1={centerX} y1={centerY - 5} x2={centerX} y2={centerY + 5} stroke="#00A8FF" strokeWidth="1" />
                        </g>
                    )}
                    {isSelected && rotData && (
                        <g>
                             <line x1={rotData.center.x} y1={rotData.center.y} x2={rotData.handle.x} y2={rotData.handle.y} stroke="#00A8FF" strokeWidth="1" />
                             <circle cx={rotData.handle.x} cy={rotData.handle.y} r={4} fill="white" stroke="#00A8FF" strokeWidth="1" style={{cursor: 'grab'}} />
                        </g>
                    )}
                </g>
            );
        }
        case 'circle': {
            const s = shape as Partial<Circle>;
            if (s.cx === undefined || s.cy === undefined || s.r === undefined) return null;
            const isArc = s.startAngle !== undefined && s.endAngle !== undefined && Math.abs(s.endAngle - s.startAngle) < 359.9;
            return (
                <g>
                    {isArc ? (
                         <path d={describeArc(s.cx, s.cy, s.r, s.startAngle!, s.endAngle!)} {...props} fill="none" />
                    ) : (
                         <circle cx={s.cx} cy={s.cy} r={s.r} {...props} />
                    )}
                    {isSelected && (
                        <g>
                             <g transform={`translate(${s.cx}, ${s.cy})`}>
                                <line x1={-4} y1={0} x2={4} y2={0} stroke="#00A8FF" strokeWidth="1" />
                                <line x1={0} y1={-4} x2={0} y2={4} stroke="#00A8FF" strokeWidth="1" />
                             </g>
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
                     {isSelected && rotData && (
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
            }
            return (
                <g>
                    <g {...symbolProps}>{content}</g>
                    {isSelected && rotData && (
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
    | { type: 'line', p1: Point, p2: Point }
    | { type: 'arc', cx: number, cy: number, r: number, startAngle: number, endAngle: number };

const Canvas: React.FC = () => {
    const {
        shapes, addShapes, addShape, activeTool, setActiveTool, drawingProperties, viewTransform,
        selectedShapeId, setSelectedShapeId, snapModes, isOrthoMode, unit,
        clipboard, setClipboard, updateShape, replaceShapes, deleteShape, deleteShapes,
        templateImage
    } = useAppContext();
    const { setViewTransform } = useAppContext();

    const svgRef = useRef<SVGSVGElement>(null);
    const isInteractingRef = useRef(false);
    
    const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 });
    const [panStart, setPanStart] = useState<Point | null>(null);
    const [currentShape, setCurrentShape] = useState<Partial<AnyShape> | null>(null);
    const [dimensionStep, setDimensionStep] = useState(0);
    const [selectionRect, setSelectionRect] = useState<Rectangle | null>(null);
    const [highlightedShapeIds, setHighlightedShapeIds] = useState<Set<string>>(new Set());

    const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
    const [activeSnapPoint, setActiveSnapPoint] = useState<{ point: Point, type: SnapMode } | null>(null);
    const [inferenceLines, setInferenceLines] = useState<Line[]>([]);

    // Drag Threshold State
    const [dragStartScreenPos, setDragStartScreenPos] = useState<Point | null>(null);
    const DRAG_THRESHOLD = 3; // Pixels before a click becomes a drag

    const [draggingHandle, setDraggingHandle] = useState<{ 
        shapeId: string, 
        handleIndex: number | 'rotate' | 'move', 
        originalShape: AnyShape,
        groupOriginals?: Record<string, AnyShape> 
    } | null>(null);
    const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
    const [hoveredTrimSegment, setHoveredTrimSegment] = useState<{ shapeId: string; geometry: TrimGeometry } | null>(null);
    const [hoveredExtendPreview, setHoveredExtendPreview] = useState<{ originalShape: Line, newEndpoint: Point, endToUpdate: 'p1' | 'p2' } | null>(null);
    const [hoveredDimensionTarget, setHoveredDimensionTarget] = useState<{ type: 'segment' | 'circle', p1: Point, p2: Point, circleId?: string } | null>(null);
    const [moveBasePoint, setMoveBasePoint] = useState<Point | null>(null);
    const [rotateState, setRotateState] = useState<{ startAngle: number, initialRotation: number, center: Point, originalShape: AnyShape } | null>(null);
    
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
            if (isInteractingRef.current || draggingHandle || panStart || currentShape || dragStartScreenPos) {
                 handlePointerUp(e as unknown as ReactPointerEvent<SVGSVGElement>);
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
                if (currentShape || dimensionStep > 0 || draggingHandle || panStart || isInteractingRef.current || activeTool === 'paste') {
                    setCurrentShape(null); setDimensionStep(0); setDraggingHandle(null); setPanStart(null);
                    if (activeTool === 'paste') setClipboard(null);
                    isInteractingRef.current = false; handled = true;
                }
                if (activeTool !== 'select') {
                    setActiveTool('select'); setHoveredTrimSegment(null); setHoveredExtendPreview(null); setMoveBasePoint(null); setRotateState(null); handled = true;
                }
                if (!handled && (selectedShapeId || highlightedShapeIds.size > 0)) {
                    setSelectedShapeId(null); setHighlightedShapeIds(new Set());
                }
                return;
            }
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) return;
            const selectedIds = highlightedShapeIds.size > 0 ? Array.from(highlightedShapeIds) : (selectedShapeId ? [selectedShapeId] : []);
            if (selectedIds.length > 0) {
                const step = e.shiftKey ? 10 : 1;
                let dx = 0; let dy = 0;
                switch (e.key) {
                    case 'ArrowLeft': dx = -step; break;
                    case 'ArrowRight': dx = step; break;
                    case 'ArrowUp': dy = -step; break;
                    case 'ArrowDown': dy = step; break;
                    case 'Backspace': case 'Delete': e.preventDefault(); deleteShapes(selectedIds); setSelectedShapeId(null); setHighlightedShapeIds(new Set()); return;
                    default: return;
                }
                e.preventDefault(); 
                selectedIds.forEach(id => {
                    const shape = shapes.find(s => s.id === id);
                    if (!shape) return;
                    const updates: AnyShapePropertyUpdates = {};
                    if (shape.type === 'line' || shape.type === 'dimension') {
                        updates.p1 = { x: shape.p1.x + dx, y: shape.p1.y + dy };
                        updates.p2 = { x: shape.p2.x + dx, y: shape.p2.y + dy };
                        if (shape.type === 'dimension') updates.offsetPoint = { x: shape.offsetPoint.x + dx, y: shape.offsetPoint.y + dy };
                    } else if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'symbol') {
                        updates.x = shape.x + dx; updates.y = shape.y + dy;
                    } else if (shape.type === 'circle') {
                        updates.cx = shape.cx + dx; updates.cy = shape.cy + dy;
                    }
                    updateShape(id, updates);
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedShapeId, shapes, updateShape, deleteShape, deleteShapes, setSelectedShapeId, activeTool, setActiveTool, currentShape, dimensionStep, draggingHandle, panStart, highlightedShapeIds]);

    useEffect(() => {
        setHoveredTrimSegment(null); setHoveredExtendPreview(null); setMoveBasePoint(null); setRotateState(null);
        if (activeTool !== 'dimension') { setHoveredDimensionTarget(null); setDimensionStep(0); if (currentShape?.type === 'dimension') setCurrentShape(null); }
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
            if ((shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'symbol') && shape.rotation) {
                 let center = {x: 0, y: 0};
                 if (shape.type === 'rectangle') center = { x: shape.x + shape.width/2, y: shape.y + shape.height/2 };
                 else center = { x: shape.x, y: shape.y };
                 hitPos = rotatePoint(pos, center, -shape.rotation);
            }
            switch (shape.type) {
                case 'line': if (pointOnLineSegment(hitPos, shape.p1, shape.p2, tolerance)) return shape.id; break;
                case 'dimension': if (pointOnLineSegment(hitPos, shape.p1, shape.p2, tolerance)) return shape.id; break;
                case 'rectangle': {
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

    const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { }
        isInteractingRef.current = true;
        setActiveSnapPoint(null);

        const rect = e.currentTarget.getBoundingClientRect();
        const localMousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const startPos = screenToWorld(localMousePos);
        const snapPos = activeSnapPoint ? activeSnapPoint.point : startPos;

        setDragStartScreenPos(localMousePos); // Initialize drag threshold tracking

        if (activeTool === 'pan' || e.button === 1) {
            setPanStart({ x: localMousePos.x - viewTransform.x, y: localMousePos.y - viewTransform.y });
            return;
        }

        if (activeTool === 'select') {
            if (selectedShapeId && !e.shiftKey) {
                const selectedShape = shapes.find(s => s.id === selectedShapeId);
                if (selectedShape) {
                    const rotHandle = getRotationHandlePos(selectedShape);
                    const tolerance = 10 / viewTransform.scale;
                    
                    if (rotHandle && distance(rotHandle.handle, startPos) < tolerance) {
                        let center = rotHandle.center;
                        let currentRot = selectedShape.rotation || 0;
                        
                        setDraggingHandle({ 
                            shapeId: selectedShapeId, 
                            handleIndex: 'rotate', 
                            originalShape: JSON.parse(JSON.stringify(selectedShape)) as AnyShape
                        });
                         setRotateState({
                            startAngle: angle(subtract(startPos, center)),
                            initialRotation: currentRot,
                            center,
                            originalShape: JSON.parse(JSON.stringify(selectedShape)) as AnyShape
                        });
                        return;
                    }
                    const snapPoints = getShapeSnapPoints(selectedShape);
                    const clickedHandleIndex = snapPoints.findIndex(sp => distance(sp.point, startPos) < tolerance);
                    if (clickedHandleIndex !== -1) {
                        setDraggingHandle({ 
                            shapeId: selectedShapeId, 
                            handleIndex: clickedHandleIndex, 
                            originalShape: JSON.parse(JSON.stringify(selectedShape)) as AnyShape
                        });
                        return;
                    }
                }
            }
            
            // For Selection, we defer the action to PointerMove or PointerUp (based on drag threshold)
            // We just record the potential hit here, but don't commit selection change yet to avoid "jumping"
            return; 
        }

        if (activeTool === 'rotate') {
             const hitId = getHitTest(startPos, 5 / viewTransform.scale);
             const targetId = hitId || selectedShapeId;
             if (targetId) {
                  if(hitId && hitId !== selectedShapeId) setSelectedShapeId(hitId);
                  const shape = shapes.find(s => s.id === targetId);
                  if (shape) {
                       let center = { x: 0, y: 0 };
                       let currentRot = shape.rotation || 0;
                        if (shape.type === 'rectangle') center = { x: shape.x + shape.width/2, y: shape.y + shape.height/2 };
                        else if (shape.type === 'symbol' || shape.type === 'text') center = { x: shape.x, y: shape.y };
                        else if (shape.type === 'line' || shape.type === 'dimension') center = { x: (shape.p1.x + shape.p2.x)/2, y: (shape.p1.y + shape.p2.y)/2 };
                        else if (shape.type === 'circle') center = { x: shape.cx, y: shape.cy };
                        
                        setRotateState({
                             startAngle: angle(subtract(startPos, center)),
                             initialRotation: currentRot,
                             center,
                             originalShape: JSON.parse(JSON.stringify(shape)) as AnyShape
                        });
                  }
             }
             return;
        }
        
        if (activeTool === 'move') {
            // Logic handled in move generally or waiting for base point
             if (highlightedShapeIds.size > 0 || selectedShapeId) {
                if (!moveBasePoint) setMoveBasePoint(snapPos);
            }
            return;
        }
        
        // ... Trim/Extend Logic similar ... 
        if (activeTool === 'trim' && hoveredTrimSegment) {
             // Logic executed on Click immediately for trim
             const { shapeId, geometry } = hoveredTrimSegment;
            const originalShape = shapes.find(s => s.id === shapeId);
            if (originalShape) {
                if (geometry.type === 'line' && originalShape.type === 'line') {
                    const newShapes: Omit<Line, 'id'>[] = [];
                    if (distance(originalShape.p1, geometry.p1) > 1e-3) newShapes.push({ ...originalShape, p1: originalShape.p1, p2: geometry.p1 });
                    if (distance(geometry.p2, originalShape.p2) > 1e-3) newShapes.push({ ...originalShape, p1: geometry.p2, p2: originalShape.p2 });
                    replaceShapes([shapeId], newShapes);
                } else if (geometry.type === 'arc' && originalShape.type === 'circle') {
                    const newShapes: Omit<Circle, 'id'>[] = [];
                    const { startAngle: cutStart, endAngle: cutEnd } = geometry;
                    const origStart = originalShape.startAngle ?? 0;
                    const origEnd = originalShape.endAngle ?? 360;
                    const isFullCircle = (originalShape.startAngle === undefined);
                    if (isFullCircle) {
                        newShapes.push({ ...originalShape, startAngle: cutEnd, endAngle: cutStart });
                    } else {
                        if (Math.abs(cutStart - origStart) > 1e-2) newShapes.push({ ...originalShape, startAngle: origStart, endAngle: cutStart });
                        if (Math.abs(origEnd - cutEnd) > 1e-2) newShapes.push({ ...originalShape, startAngle: cutEnd, endAngle: origEnd });
                    }
                    replaceShapes([shapeId], newShapes);
                }
            }
            setHoveredTrimSegment(null);
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
                 else if (newShape.type === 'rectangle' || newShape.type === 'text' || newShape.type === 'symbol') { newShape.x += translation.x; newShape.y += translation.y; } 
                 else if (newShape.type === 'circle') { newShape.cx += translation.x; newShape.cy += translation.y; }
                 return newShape;
             });
             addShapes(shapesToPaste); setActiveTool('select');
             return;
        }
        
        if (activeTool === 'copy-area') {
            setSelectionRect({ type: 'rectangle', id: 'selection', x: startPos.x, y: startPos.y, width: 0, height: 0, properties: { color: '', fill: '', strokeWidth: 0 }});
            return;
        }
        
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
        
        if (activeTool === 'text') {
             addShape({ type: 'text', x: snapPos.x, y: snapPos.y, content: 'Texto', fontSize: 12, properties: drawingProperties, rotation: 0 });
             isInteractingRef.current = false; setActiveTool('select');
             return;
        }
        
        if (activeTool.startsWith('icon_') || activeTool === 'arrow_symbol' || activeTool === 'warning_symbol') {
             let symbolName: SymbolShape['name'] = 'arrow';
             if (activeTool.startsWith('icon_')) symbolName = activeTool.replace('icon_', '') as any;
             else if (activeTool === 'warning_symbol') symbolName = 'warning';
             
             addShape({ type: 'symbol', name: symbolName, x: snapPos.x, y: snapPos.y, size: 24, rotation: 0, properties: drawingProperties });
             isInteractingRef.current = false; setActiveTool('select');
             return;
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

        // --- DRAG THRESHOLD LOGIC ---
        // Only initiate a drag/move/select-drag if we've moved past threshold
        if (activeTool === 'select' && dragStartScreenPos && !draggingHandle && !selectionRect) {
            const screenDist = distance(dragStartScreenPos, localMousePos);
            if (screenDist > DRAG_THRESHOLD) {
                // Drag Confirmed. Now decide what to drag based on initial start pos logic.
                // Re-run hit test on the START point to be sure what we clicked
                const startWorld = screenToWorld(dragStartScreenPos);
                const hitId = getHitTest(startWorld, 5 / viewTransform.scale);
                
                if (hitId) {
                     // If multi-select active
                     const isMulti = e.shiftKey || highlightedShapeIds.has(hitId);
                     if (isMulti) {
                         if (!highlightedShapeIds.has(hitId)) {
                             const newSet = new Set(highlightedShapeIds); newSet.add(hitId);
                             setHighlightedShapeIds(newSet); setSelectedShapeId(hitId);
                         }
                         // Prep Group Drag
                         const groupOriginals: Record<string, AnyShape> = {};
                         const currentIds = highlightedShapeIds.has(hitId) ? highlightedShapeIds : new Set([hitId]);
                         currentIds.forEach(id => {
                             const s = shapes.find(x => x.id === id);
                             if(s) groupOriginals[id] = JSON.parse(JSON.stringify(s)) as AnyShape;
                         });
                         setDraggingHandle({ shapeId: hitId, handleIndex: 'move', originalShape: shapes.find(s=>s.id===hitId)!, groupOriginals });
                         setDragStartPos(startWorld);
                     } else {
                         // Single drag
                         setSelectedShapeId(hitId);
                         setHighlightedShapeIds(new Set([hitId]));
                         setDraggingHandle({ shapeId: hitId, handleIndex: 'move', originalShape: JSON.parse(JSON.stringify(shapes.find(s=>s.id===hitId)!)) as AnyShape });
                         setDragStartPos(startWorld);
                     }
                } else {
                    // Drag on empty space -> Box Selection
                    setSelectionRect({ type: 'rectangle', id: 'selection', x: startWorld.x, y: startWorld.y, width: 0, height: 0, properties: { color: '', fill: '', strokeWidth: 0 }});
                }
                setDragStartScreenPos(null); // Consumed
            } else {
                // Waiting for threshold...
                return; 
            }
        }

        // ... Standard Move Logic ...
        if (activeTool === 'trim') {
             const tolerance = 10 / viewTransform.scale;
             const hitId = getHitTest(worldPos, tolerance);
             if(hitId) {
                  const targetShape = shapes.find(s => s.id === hitId);
                  if (targetShape && targetShape.type === 'line') {
                       setHoveredTrimSegment({ shapeId: hitId, geometry: { type: 'line', p1: targetShape.p1, p2: targetShape.p2 }}); 
                  } else if (targetShape && targetShape.type === 'circle') {
                       setHoveredTrimSegment({ shapeId: hitId, geometry: { type: 'arc', cx: targetShape.cx, cy: targetShape.cy, r: targetShape.r, startAngle: targetShape.startAngle||0, endAngle: targetShape.endAngle||360 }}); 
                  }
             }
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
                        else if (s.type === 'rectangle') {
                            const { x, y, width, height } = s; const corners = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
                            const center = { x: x + width/2, y: y + height/2 }; const rot = s.rotation || 0;
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

        if (isInteractingRef.current || activeTool === 'move' || activeTool === 'rotate' || activeTool === 'trim' || activeTool === 'extend' || ['line', 'rectangle', 'circle', 'dimension', 'text'].includes(activeTool) || draggingHandle) {
            const snapThreshold = 10 / viewTransform.scale;
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
                for (const sp of pointsToCheck) {
                    if (Math.abs(worldPos.x - sp.point.x) < snapThreshold) { currentInferenceLines.push({id: '', type: 'line', p1: {x: sp.point.x, y: -10000}, p2: {x: sp.point.x, y: 10000}, properties: drawingProperties}); finalPos.x = sp.point.x; }
                    if (Math.abs(worldPos.y - sp.point.y) < snapThreshold) { currentInferenceLines.push({id: '', type: 'line', p1: {x: -10000, y: sp.point.y}, p2: {x: 10000, y: sp.point.y}, properties: drawingProperties}); finalPos.y = sp.point.y; }
                }
            }
            if (currentSnapPoint) finalPos = currentSnapPoint.point;
        }
        
        setHoveredShapeId(currentHoveredId); setActiveSnapPoint(currentSnapPoint); setInferenceLines(currentInferenceLines);

        if (draggingHandle) {
            const { shapeId, handleIndex, originalShape, groupOriginals } = draggingHandle;
            if (handleIndex === 'rotate') return;

            if (handleIndex === 'move' && groupOriginals && dragStartPos) {
                const delta = subtract(finalPos, dragStartPos);
                Object.entries(groupOriginals).forEach(([id, origShape]) => {
                     const updates: AnyShapePropertyUpdates = {};
                     if (origShape.type === 'line' || origShape.type === 'dimension') { updates.p1 = add(origShape.p1, delta); updates.p2 = add(origShape.p2, delta); if(origShape.type === 'dimension') updates.offsetPoint = add(origShape.offsetPoint, delta); } 
                     else if (origShape.type === 'rectangle' || origShape.type === 'text' || origShape.type === 'symbol') { updates.x = origShape.x + delta.x; updates.y = origShape.y + delta.y; } 
                     else if (origShape.type === 'circle') { updates.cx = origShape.cx + delta.x; updates.cy = origShape.cy + delta.y; }
                     updateShape(id, updates);
                });
                return;
            }

            const shape = shapes.find(s => s.id === shapeId);
            if (!shape) return;

            let updates: AnyShapePropertyUpdates = {};
            // For Resizing, we calculate new dimensions directly
            if (shape.type === 'line') {
                if (handleIndex === 0) updates.p1 = finalPos; else if (handleIndex === 1) updates.p2 = finalPos;
            } else if (shape.type === 'circle') {
                 if (handleIndex === 0) { updates.cx = finalPos.x; updates.cy = finalPos.y; }
                 else if (handleIndex > 0) { updates.r = distance({x: shape.cx, y: shape.cy}, finalPos); }
            } else if (shape.type === 'dimension') {
                 if (handleIndex === 0) updates.p1 = finalPos; else if (handleIndex === 1) updates.p2 = finalPos; else if (handleIndex === 3) updates.offsetPoint = finalPos;
            } else if (shape.type === 'rectangle') {
                const orig = originalShape as Rectangle;
                if (handleIndex === 8) { // Center
                     updates.x = finalPos.x - orig.width / 2; updates.y = finalPos.y - orig.height / 2;
                } else {
                     const origCorners = [ { x: orig.x, y: orig.y }, { x: orig.x + orig.width, y: orig.y }, { x: orig.x + orig.width, y: orig.y + orig.height }, { x: orig.x, y: orig.y + orig.height } ];
                     const oppositeIndex = (handleIndex + 2) % 4;
                     if (handleIndex >= 0 && handleIndex <= 3) {
                          const fixedPoint = origCorners[oppositeIndex];
                          const newX = Math.min(fixedPoint.x, finalPos.x); const newY = Math.min(fixedPoint.y, finalPos.y);
                          const newW = Math.abs(fixedPoint.x - finalPos.x); const newH = Math.abs(fixedPoint.y - finalPos.y);
                          updates = { x: newX, y: newY, width: newW, height: newH };
                     }
                }
            } else if (shape.type === 'symbol') {
                if (handleIndex === 0) { updates.x = finalPos.x; updates.y = finalPos.y; } 
                else {
                    const center = { x: (originalShape as SymbolShape).x, y: (originalShape as SymbolShape).y };
                    const dist = distance(center, finalPos); const newSize = dist * Math.sqrt(2);
                    if (Number.isFinite(newSize) && newSize > 0) updates.size = Math.max(5, newSize);
                }
            }
            if (Object.keys(updates).length > 0) updateShape(shapeId, updates);
            return;
        }

        if (isInteractingRef.current) {
            if (activeTool === 'copy-area' && selectionRect) {
                setSelectionRect({ ...selectionRect, width: worldPos.x - selectionRect.x, height: worldPos.y - selectionRect.y });
            } else if (activeTool === 'select' && selectionRect) {
                 setSelectionRect({ ...selectionRect, width: worldPos.x - selectionRect.x, height: worldPos.y - selectionRect.y });
            } else if (currentShape) {
                 if(currentShape.type === 'line') { const constrained = applyConstraints(currentShape.p1!, finalPos, e.shiftKey); setCurrentShape({ ...currentShape, p2: constrained }); }
                 else if (currentShape.type === 'rectangle') {
                      const start = {x: currentShape.x!, y: currentShape.y!};
                      let w = finalPos.x - start.x; let h = finalPos.y - start.y;
                      if(e.shiftKey) { const max = Math.max(Math.abs(w), Math.abs(h)); w = w<0?-max:max; h = h<0?-max:max; }
                      setCurrentShape({ ...currentShape, width: w, height: h });
                 } else if (currentShape.type === 'circle') {
                      setCurrentShape({ ...currentShape, r: distance({x: currentShape.cx!, y: currentShape.cy!}, finalPos) });
                 }
            }
        }
    };

    const isShapeInBounds = (shape: AnyShape, bounds: Rectangle): boolean => {
        const isPointInBounds = (p: Point) => p.x >= bounds.x && p.x <= bounds.x + bounds.width && p.y >= bounds.y && p.y <= bounds.y + bounds.height;
        switch (shape.type) {
            case 'line': return isPointInBounds(shape.p1) && isPointInBounds(shape.p2);
            case 'rectangle': {
                const corners = [ { x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y }, { x: shape.x, y: shape.y + shape.height }, { x: shape.x + shape.width, y: shape.y + shape.height }, ];
                return corners.every(isPointInBounds);
            }
            case 'circle': {
                const circleBounds = { x1: shape.cx - shape.r, y1: shape.cy - shape.r, x2: shape.cx + shape.r, y2: shape.cy + shape.r };
                return circleBounds.x1 >= bounds.x && circleBounds.x2 <= bounds.x + bounds.width && circleBounds.y1 >= bounds.y && circleBounds.y2 <= bounds.y + bounds.height;
            }
            case 'dimension': return isPointInBounds(shape.p1) && isPointInBounds(shape.p2);
            case 'text': return isPointInBounds({x: shape.x, y: shape.y});
            case 'symbol': return isPointInBounds({x: shape.x, y: shape.y});
            default: return false;
        }
    };

    const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
        try { if (e.currentTarget && e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { }
        
        // If we released the mouse and barely moved (less than threshold)
        if (activeTool === 'select' && dragStartScreenPos && !draggingHandle && !selectionRect) {
             // This was a CLICK, not a drag
             const startWorld = screenToWorld(dragStartScreenPos);
             const hitId = getHitTest(startWorld, 5 / viewTransform.scale);
             
             if (hitId) {
                 if (e.shiftKey) {
                     const newSet = new Set(highlightedShapeIds);
                     if (newSet.has(hitId)) newSet.delete(hitId); else newSet.add(hitId);
                     setHighlightedShapeIds(newSet);
                     // If only one left, select it primary
                     if (newSet.size === 1) setSelectedShapeId(Array.from(newSet)[0]);
                 } else {
                     setSelectedShapeId(hitId); setHighlightedShapeIds(new Set([hitId]));
                 }
             } else {
                 // Clicked empty space
                 setSelectedShapeId(null); setHighlightedShapeIds(new Set());
             }
        }

        if (activeTool === 'move' && moveBasePoint) return;
        
        if ((activeTool === 'rotate' || draggingHandle?.handleIndex === 'rotate') && rotateState && selectedShapeId) {
             const currentAngle = angle(subtract(worldMousePos, rotateState.center));
             const deltaAngle = currentAngle - rotateState.startAngle;
             const shape = shapes.find(s => s.id === selectedShapeId);
             if (shape) {
                 const updates: AnyShapePropertyUpdates = {};
                 if (shape.type === 'rectangle' || shape.type === 'symbol' || shape.type === 'text') {
                     updates.rotation = (rotateState.initialRotation + deltaAngle) % 360;
                 } else if ((shape.type === 'line' || shape.type === 'dimension') && rotateState.originalShape) {
                      const orig = rotateState.originalShape as (Line | Dimension);
                      const rotateP = (p: Point) => rotatePoint(p, rotateState.center, deltaAngle);
                      updates.p1 = rotateP(orig.p1); updates.p2 = rotateP(orig.p2);
                      if (shape.type === 'dimension' && 'offsetPoint' in orig) updates.offsetPoint = rotateP((orig as Dimension).offsetPoint);
                 }
                 if (Object.keys(updates).length > 0) updateShape(selectedShapeId, updates);
             }
             setRotateState(null); if (draggingHandle?.handleIndex === 'rotate') setDraggingHandle(null);
             return;
        }

        if (activeTool === 'dimension' && dimensionStep === 2) return;

        // Finalize Box Selection
        if ((activeTool === 'copy-area' || activeTool === 'select') && selectionRect) {
             const normalizedRect = {
                x: selectionRect.width < 0 ? selectionRect.x + selectionRect.width : selectionRect.x,
                y: selectionRect.height < 0 ? selectionRect.y + selectionRect.height : selectionRect.y,
                width: Math.abs(selectionRect.width), height: Math.abs(selectionRect.height),
            };
            if (normalizedRect.width > 1 && normalizedRect.height > 1) {
                const shapesToProcess = shapes.filter(s => isShapeInBounds(s, normalizedRect as Rectangle));
                if (shapesToProcess.length > 0) {
                    if (activeTool === 'copy-area') {
                        setClipboard({ shapes: shapesToProcess, origin: { x: normalizedRect.x + normalizedRect.width / 2, y: normalizedRect.y + normalizedRect.height / 2 } });
                        setHighlightedShapeIds(new Set(shapesToProcess.map(s => s.id)));
                    } else {
                        // Select Tool - Multi Select
                        setHighlightedShapeIds(new Set(shapesToProcess.map(s => s.id)));
                        if(shapesToProcess.length === 1) setSelectedShapeId(shapesToProcess[0].id);
                    }
                }
            } else if (activeTool === 'select' && !dragStartScreenPos) {
                 // Tiny selection box usually means clear selection
                 setSelectedShapeId(null); setHighlightedShapeIds(new Set());
            }
            setSelectionRect(null); 
            if (activeTool === 'copy-area') setActiveTool('select');
        }

        isInteractingRef.current = false; setPanStart(null); setDraggingHandle(null); setDragStartPos(null); setDragStartScreenPos(null);

        if (currentShape && activeTool !== 'dimension') {
            if (currentShape.type === 'line' && distance(currentShape.p1!, currentShape.p2!) > 0.1) addShape(currentShape as Omit<Line, 'id'>);
            else if (currentShape.type === 'rectangle' && currentShape.width! !== 0 && currentShape.height! !== 0) {
                 const newRect: Omit<Rectangle, 'id'> = { 
                     type: 'rectangle', 
                     x: currentShape.width! < 0 ? currentShape.x! + currentShape.width! : currentShape.x!, 
                     y: currentShape.height! < 0 ? currentShape.y! + currentShape.height! : currentShape.y!, 
                     width: Math.abs(currentShape.width!), 
                     height: Math.abs(currentShape.height!), 
                     properties: currentShape.properties as DrawingProperties, 
                     rotation: 0 
                 };
                 addShape(newRect);
            } else if (currentShape.type === 'circle' && currentShape.r! > 0.1) addShape(currentShape as Omit<Circle, 'id'>);
        }
        if (activeTool !== 'dimension' || dimensionStep !== 2) setCurrentShape(null);
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if(e.ctrlKey) e.preventDefault(); // Prevent browser zoom
        const rect = e.currentTarget.getBoundingClientRect();
        const localMousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        
        // Smooth Zoom Logic
        const zoomFactor = 1 - Math.sign(e.deltaY) * 0.1;
        const prevTransform = viewTransform;
        const newScale = Math.min(Math.max(prevTransform.scale * zoomFactor, 0.05), 200);
        
        const ratio = newScale / prevTransform.scale;
        const newX = localMousePos.x - (localMousePos.x - prevTransform.x) * ratio;
        const newY = localMousePos.y - (localMousePos.y - prevTransform.y) * ratio;
        
        setViewTransform({ scale: newScale, x: newX, y: newY });
    };
    
    const cursor = panStart ? 'grabbing' : activeTool === 'pan' ? 'grab' : activeTool === 'select' ? 'default' : (activeTool === 'copy-area' || activeTool === 'trim' || activeTool === 'extend') ? 'crosshair' : activeTool === 'text' ? 'text' : activeTool === 'paste' ? 'copy' : activeTool === 'move' ? 'default' : activeTool === 'rotate' ? 'alias' : 'none';

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
                    
                    {/* Render Template Image - BELOW GRID */}
                    {templateImage && templateImage.isVisible && (
                         <image
                            href={templateImage.data}
                            x={templateImage.x}
                            y={templateImage.y}
                            width={templateImage.width}
                            height={templateImage.height}
                            opacity={templateImage.opacity}
                            preserveAspectRatio="none"
                        />
                    )}
                    
                    <rect width="50000" height="50000" x="-25000" y="-25000" fill="url(#grid)" />
                     <circle cx="0" cy="0" r={3 / viewTransform.scale} fill="red" />
                    
                    {shapes.map(shape => {
                        if (selectedShapeId === shape.id) {
                            if (activeTool === 'rotate' && rotateState) return null;
                            if (activeTool === 'move' && moveBasePoint && highlightedShapeIds.has(shape.id)) return <ShapeRenderer key={shape.id} shape={shape} isSelected={true} conversionFactor={conversionFactor} isGhost={true} />;
                            if (activeTool === 'move' && moveBasePoint && !highlightedShapeIds.has(shape.id)) return <ShapeRenderer key={shape.id} shape={shape} isSelected={true} conversionFactor={conversionFactor} isGhost={true} />;
                            if (draggingHandle?.handleIndex === 'rotate' && rotateState) return null;
                        }
                        const isHighlighted = highlightedShapeIds.has(shape.id);
                        if (draggingHandle?.handleIndex === 'move' && highlightedShapeIds.has(shape.id)) return <ShapeRenderer key={shape.id} shape={shape} isSelected={shape.id === selectedShapeId} isHighlighted={true} conversionFactor={conversionFactor} isGhost={true} />;
                        if (activeTool === 'move' && moveBasePoint && isHighlighted) return <ShapeRenderer key={shape.id} shape={shape} isSelected={shape.id === selectedShapeId} isHighlighted={true} conversionFactor={conversionFactor} isGhost={true} />;

                        return <ShapeRenderer key={shape.id} shape={shape} isSelected={shape.id === selectedShapeId} isHighlighted={isHighlighted} conversionFactor={conversionFactor} />
                    })}

                    {currentShape && <ShapeRenderer shape={currentShape as AnyShape} isSelected={false} conversionFactor={conversionFactor} />}
                    
                     {hoveredShapeId && (() => {
                         const shape = shapes.find(s => s.id === hoveredShapeId); if (!shape) return null;
                         return getShapeSnapPoints(shape).map((sp, i) => ( <circle key={i} cx={sp.point.x} cy={sp.point.y} r={5 / viewTransform.scale} fill="cyan" fillOpacity="0.5" /> ));
                     })()}
                    
                    {selectedShapeId && (() => { const s=shapes.find(x=>x.id===selectedShapeId); return s ? getShapeSnapPoints(s).map((sp, i) => (<circle key={`node-${i}`} cx={sp.point.x} cy={sp.point.y} r={5 / viewTransform.scale} fill="white" stroke="#00A8FF" strokeWidth={1.5 / viewTransform.scale} />)) : null })()}

                    {activeSnapPoint && ( <g> <circle cx={activeSnapPoint.point.x} cy={activeSnapPoint.point.y} r={8 / viewTransform.scale} fill="magenta" fillOpacity="0.7"/> <circle cx={activeSnapPoint.point.x} cy={activeSnapPoint.point.y} r={1.5 / viewTransform.scale} fill="white"/> </g> )}
                    
                    {inferenceLines.map((line, i) => ( <line key={i} x1={line.p1.x} y1={line.p1.y} x2={line.p2.x} y2={line.p2.y} stroke="green" strokeWidth={0.5 / viewTransform.scale} strokeDasharray={`${4/viewTransform.scale}`} /> ))}

                    {selectionRect && (() => {
                         // Normalization for Selection Box
                         const rX = selectionRect.width < 0 ? selectionRect.x + selectionRect.width : selectionRect.x;
                         const rY = selectionRect.height < 0 ? selectionRect.y + selectionRect.height : selectionRect.y;
                         const rW = Math.abs(selectionRect.width);
                         const rH = Math.abs(selectionRect.height);
                         return <rect x={rX} y={rY} width={rW} height={rH} fill="rgba(0, 168, 255, 0.2)" stroke="rgba(0, 168, 255, 0.8)" strokeWidth={1 / viewTransform.scale} strokeDasharray={`4 ${2 / viewTransform.scale}`} />;
                    })()}

                    {activeTool === 'trim' && hoveredTrimSegment && (() => {
                         const { geometry } = hoveredTrimSegment; const s = 4 / viewTransform.scale;
                         if (geometry.type === 'line') {
                             const p1 = geometry.p1; const p2 = geometry.p2; const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
                             return ( <g> <line key="trim-hover" x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="red" strokeWidth={4 / viewTransform.scale} strokeLinecap="round" opacity="0.7" /> <line x1={midX - s} y1={midY - s} x2={midX + s} y2={midY + s} stroke="white" strokeWidth={2 / viewTransform.scale} /> <line x1={midX + s} y1={midY - s} x2={midX - s} y2={midY + s} stroke="white" strokeWidth={2 / viewTransform.scale} /> </g> );
                         } else {
                             const { cx, cy, r, startAngle, endAngle } = geometry;
                             const effectiveStart = startAngle; let effectiveEnd = endAngle; if (endAngle < startAngle) effectiveEnd += 360;
                             const midRad = ((effectiveStart + effectiveEnd) / 2) * Math.PI / 180; const midX = cx + r * Math.cos(midRad); const midY = cy - r * Math.sin(midRad); 
                             return ( <g> <path d={describeArc(cx, cy, r, startAngle, endAngle)} stroke="red" strokeWidth={4 / viewTransform.scale} fill="none" opacity="0.7" /> <line x1={midX - s} y1={midY - s} x2={midX + s} y2={midY + s} stroke="white" strokeWidth={2 / viewTransform.scale} /> <line x1={midX + s} y1={midY - s} x2={midX - s} y2={midY + s} stroke="white" strokeWidth={2 / viewTransform.scale} /> </g> )
                         }
                    })()}

                    {activeTool === 'extend' && hoveredExtendPreview && (() => {
                         const { originalShape, newEndpoint, endToUpdate } = hoveredExtendPreview; const start = endToUpdate === 'p1' ? originalShape.p1 : originalShape.p2;
                         return ( <g> <line x1={start.x} y1={start.y} x2={newEndpoint.x} y2={newEndpoint.y} stroke="lime" strokeWidth={2 / viewTransform.scale} strokeDasharray={`${4/viewTransform.scale}`} /> <circle cx={newEndpoint.x} cy={newEndpoint.y} r={4 / viewTransform.scale} fill="lime" /> </g> )
                    })()}

                    {activeTool === 'dimension' && hoveredDimensionTarget && hoveredDimensionTarget.type === 'segment' && ( <line x1={hoveredDimensionTarget.p1.x} y1={hoveredDimensionTarget.p1.y} x2={hoveredDimensionTarget.p2.x} y2={hoveredDimensionTarget.p2.y} stroke="cyan" strokeWidth={2 / viewTransform.scale} strokeDasharray={`${4/viewTransform.scale}`} /> )}
                    
                    {activeTool === 'dimension' && hoveredDimensionTarget && hoveredDimensionTarget.type === 'circle' && ( <circle cx={hoveredDimensionTarget.p1.x} cy={hoveredDimensionTarget.p1.y} r={distance(hoveredDimensionTarget.p1, hoveredDimensionTarget.p2)} fill="none" stroke="cyan" strokeWidth={2 / viewTransform.scale} strokeDasharray={`${4/viewTransform.scale}`} /> )}

                    {activeTool === 'paste' && clipboard && clipboard.shapes.map(shape => {
                        const translation = subtract(worldMousePos, clipboard.origin); const newShape: AnyShape = JSON.parse(JSON.stringify(shape));
                         if (newShape.type === 'line' || newShape.type === 'dimension') { newShape.p1 = add(newShape.p1, translation); newShape.p2 = add(newShape.p2, translation); if(newShape.type === 'dimension') newShape.offsetPoint = add(newShape.offsetPoint, translation); } else if (newShape.type === 'rectangle' || newShape.type === 'text' || newShape.type === 'symbol') { newShape.x += translation.x; newShape.y += translation.y; } else if (newShape.type === 'circle') { newShape.cx += translation.x; newShape.cy += translation.y; }
                        return <ShapeRenderer key={'preview-' + shape.id} shape={newShape} isSelected={false} conversionFactor={conversionFactor} isPreview={true} />
                    })}
                    
                    {(draggingHandle?.handleIndex === 'move' && draggingHandle.groupOriginals && dragStartPos) ? (() => {
                         const handle = draggingHandle!;
                         const currentPos = activeSnapPoint ? activeSnapPoint.point : worldMousePos; 
                         const delta = subtract(currentPos, dragStartPos); 
                         const groupOriginals = handle.groupOriginals as Record<string, AnyShape>;
                         return Object.entries(groupOriginals).map(([id, origShape]) => {
                            const shape = origShape as AnyShape; 
                            const previewShape = JSON.parse(JSON.stringify(shape)) as AnyShape;

                            if (previewShape.type === 'line') { 
                                previewShape.p1 = add(previewShape.p1, delta); 
                                previewShape.p2 = add(previewShape.p2, delta); 
                            } else if (previewShape.type === 'dimension') { 
                                previewShape.p1 = add(previewShape.p1, delta); 
                                previewShape.p2 = add(previewShape.p2, delta); 
                                previewShape.offsetPoint = add(previewShape.offsetPoint, delta); 
                            } else if (previewShape.type === 'rectangle' || previewShape.type === 'text' || previewShape.type === 'symbol') { 
                                previewShape.x += delta.x; 
                                previewShape.y += delta.y; 
                            } else if (previewShape.type === 'circle') { 
                                previewShape.cx += delta.x; 
                                previewShape.cy += delta.y; 
                            }
                            return <ShapeRenderer key={'preview-drag-' + id} shape={previewShape} isSelected={false} conversionFactor={conversionFactor} isPreview={true} />
                         });
                    })() : null}

                    {(activeTool === 'move' && moveBasePoint) ? (() => {
                        const snapPos = activeSnapPoint ? activeSnapPoint.point : worldMousePos; 
                        const delta = subtract(snapPos, moveBasePoint); 
                        const idsToPreview = highlightedShapeIds.size > 0 ? Array.from(highlightedShapeIds) : (selectedShapeId ? [selectedShapeId] : []);
                        return idsToPreview.map(id => {
                            const original = shapes.find(s => s.id === id); 
                            if (!original) return null;
                            const previewShape = JSON.parse(JSON.stringify(original)) as AnyShape;

                            if (previewShape.type === 'line' || previewShape.type === 'dimension') { 
                                previewShape.p1 = add(previewShape.p1, delta); 
                                previewShape.p2 = add(previewShape.p2, delta); 
                                if (previewShape.type === 'dimension') {
                                    previewShape.offsetPoint = add(previewShape.offsetPoint, delta); 
                                }
                            } else if (previewShape.type === 'rectangle' || previewShape.type === 'text' || previewShape.type === 'symbol') { 
                                previewShape.x += delta.x; 
                                previewShape.y += delta.y; 
                            } else if (previewShape.type === 'circle') { 
                                previewShape.cx += delta.x; 
                                previewShape.cy += delta.y; 
                            }
                            return <ShapeRenderer key={'preview-trans-' + id} shape={previewShape} isSelected={false} conversionFactor={conversionFactor} isPreview={true} />
                        });
                    })() : null}
                    
                    {((activeTool === 'rotate' || draggingHandle?.handleIndex === 'rotate') && rotateState && selectedShapeId) ? (() => {
                         const s = shapes.find(x=>x.id===selectedShapeId); if(!s) return null;
                         const previewShape: AnyShape = JSON.parse(JSON.stringify(s));
                         const currentAngle = angle(subtract(worldMousePos, rotateState.center));
                         const deltaAngle = currentAngle - rotateState.startAngle;
                         if (previewShape.type === 'rectangle' || previewShape.type === 'symbol' || previewShape.type === 'text') { previewShape.rotation = (rotateState.initialRotation + deltaAngle) % 360; } else if (previewShape.type === 'line' || previewShape.type === 'dimension') { const orig = rotateState.originalShape as (Line | Dimension); const rotateP = (p: Point) => rotatePoint(p, rotateState.center, deltaAngle); previewShape.p1 = rotateP(orig.p1); previewShape.p2 = rotateP(orig.p2); if (previewShape.type === 'dimension' && 'offsetPoint' in orig) previewShape.offsetPoint = rotateP((orig as Dimension).offsetPoint); }
                         return <ShapeRenderer key={'preview-rot'} shape={previewShape} isSelected={false} conversionFactor={conversionFactor} isPreview={true} />
                    })() : null}
                </g>
            </svg>
            <div className="pointer-events-none absolute inset-0">
                {cursor === 'none' && ( <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}> <rect x={mousePosition.x - 10} y={mousePosition.y - 10} width="20" height="20" fill="none" stroke="white" strokeWidth="0.5" /> <line x1={mousePosition.x} y1={0} x2={mousePosition.x} y2={5000} stroke="white" strokeWidth="0.5" /> <line x1={0} y1={mousePosition.y} x2={5000} y2={mousePosition.y} stroke="white" strokeWidth="0.5" /> </svg> )}
                {(isInteractingRef.current && (currentShape?.type === 'line' || currentShape?.type === 'dimension') && currentShape.p1) && ( <div className="absolute px-2 py-1 bg-blue-600 text-white text-xs rounded" style={{ left: mousePosition.x + 20, top: mousePosition.y + 20 }}> {`L: ${(distance(currentShape.p1!, worldMousePos) / conversionFactor).toFixed(2)} ${unit} | A: ${angleBetween(currentShape.p1!, worldMousePos).toFixed(2)}°`} </div> )}
                {selectedShapeId && (() => { const s=shapes.find(x=>x.id===selectedShapeId); if(s && (s.type === 'line' || s.type === 'dimension')) return ( <div className="absolute px-2 py-1 bg-blue-600 text-white text-xs rounded" style={{ left: (s.p1.x + s.p2.x)/2 * viewTransform.scale + viewTransform.x + 10, top: (s.p1.y + s.p2.y)/2 * viewTransform.scale + viewTransform.y + 10, }}> {`L: ${(distance(s.p1, s.p2) / conversionFactor).toFixed(2)} ${unit} | A: ${angleBetween(s.p1, s.p2).toFixed(2)}°`} </div> ); })()}
                {rotateState && ( <div className="absolute px-2 py-1 bg-purple-600 text-white text-xs rounded" style={{ left: mousePosition.x + 20, top: mousePosition.y + 20 }}> {`Rot: ${((angle(subtract(worldMousePos, rotateState.center)) - rotateState.startAngle + rotateState.initialRotation + 360) % 360).toFixed(1)}°`} {rotateState.center && ( <svg width="100%" height="100%" style={{ position: 'absolute', top: -mousePosition.y - 20, left: -mousePosition.x - 20 }}> <line x1={(rotateState.center.x * viewTransform.scale) + viewTransform.x} y1={(rotateState.center.y * viewTransform.scale) + viewTransform.y} x2={mousePosition.x + 20} y2={mousePosition.y + 20} stroke="purple" strokeWidth="1" strokeDasharray="4 2" /> </svg> )} </div> )}
                 <div className="absolute bottom-2 right-2 text-xs text-dark-base-content/60 bg-dark-base-100/50 px-2 py-1 rounded"> {`${(worldMousePos.x / conversionFactor).toFixed(2)} ${unit}, ${(worldMousePos.y / conversionFactor).toFixed(2)} ${unit}`} </div>
            </div>
        </div>
    );
};

export default Canvas;
