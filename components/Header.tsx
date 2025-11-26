
import React, { useState, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { SnapMode, Unit, LineType } from '../types';
import { CheckIcon, SaveIcon, FilePlusIcon, FolderOpenIcon, DownloadIcon, XIcon, ImageIcon, EyeIcon, EyeOffIcon, SettingsIcon, TrashIcon } from './Icon';
import { jsPDF } from "jspdf";

const SnapToggle: React.FC<{ label: string, mode: SnapMode }> = ({ label, mode }) => {
    const { snapModes, toggleSnapMode } = useAppContext();
    const isActive = snapModes.has(mode);
    return (
        <button
            onClick={() => toggleSnapMode(mode)}
            className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-2 transition-colors ${
                isActive ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300 dark:bg-dark-base-300 dark:hover:bg-dark-base-200'
            }`}
        >
            {label}
            {isActive && <CheckIcon className="w-3 h-3" />}
        </button>
    );
};

// Helper to escape XML characters for SVG text
const escapeXml = (unsafe: string | null | undefined) => {
    if (unsafe == null) return '';
    return String(unsafe).replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

// Helper for stroke dash array export
const getStrokeDashArray = (lineType: LineType | undefined): string => {
    switch (lineType) {
        case 'dashed': return 'stroke-dasharray="10 5"';
        case 'dotted': return 'stroke-dasharray="2 4"';
        case 'dash-dot': return 'stroke-dasharray="10 4 2 4"';
        default: return '';
    }
};

// --- Arc Export Helpers ---
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

const Header: React.FC = () => {
    const { unit, setUnit, isOrthoMode, setIsOrthoMode, shapes, replaceShapes, createNewDrawing, viewTransform, setViewTransform, templateImage, setTemplateImage, updateTemplateImage } = useAppContext();
    const units: Unit[] = ['mm', 'cm', 'm'];
    
    const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
    const [currentFileName, setCurrentFileName] = useState('dibujo_sin_titulo.json');
    
    // --- Modals State ---
    const [showNewDrawingModal, setShowNewDrawingModal] = useState(false);
    const [showSaveAsModal, setShowSaveAsModal] = useState(false);
    const [saveAsName, setSaveAsName] = useState('');
    const [showTemplateSettingsModal, setShowTemplateSettingsModal] = useState(false);

    const [showExportModal, setShowExportModal] = useState(false);
    
    // Export Configuration
    const [exportConfig, setExportConfig] = useState<{
        format: 'png' | 'jpg' | 'pdf' | 'svg', 
        scope: 'extents' | 'viewport',
        theme: 'dark' | 'light',
        optimizeLines: boolean,
        paperSize: 'A4' | 'Letter' | 'Legal'
    }>({
        format: 'png',
        scope: 'extents',
        theme: 'light', // Default to light for printable exports usually
        optimizeLines: true,
        paperSize: 'A4'
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const templateInputRef = useRef<HTMLInputElement>(null);

    // --- Scales Configuration ---
    const scales = [
        { label: '10:1', value: 10 },
        { label: '5:1', value: 5 },
        { label: '2:1', value: 2 },
        { label: '1:1', value: 1 },
        { label: '1:2', value: 0.5 },
        { label: '1:5', value: 0.2 },
        { label: '1:10', value: 0.1 },
        { label: '1:20', value: 0.05 },
        { label: '1:50', value: 0.02 },
        { label: '1:100', value: 0.01 },
    ];

    // Determine active scale for dropdown
    const currentScaleValue = scales.find(s => Math.abs(s.value - viewTransform.scale) < 0.001)?.value.toString() || 'custom';

    const handleScaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val !== 'custom') {
            setViewTransform(prev => ({ ...prev, scale: parseFloat(val) }));
        }
    };

    // --- File Operations ---

    const handleNew = () => {
        if (shapes.length > 0) {
            setShowNewDrawingModal(true);
        } else {
            createNewDrawing();
            setCurrentFileName('dibujo_sin_titulo.json');
        }
        setIsFileMenuOpen(false);
    };

    const confirmNewDrawing = () => {
        createNewDrawing();
        setCurrentFileName('dibujo_sin_titulo.json');
        setShowNewDrawingModal(false);
    };

    const downloadFile = (fileName: string, content: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a); // Append to body for FF support
        a.click();
        document.body.removeChild(a); // Cleanup
        URL.revokeObjectURL(url);
    };

    // Quick Save (Overwrite logic / Download current)
    const handleSave = () => {
        const data = JSON.stringify(shapes, null, 2);
        // Ensure extension exists
        const fileName = currentFileName.endsWith('.json') ? currentFileName : `${currentFileName}.json`;
        downloadFile(fileName, data, 'application/json');
        
        // Sync state if extension was added
        if (fileName !== currentFileName) {
            setCurrentFileName(fileName);
        }
        setIsFileMenuOpen(false);
    };

    // Trigger Save As Modal
    const initiateSaveAs = () => {
        setSaveAsName(currentFileName.replace('.json', ''));
        setShowSaveAsModal(true);
        setIsFileMenuOpen(false);
    };

    // Confirm Save As
    const performSaveAs = (e: React.FormEvent) => {
        e.preventDefault();
        const name = saveAsName.trim() || 'sin_titulo';
        const finalName = name.endsWith('.json') ? name : `${name}.json`;
        setCurrentFileName(finalName);
        const data = JSON.stringify(shapes, null, 2);
        downloadFile(finalName, data, 'application/json');
        setShowSaveAsModal(false);
    };

    const handleOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const importedShapes = JSON.parse(content);
                
                if (Array.isArray(importedShapes)) {
                    const shapesToAdd = importedShapes.map(({ id, ...rest }) => rest);
                    replaceShapes(shapes.map(s => s.id), shapesToAdd);
                    setCurrentFileName(file.name);
                } else {
                    alert('El archivo no tiene un formato válido.');
                }
            } catch (err) {
                console.error(err);
                alert('Error al leer el archivo.');
            }
        };
        reader.readAsText(file);
        setIsFileMenuOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- Template Image Logic ---

    const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const img = new Image();
            img.onload = () => {
                setTemplateImage({
                    id: `tpl-${Date.now()}`,
                    data: dataUrl,
                    x: 0,
                    y: 0,
                    width: img.width,
                    height: img.height,
                    opacity: 0.5,
                    isVisible: true,
                    fileName: file.name
                });
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        setIsFileMenuOpen(false);
        if (templateInputRef.current) templateInputRef.current.value = '';
    };

    // --- Export Logic ---

    const initiateExport = () => {
        if (shapes.length === 0) {
            alert('No hay elementos para exportar.');
            setIsFileMenuOpen(false);
            return;
        }
        // Standard defaults
        setExportConfig(prev => ({ 
            ...prev, 
            theme: 'light',
            optimizeLines: true
        }));
        setShowExportModal(true);
        setIsFileMenuOpen(false);
    }

    const generateSvgString = (config: typeof exportConfig) => {
        if (shapes.length === 0) return null;

        // 1. Determine Drawing Extents (Geometric Content)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasShapes = false;
        
        // Always export all shapes for PDF/TitleBlock to avoid cutting off parts of the drawing
        const visibleShapes = shapes;

        visibleShapes.forEach(s => {
            hasShapes = true;
            // Include estimated stroke width to avoid clipping thick lines
            const stroke = s.properties.strokeWidth || 1;
            const halfStroke = stroke / 2;

            if (s.type === 'line' || s.type === 'dimension') {
                const minSx = Math.min(s.p1.x, s.p2.x) - halfStroke;
                const maxSx = Math.max(s.p1.x, s.p2.x) + halfStroke;
                const minSy = Math.min(s.p1.y, s.p2.y) - halfStroke;
                const maxSy = Math.max(s.p1.y, s.p2.y) + halfStroke;

                if(Number.isFinite(minSx)) { minX = Math.min(minX, minSx); maxX = Math.max(maxX, maxSx); }
                if(Number.isFinite(minSy)) { minY = Math.min(minY, minSy); maxY = Math.max(maxY, maxSy); }
                
                if (s.type === 'dimension' && s.offsetPoint) {
                     minX = Math.min(minX, s.offsetPoint.x - 20); maxX = Math.max(maxX, s.offsetPoint.x + 20);
                     minY = Math.min(minY, s.offsetPoint.y - 10); maxY = Math.max(maxY, s.offsetPoint.y + 10);
                }

            } else if (s.type === 'rectangle' || s.type === 'title_block') {
                let rx = s.x, ry = s.y, rw = s.width, rh = s.height;
                // Handle negative width/height normalization
                if (rw < 0) { rx += rw; rw = Math.abs(rw); }
                if (rh < 0) { ry += rh; rh = Math.abs(rh); }
                
                if(Number.isFinite(rx) && Number.isFinite(rw)) { minX = Math.min(minX, rx - halfStroke); maxX = Math.max(maxX, rx + rw + halfStroke); }
                if(Number.isFinite(ry) && Number.isFinite(rh)) { minY = Math.min(minY, ry - halfStroke); maxY = Math.max(maxY, ry + rh + halfStroke); }

            } else if (s.type === 'circle') {
                if(Number.isFinite(s.cx) && Number.isFinite(s.r)) { 
                    minX = Math.min(minX, s.cx - s.r - halfStroke); maxX = Math.max(maxX, s.cx + s.r + halfStroke);
                    minY = Math.min(minY, s.cy - s.r - halfStroke); maxY = Math.max(maxY, s.cy + s.r + halfStroke);
                }
            } else if (s.type === 'text') {
                 const widthEst = (s.content.length * s.fontSize * 0.6);
                 minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x + widthEst); 
                 minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y + s.fontSize);
            } else if (s.type === 'symbol') {
                const halfSize = s.size / 2;
                minX = Math.min(minX, s.x - halfSize); maxX = Math.max(maxX, s.x + halfSize);
                minY = Math.min(minY, s.y - halfSize); maxY = Math.max(maxY, s.y + halfSize);
            }
        });

        if (!hasShapes || !Number.isFinite(minX) || !Number.isFinite(maxX)) return null;

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        // --- PAPER SPACE LOGIC ---
        let finalSVGWidth, finalSVGHeight, viewBoxStr, contentTransform = '';
        let fitScale = 1;

        if (config.format === 'pdf') {
            // Define Paper Dimensions
            // Using a high pixel density scale (approx 4 pixels per mm for calculation)
            const P_SCALE = 5; 
            const papers = {
                'A4': { w: 297 * P_SCALE, h: 210 * P_SCALE }, // Landscape
                'Letter': { w: 279 * P_SCALE, h: 216 * P_SCALE },
                'Legal': { w: 356 * P_SCALE, h: 216 * P_SCALE },
            };
            const paper = papers[config.paperSize];
            
            finalSVGWidth = paper.w;
            finalSVGHeight = paper.h;
            viewBoxStr = `0 0 ${paper.w} ${paper.h}`;

            // --- LAYOUT ---
            const margin = 10 * P_SCALE; 
            
            // Viewport Area for Drawing
            const viewPortX = margin;
            const viewPortY = margin;
            const viewPortW = paper.w - (margin * 2);
            const viewPortH = paper.h - (margin * 2);

            // Calculate Fit Scale to contain the drawing within the viewport
            const scaleX = viewPortW / contentW;
            const scaleY = viewPortH / contentH;
            fitScale = Math.min(scaleX, scaleY) * 0.95; // 5% padding inside viewport

            // Center the drawing in the Viewport
            const scaledContentW = contentW * fitScale;
            const scaledContentH = contentH * fitScale;
            
            // Translate Logic:
            // 1. Shift drawing so minX,minY is at 0,0 (-minX, -minY)
            // 2. Scale it
            // 3. Move to center of viewport
            const offsetX = viewPortX + (viewPortW - scaledContentW) / 2;
            const offsetY = viewPortY + (viewPortH - scaledContentH) / 2;

            contentTransform = `translate(${offsetX} ${offsetY}) scale(${fitScale}) translate(${-minX} ${-minY})`;

        } else {
            // Raw Export (No Title Block / No PDF Layout)
            const padding = 50;
            const vbX = minX - padding;
            const vbY = minY - padding;
            const vbW = contentW + padding * 2;
            const vbH = contentH + padding * 2;
            finalSVGWidth = vbW;
            finalSVGHeight = vbH;
            viewBoxStr = `${vbX} ${vbY} ${vbW} ${vbH}`;
            contentTransform = ''; 
        }

        // --- GENERATE CONTENT SVG ---
        const bgColor = config.theme === 'dark' ? '#000000' : '#FFFFFF';
        const defaultStroke = config.theme === 'dark' ? '#FFFFFF' : '#000000';

        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxStr}" width="${finalSVGWidth}" height="${finalSVGHeight}">`;
        
        // Background
        if (config.format === 'pdf') {
             svgContent += `<rect x="0" y="0" width="${finalSVGWidth}" height="${finalSVGHeight}" fill="${bgColor}" />`;
        } else {
             const vbParts = viewBoxStr.split(' ');
             svgContent += `<rect x="${vbParts[0]}" y="${vbParts[1]}" width="${vbParts[2]}" height="${vbParts[3]}" fill="${bgColor}" />`;
        }
        
        svgContent += `
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="${defaultStroke}" />
            </marker>
        </defs>
        `;

        // Drawing Group
        svgContent += `<g transform="${contentTransform}">`;

        visibleShapes.forEach(s => {
            let color = s.properties.color || '#ffffff';
            // Auto-invert black/white based on theme
            if (config.theme === 'light') {
                if (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fff') color = '#000000';
            } else {
                if (color.toLowerCase() === '#000000' || color.toLowerCase() === '#000') color = '#ffffff';
            }

            let strokeWidth = s.properties.strokeWidth || 1;
            
            // Smart Stroke Compensation for PDF/Fit Scale
            if (config.optimizeLines && (config.format === 'pdf')) {
                 // The problem: if drawing is HUGE (e.g. 50000 units), fitScale is tiny (0.01).
                 // 1px stroke * 0.01 = 0.01px (invisible).
                 // We want minimum line width on PAPER to be ~0.5px or 1px.
                 
                 const minVisibleStrokeOnPaper = 1.0; // pixels on paper space
                 const scaledStroke = strokeWidth * fitScale;
                 
                 if (scaledStroke < minVisibleStrokeOnPaper) {
                      strokeWidth = minVisibleStrokeOnPaper / fitScale;
                 }
            }

            const fill = s.properties.fill !== 'transparent' ? s.properties.fill : 'none';
            const dashArray = getStrokeDashArray(s.properties.lineType);

            if (s.type === 'line') {
                svgContent += `<line x1="${s.p1.x}" y1="${s.p1.y}" x2="${s.p2.x}" y2="${s.p2.y}" stroke="${color}" stroke-width="${strokeWidth}" ${dashArray} />`;
            } else if (s.type === 'rectangle') {
                const transform = s.rotation ? `rotate(${-s.rotation}, ${s.x + s.width/2}, ${s.y + s.height/2})` : '';
                svgContent += `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" stroke="${color}" stroke-width="${strokeWidth}" fill="${fill}" transform="${transform}" ${dashArray} />`;
            } else if (s.type === 'title_block') {
                 // Manual Title Block Rendering - Sync with Canvas.tsx Layout
                 const { x, y, width, height, data } = s;
                 
                 // --- REVISED LAYOUT ---
                 // Col 1: Logo/Company (25%)
                 // Col 2: Project Info (45%) -> Contains Project (Top), DrawnBy (Middle), CheckedBy (Bottom)
                 // Col 3: Tech Data (30%) -> Scale/Date (Top 50%), Sheet/Rev (Bottom 50%)
                 
                 const wCol1 = width * 0.25;
                 const wCol2 = width * 0.45;
                 const wCol3 = width * 0.30;
                 const xCol1 = x;
                 const xCol2 = x + wCol1;
                 const xCol3 = x + wCol1 + wCol2;
                 
                 const hProject = height * 0.4;
                 const hDrawn = height * 0.3;
                 const hChecked = height * 0.3;
                 
                 const yCol2Row1 = y; // Project
                 const yCol2Row2 = y + hProject; // Drawn By
                 const yCol2Row3 = y + hProject + hDrawn; // Checked By

                 const hCol3Row = height / 2;
                 const yCol3Row1 = y;
                 const yCol3Row2 = y + hCol3Row;

                 // Typography settings
                 const fontScale = s.fontScale || 1.0;
                 const letterSpacing = s.letterSpacing || 0;
                 const lineSpacingMult = s.lineSpacing || 1.0;

                 const labelSize = Math.max(height * 0.08, 1.5) * fontScale;
                 const valueSize = Math.max(height * 0.11, 2) * fontScale;
                 const valueYRatio = 0.3 + (0.55 * lineSpacingMult);
                 
                 const textBase = `fill="${color}" font-family="sans-serif" letter-spacing="${letterSpacing}"`;
                 const lineBase = `stroke="${color}" stroke-width="${strokeWidth}" fill="none"`;
                 
                 // Helper to match Canvas Cell Rendering
                 const renderCell = (bx: number, by: number, bw: number, bh: number, label: string, value: string, isTitle: boolean = false) => {
                     const lX = bx + (bw * 0.05);
                     const lY = by + (bh * 0.3);
                     const vX = bx + (bw * 0.05);
                     const vY = by + (bh * valueYRatio);
                     return `
                        <text x="${lX}" y="${lY}" ${textBase} font-size="${labelSize}" font-weight="bold">${escapeXml(label)}</text>
                        <text x="${vX}" y="${vY}" ${textBase} font-size="${isTitle ? valueSize * 1.2 : valueSize}" font-weight="${isTitle?"bold":"normal"}">${escapeXml(value)}</text>
                     `;
                 };

                 svgContent += `
                    <g>
                        <rect x="${x}" y="${y}" width="${width}" height="${height}" ${lineBase} />
                        <line x1="${xCol2}" y1="${y}" x2="${xCol2}" y2="${y+height}" ${lineBase} />
                        <line x1="${xCol3}" y1="${y}" x2="${xCol3}" y2="${y+height}" ${lineBase} />
                        
                        ${/* Col 1: Company */ ""}
                        <text x="${xCol1 + 5}" y="${y + 10}" ${textBase} font-size="${labelSize}" font-weight="bold">EMPRESA:</text>
                        <text x="${xCol1 + (wCol1/2)}" y="${y + (height/2) + (valueSize/3)}" text-anchor="middle" ${textBase} font-size="${valueSize * 1.2}" font-weight="bold">${escapeXml(data.company)}</text>
                        
                        ${/* Col 2 Horizontal Lines */ ""}
                        <line x1="${xCol2}" y1="${yCol2Row2}" x2="${xCol3}" y2="${yCol2Row2}" ${lineBase} />
                        <line x1="${xCol2}" y1="${yCol2Row3}" x2="${xCol3}" y2="${yCol2Row3}" ${lineBase} />

                        ${/* Col 2 Content */ ""}
                        ${renderCell(xCol2, yCol2Row1, wCol2, hProject, "PROYECTO:", data.project, true)}
                        ${renderCell(xCol2, yCol2Row2, wCol2, hDrawn, "REALIZÓ:", data.drawnBy)}
                        ${renderCell(xCol2, yCol2Row3, wCol2, hChecked, "REVISÓ:", data.checkedBy)}

                        ${/* Col 3 Grid Lines */ ""}
                        <line x1="${xCol3 + (wCol3/2)}" y1="${y}" x2="${xCol3 + (wCol3/2)}" y2="${y+height}" ${lineBase} />
                        <line x1="${xCol3}" y1="${yCol3Row2}" x2="${x+width}" y2="${yCol3Row2}" ${lineBase} />
                        
                        ${/* Col 3 Content */ ""}
                        ${renderCell(xCol3, yCol3Row1, wCol3/2, hCol3Row, "ESCALA:", data.scale)}
                        ${renderCell(xCol3 + wCol3/2, yCol3Row1, wCol3/2, hCol3Row, "FECHA:", data.date)}
                        
                        ${renderCell(xCol3, yCol3Row2, wCol3/2, hCol3Row, "PLANO:", data.sheet, true)}
                        ${renderCell(xCol3 + wCol3/2, yCol3Row2, wCol3/2, hCol3Row, "REV:", data.revision)}
                    </g>
                 `;
            } else if (s.type === 'circle') {
                if (s.startAngle !== undefined && s.endAngle !== undefined && Math.abs(s.endAngle - s.startAngle) < 359.9) {
                    const d = describeArc(s.cx, s.cy, s.r, s.startAngle, s.endAngle);
                    svgContent += `<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" ${dashArray} />`;
                } else {
                    svgContent += `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" stroke="${color}" stroke-width="${strokeWidth}" fill="${fill}" ${dashArray} />`;
                }
            } else if (s.type === 'text') {
                 // Text uses hanging baseline in Canvas, essential for correct positioning
                 const transform = s.rotation ? `rotate(${-s.rotation}, ${s.x}, ${s.y})` : '';
                 svgContent += `<text x="${s.x}" y="${s.y}" fill="${color}" font-size="${s.fontSize}" font-family="sans-serif" dominant-baseline="hanging" transform="${transform}">${escapeXml(s.content)}</text>`;
            } else if (s.type === 'symbol') {
                const rotation = s.rotation || 0;
                const size = s.size;
                // Symbols need stroke compensation too
                let symStroke = strokeWidth; 
                // Reset internal stroke to 1 before scaling, but keep proportion
                const transform = `translate(${s.x}, ${s.y}) rotate(${-rotation}) scale(${size/24}) translate(-12, -12)`;
                
                // Scale inner strokes relative to symbol size
                const innerStroke = Math.max(1, symStroke * (24/size));

                const getStrokeProps = () => `stroke="${color}" stroke-width="${innerStroke}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${dashArray}`;
                
                let innerPath = '';
                 switch (s.name) {
                    case 'arrow': innerPath = `<path d="M7 17l9.2-9.2M17 17V7H7" ${getStrokeProps()}/>`; break;
                    case 'warning': innerPath = `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" ${getStrokeProps()}/><line x1="12" y1="9" x2="12" y2="13" ${getStrokeProps()}/><line x1="12" y1="17" x2="12.01" y2="17" ${getStrokeProps()}/>`; break;
                    case 'extinguisher': innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()}/><path d="M12 6v-1" ${getStrokeProps()}/><path d="M9 10h6" ${getStrokeProps()}/><path d="M12 8a2 2 0 0 0-2 2v8a2 2 0 0 0 4 0v-8a2 2 0 0 0-2-2z" fill="${color}" fill-opacity="0.2" stroke="none" /><path d="M12 10l3-2" ${getStrokeProps()}/>`; break;
                    case 'emergency_exit': innerPath = `<rect x="1" y="4" width="22" height="16" rx="2" ${getStrokeProps()}/><rect x="4" y="6" width="6" height="12" ${getStrokeProps()} /><circle cx="15" cy="9" r="1.5" fill="${color}" stroke="none"/><path d="M13 12l2-1 2 1.5" ${getStrokeProps()}/><path d="M15 11v4" ${getStrokeProps()}/><path d="M15 15l-2 3" ${getStrokeProps()}/><path d="M15 15l2 2 1-1" ${getStrokeProps()}/>`; break;
                    case 'first_aid': innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()} /><rect x="10" y="6" width="4" height="12" fill="${color}" stroke="none"/><rect x="6" y="10" width="12" height="4" fill="${color}" stroke="none"/>`; break;
                    case 'restroom': innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()}/><line x1="12" y1="4" x2="12" y2="20" ${getStrokeProps()}/><circle cx="7" cy="8" r="1.5" fill="${color}" stroke="none" /><path d="M5.5 11h3v5h-3z" fill="${color}" stroke="none" /><line x1="6" y1="16" x2="6" y2="19" ${getStrokeProps()}/><line x1="8" y1="16" x2="8" y2="19" ${getStrokeProps()}/><circle cx="17" cy="8" r="1.5" fill="${color}" stroke="none" /><path d="M17 10l-2 4h4l-2-4z" fill="${color}" stroke="none" /><line x1="16" y1="14" x2="16" y2="19" ${getStrokeProps()}/><line x1="18" y1="14" x2="18" y2="19" ${getStrokeProps()}/>`; break;
                    case 'hydrant': innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()}/><path d="M8 7v10" stroke-width="${Math.max(1, innerStroke*1.5)}" stroke="${color}" fill="none"/><path d="M16 7v10" stroke-width="${Math.max(1, innerStroke*1.5)}" stroke="${color}" fill="none"/><path d="M8 12h8" stroke-width="${Math.max(1, innerStroke*1.5)}" stroke="${color}" fill="none"/>`; break;
                    case 'trailer': innerPath = `<rect x="2" y="4" width="20" height="16" ${getStrokeProps()}/><rect x="6" y="8" width="12" height="8" rx="1" fill="${color}" fill-opacity="0.3" stroke="none"/><line x1="18" y1="10" x2="21" y2="10" ${getStrokeProps()} /><line x1="18" y1="14" x2="21" y2="14" ${getStrokeProps()} /><line x1="2" y1="4" x2="22" y2="20" stroke-width="${innerStroke*0.5}" stroke="${color}" opacity="0.2"/><line x1="22" y1="4" x2="2" y2="20" stroke-width="${innerStroke*0.5}" stroke="${color}" opacity="0.2"/>`; break;
                    case 'forklift': innerPath = `<path d="M9 16h3v-5h-2v-1h3l1 6h-5z" fill="${color}" stroke="none"/><rect x="12" y="2.5" width="13.5" height="13.5" transform="rotate(45 12 2.5)" rx="1" stroke-width="${innerStroke*1.3}" stroke="${color}" fill="none"/><path d="M14 10v6" ${getStrokeProps()}/><line x1="7" y1="16" x2="9" y2="16" ${getStrokeProps()}/><circle cx="10" cy="17" r="1.5" fill="${color}" stroke="none"/><circle cx="15" cy="17" r="1.5" fill="${color}" stroke="none"/>`; break;
                    case 'pallet': innerPath = `<rect x="5" y="5" width="14" height="14" ${getStrokeProps()}/><rect x="2" y="2" width="20" height="20" rx="1" ${getStrokeProps()}/><line x1="5" y1="12" x2="19" y2="12" stroke-width="${innerStroke*0.7}" stroke="${color}" fill="none"/><line x1="12" y1="5" x2="12" y2="19" stroke-width="${innerStroke*0.7}" stroke="${color}" fill="none"/>`; break;
                    case 'rack': innerPath = `<rect x="2" y="2" width="20" height="20" ${getStrokeProps()}/><line x1="2" y1="8" x2="22" y2="8" ${getStrokeProps()}/><line x1="2" y1="16" x2="22" y2="16" ${getStrokeProps()}/><line x1="7" y1="2" x2="7" y2="22" ${getStrokeProps()}/><line x1="17" y1="2" x2="17" y2="22" ${getStrokeProps()}/>`; break;
                    case 'conveyor': innerPath = `<rect x="2" y="6" width="20" height="12" rx="2" ${getStrokeProps()}/><circle cx="6" cy="12" r="2" fill="${color}" stroke="none"/><circle cx="12" cy="12" r="2" fill="${color}" stroke="none"/><circle cx="18" cy="12" r="2" fill="${color}" stroke="none"/>`; break;
                    case 'container': innerPath = `<rect x="2" y="4" width="20" height="16" ${getStrokeProps()}/><line x1="6" y1="4" x2="6" y2="20" ${getStrokeProps()}/><line x1="10" y1="4" x2="10" y2="20" ${getStrokeProps()}/><line x1="14" y1="4" x2="14" y2="20" ${getStrokeProps()}/><line x1="18" y1="4" x2="18" y2="20" ${getStrokeProps()}/><rect x="6" y="8" width="12" height="8" rx="1" fill="${color}" fill-opacity="0.2" stroke="none" />`; break;
                    case 'door': innerPath = `<path d="M3 21V3" ${getStrokeProps()} /><path d="M3 3h14v18" ${getStrokeProps()} stroke-dasharray="2 2" /><path d="M17 21H3" ${getStrokeProps()} /><path d="M3 21c9.941 0 18-8.059 18-18" ${getStrokeProps()} stroke-dasharray="2 2" fill="none" />`; break;
                    case 'window': innerPath = `<rect x="3" y="6" width="18" height="12" ${getStrokeProps()} /><line x1="3" y1="12" x2="21" y2="12" ${getStrokeProps()} /><line x1="12" y1="6" x2="12" y2="18" ${getStrokeProps()} />`; break;
                 }
                 svgContent += `<g transform="${transform}">${innerPath}</g>`;
            }
        });

        svgContent += `</g>`; // End content transform
        
        svgContent += `</svg>`;
        return svgContent;
    };

    const performExport = () => {
        const svgString = generateSvgString(exportConfig);
        if (!svgString) return;

        if (exportConfig.format === 'svg') {
            downloadFile(`plano_${new Date().getTime()}.svg`, svgString, 'image/svg+xml');
        } else if (exportConfig.format === 'pdf') {
            // PDF Generation
            const paper = exportConfig.paperSize; // A4, etc.
            const orientation = 'landscape';
            
            const doc = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: paper.toLowerCase()
            });

            // Convert SVG to Canvas then to Image Data
            const img = new Image();
            const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // BEST QUALITY UPGRADE:
                // P_SCALE in generateSvgString is 5 (1485px width for A4).
                // Use scale 4 to get ~6000px width.
                // 297mm * 4 * 5 = 5940px. 5940px / 11.7in = ~500 DPI.
                const scale = 4; 
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.scale(scale, scale);
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0);
                    
                    // Use PNG for PDF inner image to avoid JPEG compression artifacts on lines
                    const imgData = canvas.toDataURL('image/png');
                    
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const pageHeight = doc.internal.pageSize.getHeight();
                    
                    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
                    doc.save(`plano_${new Date().getTime()}.pdf`);
                }
                URL.revokeObjectURL(url);
                setShowExportModal(false);
            };
            img.src = url;

        } else {
             // PNG / JPG
            const img = new Image();
            const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                
                // BEST QUALITY UPGRADE: Dynamic scaling for 4K+ output
                // Calculate scale to ensure shortest side is at least 2160 or longest is 4000
                // but protect against massive memory usage (cap at 10x or 8k px)
                const maxDim = Math.max(img.width, img.height);
                const targetDim = 4000;
                
                let scale = Math.max(2, targetDim / maxDim);
                
                // Safety Caps
                if (scale > 10) scale = 10;
                if (maxDim * scale > 12000) scale = 12000 / maxDim; // Hard limit for browsers

                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Fill background
                    if (exportConfig.format === 'jpg' || exportConfig.theme === 'light') {
                         ctx.fillStyle = exportConfig.theme === 'dark' ? '#000000' : '#FFFFFF';
                         ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    ctx.scale(scale, scale);
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0);
                    
                    // Max Quality JPEG (1.0)
                    canvas.toBlob((blob) => {
                         if(blob) {
                              const a = document.createElement('a');
                              a.href = URL.createObjectURL(blob);
                              a.download = `plano_${new Date().getTime()}.${exportConfig.format}`;
                              a.click();
                         }
                         setShowExportModal(false);
                    }, `image/${exportConfig.format}`, 1.0);
                }
                URL.revokeObjectURL(url);
            };
            img.src = url;
        }
    };

    return (
        <header className="h-14 bg-base-100 dark:bg-dark-base-100 border-b border-base-300 dark:border-dark-base-300 flex items-center px-4 justify-between select-none z-50">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                   <div className="w-9 h-9 bg-gradient-to-br from-primary via-blue-600 to-secondary rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                   </div>
                   <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-tight">
                        PMC CAD
                   </span>
                </div>
                
                {/* Separator */}
                <div className="h-6 w-[1px] bg-base-300 dark:bg-dark-base-300 mx-2"></div>

                {/* Project Name Input */}
                <input
                    type="text"
                    value={currentFileName.replace(/\.json$/i, '')}
                    onChange={(e) => setCurrentFileName(e.target.value)}
                    onBlur={() => {
                        if(!currentFileName.trim()) setCurrentFileName('dibujo_sin_titulo.json');
                    }}
                    className="bg-transparent hover:bg-base-200 dark:hover:bg-dark-base-300 border border-transparent focus:border-primary rounded px-2 py-1 text-sm font-medium text-base-content dark:text-dark-base-content focus:outline-none transition-all w-48 placeholder-opacity-50"
                    placeholder="Nombre del proyecto"
                />
                
                {/* Separator */}
                <div className="h-6 w-[1px] bg-base-300 dark:bg-dark-base-300 mx-2"></div>

                {/* File Menu */}
                <div className="relative">
                    <button 
                        onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
                        className="px-3 py-1.5 text-sm font-medium hover:bg-base-200 dark:hover:bg-dark-base-300 rounded-md transition-colors flex items-center gap-1"
                    >
                        Archivo
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 opacity-50"><path d="M7 10l5 5 5-5z"/></svg>
                    </button>
                    
                    {isFileMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsFileMenuOpen(false)}></div>
                            <div className="absolute top-full left-0 mt-1 w-56 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in duration-100">
                                <button onClick={handleNew} className="w-full text-left px-4 py-2 hover:bg-base-200 dark:hover:bg-dark-base-300 text-sm flex items-center gap-2">
                                    <FilePlusIcon className="w-4 h-4 opacity-70"/> Nuevo
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className="w-full text-left px-4 py-2 hover:bg-base-200 dark:hover:bg-dark-base-300 text-sm flex items-center gap-2">
                                    <FolderOpenIcon className="w-4 h-4 opacity-70"/> Abrir...
                                </button>
                                <button onClick={handleSave} className="w-full text-left px-4 py-2 hover:bg-base-200 dark:hover:bg-dark-base-300 text-sm flex items-center gap-2">
                                    <SaveIcon className="w-4 h-4 opacity-70"/> Guardar
                                </button>
                                <button onClick={initiateSaveAs} className="w-full text-left px-4 py-2 hover:bg-base-200 dark:hover:bg-dark-base-300 text-sm flex items-center gap-2">
                                    <SaveIcon className="w-4 h-4 opacity-70"/> Guardar como...
                                </button>
                                <div className="border-t border-base-300 dark:border-dark-base-300 my-1"></div>
                                <button onClick={() => templateInputRef.current?.click()} className="w-full text-left px-4 py-2 hover:bg-base-200 dark:hover:bg-dark-base-300 text-sm flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 opacity-70"/> Importar Plantilla
                                </button>
                                <div className="border-t border-base-300 dark:border-dark-base-300 my-1"></div>
                                <button onClick={initiateExport} className="w-full text-left px-4 py-2 hover:bg-base-200 dark:hover:bg-dark-base-300 text-sm flex items-center gap-2">
                                    <DownloadIcon className="w-4 h-4 opacity-70"/> Exportar / Imprimir
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Hidden Inputs */}
            <input type="file" ref={fileInputRef} onChange={handleOpen} accept=".json" className="hidden" />
            <input type="file" ref={templateInputRef} onChange={handleImportTemplate} accept="image/*" className="hidden" />

            {/* Center Controls */}
            <div className="flex items-center gap-2">
                 <div className="flex bg-base-200 dark:bg-dark-base-300 rounded-lg p-1 gap-1">
                    <SnapToggle label="Extremos" mode="endpoints" />
                    <SnapToggle label="Medios" mode="midpoints" />
                    <SnapToggle label="Centros" mode="centers" />
                    <SnapToggle label="Guías" mode="inference" />
                 </div>
                 <div className="w-[1px] h-6 bg-base-300 dark:bg-dark-base-300 mx-1"></div>
                 <button 
                    onClick={() => setIsOrthoMode(!isOrthoMode)}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${isOrthoMode ? 'bg-secondary text-white' : 'bg-base-200 hover:bg-base-300 dark:bg-dark-base-300'}`}
                 >
                    ORTHO
                 </button>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-3">
                 {/* Template Controls */}
                 {templateImage && (
                      <div className="flex items-center gap-1 bg-base-200 dark:bg-dark-base-300 rounded-md px-2 py-1">
                          <button onClick={() => updateTemplateImage({ isVisible: !templateImage.isVisible })} className="p-1 hover:bg-base-300 dark:hover:bg-dark-base-200 rounded">
                              {templateImage.isVisible ? <EyeIcon className="w-4 h-4"/> : <EyeOffIcon className="w-4 h-4 text-base-content/50"/>}
                          </button>
                          <input 
                            type="range" min="0" max="1" step="0.1" 
                            value={templateImage.opacity} 
                            onChange={(e) => updateTemplateImage({ opacity: parseFloat(e.target.value) })}
                            className="w-16 h-1 accent-primary"
                          />
                          <button onClick={() => setTemplateImage(null)} className="p-1 hover:bg-red-100 text-red-400 rounded">
                              <XIcon className="w-4 h-4"/>
                          </button>
                      </div>
                 )}

                 <div className="flex items-center bg-base-200 dark:bg-dark-base-300 rounded-md px-2">
                    <span className="text-xs opacity-50 mr-2">Unidad:</span>
                    <select 
                        value={unit} 
                        onChange={(e) => setUnit(e.target.value as Unit)}
                        className="bg-transparent text-sm py-1.5 focus:outline-none"
                    >
                        {units.map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                    </select>
                 </div>
                 
                 <div className="flex items-center bg-base-200 dark:bg-dark-base-300 rounded-md px-2">
                    <span className="text-xs opacity-50 mr-2">Escala:</span>
                    <select 
                        value={currentScaleValue}
                        onChange={handleScaleChange}
                        className="bg-transparent text-sm py-1.5 focus:outline-none w-16"
                    >
                        {scales.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        <option value="custom">Custom</option>
                    </select>
                 </div>
            </div>

            {/* MODALS */}
            {/* New Drawing Confirmation */}
            {showNewDrawingModal && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-base-100 dark:bg-dark-base-100 p-6 rounded-xl shadow-2xl max-w-sm w-full border border-base-300 dark:border-dark-base-300">
                        <h3 className="text-lg font-bold mb-2">¿Crear nuevo dibujo?</h3>
                        <p className="text-sm opacity-70 mb-6">Los cambios no guardados se perderán permanentemente.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowNewDrawingModal(false)} className="px-4 py-2 rounded-lg hover:bg-base-200 dark:hover:bg-dark-base-300 text-sm">Cancelar</button>
                            <button onClick={confirmNewDrawing} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-focus">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Save As Modal */}
            {showSaveAsModal && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                    <form onSubmit={performSaveAs} className="bg-base-100 dark:bg-dark-base-100 p-6 rounded-xl shadow-2xl max-w-sm w-full border border-base-300 dark:border-dark-base-300">
                        <h3 className="text-lg font-bold mb-4">Guardar como</h3>
                        <div className="mb-4">
                            <label className="block text-xs font-semibold opacity-70 mb-1">Nombre del archivo</label>
                            <input 
                                type="text" 
                                autoFocus
                                value={saveAsName}
                                onChange={(e) => setSaveAsName(e.target.value)}
                                className="w-full bg-base-200 dark:bg-dark-base-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowSaveAsModal(false)} className="px-4 py-2 rounded-lg hover:bg-base-200 dark:hover:bg-dark-base-300 text-sm">Cancelar</button>
                            <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-focus">Guardar</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-base-100 dark:bg-dark-base-100 p-6 rounded-xl shadow-2xl max-w-md w-full border border-base-300 dark:border-dark-base-300">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <DownloadIcon className="w-5 h-5"/> Exportar / Imprimir
                        </h3>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-semibold opacity-70 mb-2">Formato</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['png', 'jpg', 'svg', 'pdf'].map(fmt => (
                                        <button 
                                            key={fmt}
                                            onClick={() => setExportConfig(p => ({...p, format: fmt as any}))}
                                            className={`py-2 text-sm rounded-lg border ${exportConfig.format === fmt ? 'bg-primary text-white border-primary' : 'border-base-300 hover:bg-base-200 dark:border-dark-base-300 dark:hover:bg-dark-base-300'}`}
                                        >
                                            {fmt.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold opacity-70 mb-2">Tema</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="theme" checked={exportConfig.theme === 'light'} onChange={() => setExportConfig(p => ({...p, theme: 'light'}))} className="accent-primary"/>
                                        <span className="text-sm">Claro (Impresión)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="theme" checked={exportConfig.theme === 'dark'} onChange={() => setExportConfig(p => ({...p, theme: 'dark'}))} className="accent-primary"/>
                                        <span className="text-sm">Oscuro</span>
                                    </label>
                                </div>
                            </div>
                            
                            {exportConfig.format === 'pdf' && (
                                <div>
                                    <label className="block text-xs font-semibold opacity-70 mb-2">Tamaño de Papel</label>
                                    <select 
                                        value={exportConfig.paperSize}
                                        onChange={(e) => setExportConfig(p => ({...p, paperSize: e.target.value as any}))}
                                        className="w-full bg-base-200 dark:bg-dark-base-200 px-3 py-2 rounded-lg text-sm"
                                    >
                                        <option value="A4">A4 (297 x 210 mm)</option>
                                        <option value="Letter">Carta (279 x 216 mm)</option>
                                        <option value="Legal">Oficio (356 x 216 mm)</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowExportModal(false)} className="px-4 py-2 rounded-lg hover:bg-base-200 dark:hover:bg-dark-base-300 text-sm">Cancelar</button>
                            <button onClick={performExport} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-focus font-medium">
                                {exportConfig.format === 'pdf' ? 'Generar PDF' : 'Descargar Imagen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </header>
    );
};

export default Header;
