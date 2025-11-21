
import React, { useState, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { SnapMode, Unit } from '../types';
import { CheckIcon, SaveIcon, FilePlusIcon, FolderOpenIcon, DownloadIcon, XIcon, ImageIcon, EyeIcon, EyeOffIcon, SettingsIcon, TrashIcon } from './Icon';

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
const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, function (c) {
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
        paperSize: 'A4' | 'Letter' | 'Legal',
        includeTitleBlock: boolean
    }>({
        format: 'png',
        scope: 'extents',
        theme: 'light', // Default to light for printable exports usually
        optimizeLines: true,
        paperSize: 'A4',
        includeTitleBlock: false // Changed to false by default
    });

    // Title Block Data State - Professional Standard
    const [titleBlockData, setTitleBlockData] = useState({
        companyName: 'NOMBRE DE LA EMPRESA', // Organization
        projectName: 'PROYECTO EJECUTIVO',
        drawingTitle: 'PLANTA ARQUITECTÓNICA',
        drawnBy: 'I.R.I LUCIO CERVANTES JUAN ALBERTO', // Default long name for testing
        checkedBy: 'ING. REVISOR DEL PROYECTO', // REVISO
        scale: 'INDICADA', // ESCALA
        sheetNumber: 'A-101', // CLAVE / PLANO
        revision: '00' // REV
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
        a.click();
        URL.revokeObjectURL(url);
    };

    // Quick Save (Overwrite logic / Download current)
    const handleSave = () => {
        const data = JSON.stringify(shapes, null, 2);
        downloadFile(currentFileName, data, 'application/json');
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
        // Standard defaults - Title Block disabled for safety/simplicity unless requested
        setExportConfig(prev => ({ 
            ...prev, 
            theme: 'light',
            includeTitleBlock: false, 
            optimizeLines: true
        }));
        setShowExportModal(true);
        setIsFileMenuOpen(false);
    }

    const generateSvgString = (config: typeof exportConfig) => {
        if (shapes.length === 0) return null;

        // 1. Determine Drawing Extents (Geometric Content)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        const visibleShapes = config.scope === 'viewport' 
            ? shapes // Simplification: For export, we usually grab everything or we need complex clipping.
            : shapes;

        shapes.forEach(s => {
            if (s.type === 'line' || s.type === 'dimension') {
                minX = Math.min(minX, s.p1.x, s.p2.x); maxX = Math.max(maxX, s.p1.x, s.p2.x);
                minY = Math.min(minY, s.p1.y, s.p2.y); maxY = Math.max(maxY, s.p1.y, s.p2.y);
            } else if (s.type === 'rectangle') {
                minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x + s.width);
                minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y + s.height);
            } else if (s.type === 'circle') {
                minX = Math.min(minX, s.cx - s.r); maxX = Math.max(maxX, s.cx + s.r);
                minY = Math.min(minY, s.cy - s.r); maxY = Math.max(maxY, s.cy + s.r);
            } else if (s.type === 'text' || s.type === 'symbol') {
                minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x + (s.type === 'symbol' ? s.size : 100)); 
                minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y + (s.type === 'symbol' ? s.size : 12));
            }
        });

        // Add some padding to extents
        const extPadding = 10;
        minX -= extPadding; minY -= extPadding; maxX += extPadding; maxY += extPadding;

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        // --- PAPER SPACE LOGIC ---
        let finalSVGWidth, finalSVGHeight, viewBoxStr, contentTransform = '';
        let titleBlockSvg = '';

        // Generate a unique ID suffix for this export to prevent clip-path conflicts in blob rendering
        const runId = Math.random().toString(36).substr(2, 6);

        if (config.includeTitleBlock) {
            // Define Paper Dimensions (approx 1mm = 10 units for high res calculation)
            const P_SCALE = 10; 
            const papers = {
                'A4': { w: 297 * P_SCALE, h: 210 * P_SCALE }, // Landscape
                'Letter': { w: 279 * P_SCALE, h: 216 * P_SCALE },
                'Legal': { w: 356 * P_SCALE, h: 216 * P_SCALE },
            };
            const paper = papers[config.paperSize];
            
            finalSVGWidth = paper.w;
            finalSVGHeight = paper.h;
            viewBoxStr = `0 0 ${paper.w} ${paper.h}`;

            // Layout Constants (mm * P_SCALE)
            const margin = 10 * P_SCALE; 
            const blockHeight = 32 * P_SCALE; // Increased slightly for better fit
            
            // Calculate Drawing Area (ViewPort on Paper)
            const drawAreaW = paper.w - (margin * 2);
            const drawAreaH = paper.h - (margin * 2) - blockHeight; // Space above title block
            const drawAreaX = margin;
            const drawAreaY = margin;

            // Calculate Fit Scale
            const scaleX = drawAreaW / contentW;
            const scaleY = drawAreaH / contentH;
            const fitScale = Math.min(scaleX, scaleY) * 0.95; // 5% padding

            // Center content
            const scaledContentW = contentW * fitScale;
            const scaledContentH = contentH * fitScale;
            const transX = drawAreaX + (drawAreaW - scaledContentW) / 2 - (minX * fitScale);
            const transY = drawAreaY + (drawAreaH - scaledContentH) / 2 - (minY * fitScale);

            contentTransform = `translate(${transX} ${transY}) scale(${fitScale})`;

            // --- PROFESSIONAL TITLE BLOCK SVG (ISO Style / Optimized) ---
            const strokeColor = '#000000';
            const lineStyle = `stroke="${strokeColor}" stroke-width="${2}" fill="none"`;
            const thinLineStyle = `stroke="${strokeColor}" stroke-width="${1}" fill="none"`;
            const textBase = `fill="${strokeColor}" font-family="sans-serif"`;
            
            // Helper for Labels (Small, Sans-serif)
            const label = (x: number, y: number, text: string) => 
                `<text x="${x}" y="${y}" ${textBase} font-size="${1.6 * P_SCALE}" opacity="0.7" font-weight="normal">${escapeXml(text)}</text>`;
            
            // Helper for Values (Bold) - Updated to accept extra attributes like clip-path
            // Important: escapeXml() is called on the content to prevent SVG breaking
            const val = (x: number, y: number, text: string, size: number = 2.5, anchor: string = "start", weight: string = "bold", extraAttrs: string = "") => 
                `<text x="${x}" y="${y}" ${textBase} font-size="${size * P_SCALE}" font-weight="${weight}" text-anchor="${anchor}" ${extraAttrs}>${text ? escapeXml(text.toUpperCase()) : ''}</text>`;

            const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });

            // Coordinates relative to bottom margin
            const bx = margin; // Block X start
            const by = paper.h - margin - blockHeight; // Block Y start
            const bw = paper.w - margin * 2; // Block Width

            // --- Column Distribution (Optimized for Long Names) ---
            // Col 1: Project Data & Company (40%)
            // Col 2: Signatures / Names (35%) - WIDER NOW
            // Col 3: Technical Data (25%)
            
            const col1W = bw * 0.40; 
            const col2W = bw * 0.35; 
            const col3W = bw * 0.25; 
            
            const x1 = bx;
            const x2 = bx + col1W;
            const x3 = bx + col1W + col2W;
            const xEnd = bx + bw;

            // Horizontal split for Col 1
            const c1Row1H = blockHeight * 0.35; // Top (Company)
            const c1Row2H = blockHeight * 0.35; // Middle (Project)
            
            // Horizontal split for Col 2 (Names)
            const c2MidH = blockHeight * 0.5; // Split equally for Drawn/Checked

            // Horizontal split for Col 3 (Tech)
            const c3Row1H = blockHeight * 0.4; // Date/Scale
            const c3Row2H = blockHeight * 0.6; // Sheet No

            // Define Clip Paths to enforce boundaries - USING UNIQUE IDs for PNG compatibility
            const clips = `
                <defs>
                    <clipPath id="clip-company-${runId}"><rect x="${x1}" y="${by}" width="${col1W}" height="${c1Row1H}" /></clipPath>
                    <clipPath id="clip-project-${runId}"><rect x="${x1}" y="${by + c1Row1H}" width="${col1W}" height="${c1Row2H}" /></clipPath>
                    <clipPath id="clip-title-${runId}"><rect x="${x1}" y="${by + c1Row1H + c1Row2H}" width="${col1W}" height="${blockHeight - c1Row1H - c1Row2H}" /></clipPath>
                    
                    <clipPath id="clip-drawn-${runId}"><rect x="${x2}" y="${by}" width="${col2W}" height="${c2MidH}" /></clipPath>
                    <clipPath id="clip-checked-${runId}"><rect x="${x2}" y="${by + c2MidH}" width="${col2W}" height="${blockHeight - c2MidH}" /></clipPath>
                    
                    <clipPath id="clip-date-${runId}"><rect x="${x3}" y="${by}" width="${col3W/2}" height="${c3Row1H}" /></clipPath>
                    <clipPath id="clip-scale-${runId}"><rect x="${x3 + col3W/2}" y="${by}" width="${col3W/2}" height="${c3Row1H}" /></clipPath>
                </defs>
            `;

            titleBlockSvg = `
                <g id="title-block">
                    ${clips}
                    <!-- Outer Border of Paper Area -->
                    <rect x="${margin}" y="${margin}" width="${bw}" height="${paper.h - margin*2}" ${lineStyle} stroke-width="3" />
                    
                    <!-- Main Block Rect -->
                    <line x1="${bx}" y1="${by}" x2="${xEnd}" y2="${by}" ${lineStyle} />
                    
                    <!-- Vertical Dividers -->
                    <line x1="${x2}" y1="${by}" x2="${x2}" y2="${by + blockHeight}" ${lineStyle} />
                    <line x1="${x3}" y1="${by}" x2="${x3}" y2="${by + blockHeight}" ${lineStyle} />

                    <!-- =======================
                         COLUMN 1: INFO & PROJECT 
                         ======================= -->
                    <!-- H-Dividers -->
                    <line x1="${x1}" y1="${by + c1Row1H}" x2="${x2}" y2="${by + c1Row1H}" ${thinLineStyle} />
                    <line x1="${x1}" y1="${by + c1Row1H + c1Row2H}" x2="${x2}" y2="${by + c1Row1H + c1Row2H}" ${thinLineStyle} />

                    <!-- Company Name (Top) -->
                    ${label(x1 + 2*P_SCALE, by + 3.5*P_SCALE, "EMPRESA / ORGANIZACIÓN:")}
                    ${val(x1 + 2*P_SCALE, by + 8.5*P_SCALE, titleBlockData.companyName, 3.0, "start", "bold", `clip-path="url(#clip-company-${runId})"`)}

                    <!-- Project Name (Middle) -->
                    ${label(x1 + 2*P_SCALE, by + c1Row1H + 3.5*P_SCALE, "PROYECTO:")}
                    ${val(x1 + 2*P_SCALE, by + c1Row1H + 8.5*P_SCALE, titleBlockData.projectName, 3.0, "start", "bold", `clip-path="url(#clip-project-${runId})"`)}

                    <!-- Drawing Title (Bottom) -->
                    ${label(x1 + 2*P_SCALE, by + c1Row1H + c1Row2H + 3.5*P_SCALE, "CONTENIDO:")}
                    ${val(x1 + 2*P_SCALE, by + blockHeight - 2.5*P_SCALE, titleBlockData.drawingTitle, 3.0, "start", "bold", `clip-path="url(#clip-title-${runId})"`)}

                    <!-- =======================
                         COLUMN 2: NAMES (WIDE)
                         ======================= -->
                    <!-- H-Divider -->
                    <line x1="${x2}" y1="${by + c2MidH}" x2="${x3}" y2="${by + c2MidH}" ${thinLineStyle} />

                    <!-- Drawn By -->
                    ${label(x2 + 2*P_SCALE, by + 3.5*P_SCALE, "DIBUJÓ:")}
                    ${val(x2 + 2*P_SCALE, by + 10*P_SCALE, titleBlockData.drawnBy, 2.8, "start", "bold", `clip-path="url(#clip-drawn-${runId})"`)} 

                    <!-- Checked By -->
                    ${label(x2 + 2*P_SCALE, by + c2MidH + 3.5*P_SCALE, "REVISÓ:")}
                    ${val(x2 + 2*P_SCALE, by + blockHeight - 4*P_SCALE, titleBlockData.checkedBy, 2.8, "start", "bold", `clip-path="url(#clip-checked-${runId})"`)}

                    <!-- =======================
                         COLUMN 3: TECH DATA
                         ======================= -->
                    <!-- H-Divider -->
                    <line x1="${x3}" y1="${by + c3Row1H}" x2="${xEnd}" y2="${by + c3Row1H}" ${thinLineStyle} />
                    
                    <!-- V-Divider for Top Row (Date | Scale) -->
                    <line x1="${x3 + col3W/2}" y1="${by}" x2="${x3 + col3W/2}" y2="${by + c3Row1H}" ${thinLineStyle} />

                    <!-- Date -->
                    ${label(x3 + 2*P_SCALE, by + 3.5*P_SCALE, "FECHA:")}
                    ${val(x3 + 2*P_SCALE, by + 9*P_SCALE, dateStr, 2.2, "start", "bold", `clip-path="url(#clip-date-${runId})"`)}

                    <!-- Scale -->
                    ${label(x3 + col3W/2 + 2*P_SCALE, by + 3.5*P_SCALE, "ESCALA:")}
                    ${val(x3 + col3W/2 + 2*P_SCALE, by + 9*P_SCALE, titleBlockData.scale, 2.2, "start", "bold", `clip-path="url(#clip-scale-${runId})"`)}

                    <!-- V-Divider for Bottom Row (Sheet | Rev) -->
                    <line x1="${xEnd - (col3W * 0.3)}" y1="${by + c3Row1H}" x2="${xEnd - (col3W * 0.3)}" y2="${by + blockHeight}" ${thinLineStyle} />

                    <!-- Sheet Number -->
                    ${label(x3 + 2*P_SCALE, by + c3Row1H + 3.5*P_SCALE, "PLANO Nº:")}
                    <text x="${x3 + (col3W * 0.35)}" y="${by + blockHeight - 6*P_SCALE}" ${textBase} font-size="${5 * P_SCALE}" font-weight="bold" text-anchor="middle">${escapeXml(titleBlockData.sheetNumber.toUpperCase())}</text>

                    <!-- Revision -->
                    ${label(xEnd - (col3W * 0.3) + 1.5*P_SCALE, by + c3Row1H + 3.5*P_SCALE, "REV:")}
                    <text x="${xEnd - (col3W * 0.15)}" y="${by + blockHeight - 6*P_SCALE}" ${textBase} font-size="${4 * P_SCALE}" font-weight="bold" text-anchor="middle">${escapeXml(titleBlockData.revision)}</text>
                </g>
            `;

        } else {
            // Raw Export (Original Logic)
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

        // Smart Line Weight
        const maxDimension = Math.max(finalSVGWidth, finalSVGHeight);
        const minReadableStroke = config.optimizeLines ? maxDimension / 3000 : 0; 

        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxStr}" width="${finalSVGWidth}" height="${finalSVGHeight}">`;
        
        // Background
        if (config.includeTitleBlock) {
             svgContent += `<rect x="0" y="0" width="${finalSVGWidth}" height="${finalSVGHeight}" fill="${bgColor}" />`;
        } else {
             svgContent += `<rect x="${viewBoxStr.split(' ')[0]}" y="${viewBoxStr.split(' ')[1]}" width="${finalSVGWidth}" height="${finalSVGHeight}" fill="${bgColor}" />`;
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

        shapes.forEach(s => {
            let color = s.properties.color || '#ffffff';
            // Auto-invert black/white based on theme
            if (config.theme === 'light') {
                if (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fff') color = '#000000';
            } else {
                if (color.toLowerCase() === '#000000' || color.toLowerCase() === '#000') color = '#ffffff';
            }

            let strokeWidth = s.properties.strokeWidth || 1;
            if (config.optimizeLines) strokeWidth = Math.max(strokeWidth, minReadableStroke);

            const fill = s.properties.fill !== 'transparent' ? s.properties.fill : 'none';

            if (s.type === 'line') {
                svgContent += `<line x1="${s.p1.x}" y1="${s.p1.y}" x2="${s.p2.x}" y2="${s.p2.y}" stroke="${color}" stroke-width="${strokeWidth}" />`;
            } else if (s.type === 'rectangle') {
                const transform = s.rotation ? `rotate(${-s.rotation}, ${s.x + s.width/2}, ${s.y + s.height/2})` : '';
                svgContent += `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" stroke="${color}" stroke-width="${strokeWidth}" fill="${fill}" transform="${transform}"/>`;
            } else if (s.type === 'circle') {
                svgContent += `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" stroke="${color}" stroke-width="${strokeWidth}" fill="${fill}" />`;
            } else if (s.type === 'text') {
                 const transform = s.rotation ? `rotate(${-s.rotation}, ${s.x}, ${s.y})` : '';
                 // Escape content for text shapes too
                 svgContent += `<text x="${s.x}" y="${s.y}" fill="${color}" font-size="${s.fontSize}" font-family="sans-serif" transform="${transform}">${escapeXml(s.content)}</text>`;
            } else if (s.type === 'symbol') {
                // ... Symbol logic remains the same ...
                const rotation = s.rotation || 0;
                const size = s.size;
                const symStroke = config.optimizeLines ? Math.max(1, minReadableStroke * (24/size)) : 1; 
                const transform = `translate(${s.x}, ${s.y}) rotate(${-rotation}) scale(${size/24}) translate(-12, -12)`;
                const getStrokeProps = () => `stroke="${color}" stroke-width="${symStroke * (24/size) * strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
                
                let innerPath = '';
                 switch (s.name) {
                    case 'arrow': innerPath = `<path d="M7 17l9.2-9.2M17 17V7H7" ${getStrokeProps()}/>`; break;
                    case 'warning': innerPath = `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" ${getStrokeProps()}/><line x1="12" y1="9" x2="12" y2="13" ${getStrokeProps()}/><line x1="12" y1="17" x2="12.01" y2="17" ${getStrokeProps()}/>`; break;
                    case 'extinguisher': innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()}/><path d="M12 6v-1" ${getStrokeProps()}/><path d="M9 10h6" ${getStrokeProps()}/><path d="M12 8a2 2 0 0 0-2 2v8a2 2 0 0 0 4 0v-8a2 2 0 0 0-2-2z" fill="${color}" fill-opacity="0.2" stroke="none" /><path d="M12 10l3-2" ${getStrokeProps()}/>`; break;
                    case 'emergency_exit': innerPath = `<rect x="1" y="4" width="22" height="16" rx="2" ${getStrokeProps()}/><rect x="4" y="6" width="6" height="12" ${getStrokeProps()} /><circle cx="15" cy="9" r="1.5" fill="${color}" stroke="none"/><path d="M13 12l2-1 2 1.5" ${getStrokeProps()}/><path d="M15 11v4" ${getStrokeProps()}/><path d="M15 15l-2 3" ${getStrokeProps()}/><path d="M15 15l2 2 1-1" ${getStrokeProps()}/>`; break;
                    case 'first_aid': innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()} /><rect x="10" y="6" width="4" height="12" fill="${color}" stroke="none"/><rect x="6" y="10" width="12" height="4" fill="${color}" stroke="none"/>`; break;
                    case 'restroom': innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()}/><line x1="12" y1="4" x2="12" y2="20" ${getStrokeProps()}/><circle cx="7" cy="8" r="1.5" fill="${color}" stroke="none" /><path d="M5.5 11h3v5h-3z" fill="${color}" stroke="none" /><line x1="6" y1="16" x2="6" y2="19" ${getStrokeProps()}/><line x1="8" y1="16" x2="8" y2="19" ${getStrokeProps()}/><circle cx="17" cy="8" r="1.5" fill="${color}" stroke="none" /><path d="M17 10l-2 4h4l-2-4z" fill="${color}" stroke="none" /><line x1="16" y1="14" x2="16" y2="19" ${getStrokeProps()}/><line x1="18" y1="14" x2="18" y2="19" ${getStrokeProps()}/>`; break;
                    case 'trailer': innerPath = `<rect x="2" y="4" width="20" height="16" rx="0" ${getStrokeProps()} /><line x1="2" y1="4" x2="22" y2="20" ${getStrokeProps()} opacity="0.2"/><line x1="22" y1="4" x2="2" y2="20" ${getStrokeProps()} opacity="0.2"/><rect x="6" y="8" width="12" height="8" rx="1" fill="${color}" fill-opacity="0.3" stroke="none" /><line x1="18" y1="10" x2="21" y2="10" ${getStrokeProps()} /><line x1="18" y1="14" x2="21" y2="14" ${getStrokeProps()} />`; break;
                    case 'hydrant': innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()}/><path d="M8 7v10" stroke="${color}" stroke-width="${symStroke * (24/size) * strokeWidth * 1.5}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 7v10" stroke="${color}" stroke-width="${symStroke * (24/size) * strokeWidth * 1.5}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12h8" stroke="${color}" stroke-width="${symStroke * (24/size) * strokeWidth * 1.5}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; break;
                    case 'forklift': innerPath = `<rect x="12" y="2.5" width="13.5" height="13.5" transform="rotate(45 12 2.5)" rx="1" ${getStrokeProps()} /><path d="M9 16h3v-5h-2v-1h3l1 6h-5z" fill="${color}" stroke="none"/><path d="M14 10v6" ${getStrokeProps()}/><line x1="7" y1="16" x2="9" y2="16" ${getStrokeProps()}/><circle cx="10" cy="17" r="1.5" fill="${color}" stroke="none"/><circle cx="15" cy="17" r="1.5" fill="${color}" stroke="none"/>`; break;
                    case 'pallet': innerPath = `<rect x="2" y="2" width="20" height="20" rx="1" ${getStrokeProps()} /><rect x="5" y="5" width="14" height="14" ${getStrokeProps()} /><line x1="5" y1="12" x2="19" y2="12" ${getStrokeProps()}/><line x1="12" y1="5" x2="12" y2="19" ${getStrokeProps()}/>`; break;
                    case 'rack': innerPath = `<rect x="2" y="2" width="20" height="20" ${getStrokeProps()}/><line x1="2" y1="8" x2="22" y2="8" ${getStrokeProps()}/><line x1="2" y1="16" x2="22" y2="16" ${getStrokeProps()}/><line x1="7" y1="2" x2="7" y2="22" ${getStrokeProps()}/><line x1="17" y1="2" x2="17" y2="22" ${getStrokeProps()}/>`; break;
                    case 'conveyor': innerPath = `<rect x="2" y="6" width="20" height="12" rx="2" ${getStrokeProps()} /><circle cx="6" cy="12" r="2" fill="${color}" stroke="none"/><circle cx="12" cy="12" r="2" fill="${color}" stroke="none"/><circle cx="18" cy="12" r="2" fill="${color}" stroke="none"/>`; break;
                    case 'container': innerPath = `<rect x="2" y="4" width="20" height="16" ${getStrokeProps()} /><line x1="6" y1="4" x2="6" y2="20" ${getStrokeProps()}/><line x1="10" y1="4" x2="10" y2="20" ${getStrokeProps()}/><line x1="14" y1="4" x2="14" y2="20" ${getStrokeProps()}/><line x1="18" y1="4" x2="18" y2="20" ${getStrokeProps()}/><rect x="6" y="8" width="12" height="8" rx="1" fill="${color}" fill-opacity="0.2" stroke="none" />`; break;
                }
                svgContent += `<g transform="${transform}">${innerPath}</g>`;
            } else if (s.type === 'dimension') {
                 const factor = unit === 'cm' ? 10 : (unit === 'm' ? 1000 : 1);
                 if (s.subType === 'radial' || s.subType === 'diameter') {
                     const radius = Math.sqrt(Math.pow(s.p1.x - s.p2.x, 2) + Math.pow(s.p1.y - s.p2.y, 2));
                     const cmSize = 5; 
                     svgContent += `<line x1="${s.p1.x - cmSize}" y1="${s.p1.y}" x2="${s.p1.x + cmSize}" y2="${s.p1.y}" stroke="${color}" stroke-width="${strokeWidth}" />`;
                     svgContent += `<line x1="${s.p1.x}" y1="${s.p1.y - cmSize}" x2="${s.p1.x}" y2="${s.p1.y + cmSize}" stroke="${color}" stroke-width="${strokeWidth}" />`;
                     if (s.subType === 'diameter') {
                         const diameter = radius * 2;
                         const displayValue = (diameter / factor).toFixed(2);
                         const text = s.textOverride || `Ø ${displayValue}`;
                         const vecX = s.p1.x - s.p2.x;
                         const vecY = s.p1.y - s.p2.y;
                         svgContent += `<line x1="${s.p2.x}" y1="${s.p2.y}" x2="${s.p1.x + vecX}" y2="${s.p1.y + vecY}" stroke="${color}" stroke-width="${strokeWidth}" marker-start="url(#arrow)" marker-end="url(#arrow)" />`;
                         svgContent += `<text x="${s.offsetPoint.x}" y="${s.offsetPoint.y}" fill="${color}" font-size="${s.fontSize || 4}" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>`;
                     } else {
                         const displayValue = (radius / factor).toFixed(2);
                         const text = s.textOverride || `R ${displayValue}`;
                         svgContent += `<line x1="${s.p1.x}" y1="${s.p1.y}" x2="${s.p2.x}" y2="${s.p2.y}" stroke="${color}" stroke-width="${strokeWidth}" marker-end="url(#arrow)" />`;
                         if (Math.sqrt(Math.pow(s.p2.x - s.offsetPoint.x, 2) + Math.pow(s.p2.y - s.offsetPoint.y, 2)) > 1) {
                             svgContent += `<line x1="${s.p2.x}" y1="${s.p2.y}" x2="${s.offsetPoint.x}" y2="${s.offsetPoint.y}" stroke="${color}" stroke-width="${strokeWidth}" />`;
                         }
                         svgContent += `<text x="${s.offsetPoint.x}" y="${s.offsetPoint.y}" fill="${color}" font-size="${s.fontSize || 4}" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>`;
                     }
                 } else {
                     svgContent += `<line x1="${s.p1.x}" y1="${s.p1.y}" x2="${s.p2.x}" y2="${s.p2.y}" stroke="${color}" stroke-width="${strokeWidth}" />`;
                     const midX = (s.p1.x + s.p2.x) / 2; const midY = (s.p1.y + s.p2.y) / 2;
                     const dist = Math.sqrt(Math.pow(s.p1.x - s.p2.x, 2) + Math.pow(s.p1.y - s.p2.y, 2));
                     const displayValue = (dist / factor).toFixed(2);
                     const angle = (Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x) * 180 / Math.PI + 360) % 360;
                     let textAngle = angle; if (textAngle > 90 && textAngle < 270) { textAngle -= 180; }
                     svgContent += `<text x="${midX}" y="${midY}" fill="${color}" font-size="${s.fontSize || 4}" font-family="sans-serif" text-anchor="middle" transform="rotate(${-textAngle} ${midX} ${midY})">${escapeXml(s.textOverride || displayValue)}</text>`;
                 }
             }
        });
        svgContent += `</g>`; // End Drawing Group

        // Append Title Block if enabled
        if (config.includeTitleBlock) {
            svgContent += titleBlockSvg;
        }

        svgContent += `</svg>`;
        return { content: svgContent, width: finalSVGWidth, height: finalSVGHeight };
    };

    const performExport = () => {
        const result = generateSvgString(exportConfig);
        
        if (!result) {
             setShowExportModal(false);
             return;
        }

        const fileNameWithoutExt = currentFileName.replace('.json', '');

        if (exportConfig.format === 'svg') {
            downloadFile(`${fileNameWithoutExt}.svg`, result.content, 'image/svg+xml');
            setShowExportModal(false);
        } else if (exportConfig.format === 'png' || exportConfig.format === 'jpg') {
            const { content, width, height } = result;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            // Cross origin for robustness, though usually not needed for blobs
            img.crossOrigin = "Anonymous";
            
            // Robust Base64 encoding for SVG Data URI to handle UTF-8 and clip-paths correctly
            // Using btoa with unescape(encodeURIComponent) handles UTF-8 characters in SVG string
            const svg64 = window.btoa(unescape(encodeURIComponent(content)));
            const image64 = `data:image/svg+xml;base64,${svg64}`;

            const canvasW = width; 
            const canvasH = height;

            img.onload = () => {
                try {
                    canvas.width = canvasW;
                    canvas.height = canvasH;
                    if (ctx) {
                        // Fill background (important for JPG or transparent PNGs wanting white bg)
                        if (exportConfig.format === 'jpg' || exportConfig.theme === 'light') {
                             ctx.fillStyle = '#FFFFFF';
                             ctx.fillRect(0, 0, canvasW, canvasH);
                        } else {
                             ctx.fillStyle = '#000000';
                             ctx.fillRect(0, 0, canvasW, canvasH);
                        }
    
                        ctx.drawImage(img, 0, 0, canvasW, canvasH);
                        
                        const mimeType = exportConfig.format === 'jpg' ? 'image/jpeg' : 'image/png';
                        const dataUrl = canvas.toDataURL(mimeType, 0.9);
                        const a = document.createElement('a');
                        a.href = dataUrl;
                        a.download = `${fileNameWithoutExt}.${exportConfig.format}`;
                        document.body.appendChild(a); // Firefox fix
                        a.click();
                        document.body.removeChild(a);
                        canvas.remove();
                    }
                    setShowExportModal(false);
                } catch (e) {
                    console.error("Export canvas error:", e);
                    alert("Error al generar la imagen. Intenta simplificar el dibujo.");
                    setShowExportModal(false);
                }
            };
            
            img.onerror = (err) => {
                console.error("Export image error:", err);
                alert("No se pudo generar la imagen del Cajetín. Verifica que no haya caracteres extraños en los campos de texto.");
                setShowExportModal(false);
            };

            // Set dimensions explicitly to help browser allocate buffer
            img.width = canvasW;
            img.height = canvasH;
            img.src = image64;

        } else if (exportConfig.format === 'pdf') {
             const printWindow = window.open('', '', 'width=800,height=600');
            if (printWindow) {
                const pageCss = `@page { size: ${exportConfig.paperSize} landscape; margin: 0; }`;
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>${fileNameWithoutExt}</title>
                            <style>
                                ${pageCss}
                                body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: white; overflow: hidden; }
                                svg { width: 100%; height: 100%; }
                                @media print { 
                                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                    svg { width: 100%; height: 100%; }
                                }
                            </style>
                        </head>
                        <body>
                            ${result.content}
                            <script>
                                window.onload = function() {
                                    setTimeout(() => {
                                        window.print();
                                    }, 500);
                                }
                            </script>
                        </body>
                    </html>
                `);
                printWindow.document.close();
                setShowExportModal(false);
            }
        }
    };

    return (
        <>
            <header className="flex items-center justify-between p-2 h-14 bg-base-100 dark:bg-dark-base-100 border-b border-base-300 dark:border-dark-base-300 flex-shrink-0 z-[60] relative">
                <div className="flex items-center gap-6">
                    <h1 className="text-lg font-bold select-none">PMCAD</h1>
                    
                    {/* File Menu */}
                    <div className="relative">
                        <button 
                            onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                isFileMenuOpen 
                                ? 'bg-base-200 dark:bg-dark-base-300 text-primary' 
                                : 'hover:bg-base-200 dark:hover:bg-dark-base-300 text-base-content dark:text-dark-base-content'
                            }`}
                        >
                            Archivo
                        </button>
                        
                        {isFileMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsFileMenuOpen(false)}></div>
                                <div className="absolute top-full left-0 mt-1 w-64 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-lg shadow-xl z-50 py-1 flex flex-col overflow-hidden ring-1 ring-black ring-opacity-5">
                                    <button 
                                        onClick={handleNew} 
                                        className="px-4 py-2 text-left text-sm hover:bg-base-200 dark:hover:bg-dark-base-200 transition-colors flex items-center gap-3 w-full"
                                    >
                                        <FilePlusIcon className="w-4 h-4 opacity-70"/>
                                        <span>Nuevo</span>
                                    </button>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()} 
                                        className="px-4 py-2 text-left text-sm hover:bg-base-200 dark:hover:bg-dark-base-200 transition-colors flex items-center gap-3 w-full"
                                    >
                                        <FolderOpenIcon className="w-4 h-4 opacity-70"/>
                                        <span>Abrir...</span>
                                    </button>
                                    <button 
                                        onClick={() => templateInputRef.current?.click()} 
                                        className="px-4 py-2 text-left text-sm hover:bg-base-200 dark:hover:bg-dark-base-200 transition-colors flex items-center gap-3 w-full"
                                    >
                                        <ImageIcon className="w-4 h-4 opacity-70"/>
                                        <span>Importar Plantilla...</span>
                                    </button>

                                    <div className="h-px bg-base-300 dark:bg-dark-base-300 my-1 mx-2"></div>
                                    <button 
                                        onClick={handleSave} 
                                        className="px-4 py-2 text-left text-sm hover:bg-base-200 dark:hover:bg-dark-base-200 transition-colors flex items-center gap-3 w-full"
                                    >
                                        <SaveIcon className="w-4 h-4 opacity-70"/>
                                        <span>Guardar</span>
                                    </button>
                                    <button 
                                        onClick={initiateSaveAs} 
                                        className="px-4 py-2 text-left text-sm hover:bg-base-200 dark:hover:bg-dark-base-200 transition-colors flex items-center gap-3 w-full"
                                    >
                                        <span className="w-4 h-4"></span>
                                        <span>Guardar como...</span>
                                    </button>
                                    
                                    <div className="h-px bg-base-300 dark:bg-dark-base-300 my-1 mx-2"></div>
                                    
                                    <button 
                                        onClick={initiateExport} 
                                        className="px-4 py-2 text-left text-sm hover:bg-base-200 dark:hover:bg-dark-base-200 transition-colors flex items-center gap-3 w-full"
                                    >
                                        <DownloadIcon className="w-4 h-4 opacity-70"/>
                                        <span>Exportar...</span>
                                    </button>
                                </div>
                            </>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleOpen} 
                            accept=".json" 
                            className="hidden" 
                        />
                        <input 
                            type="file" 
                            ref={templateInputRef} 
                            onChange={handleImportTemplate} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                    {/* Template Controls */}
                    {templateImage && (
                        <>
                        <div className="flex items-center gap-2 bg-base-200 dark:bg-dark-base-200 px-2 py-1 rounded-md border border-base-300 dark:border-dark-base-300">
                            <span className="text-xs font-bold uppercase opacity-50 mr-1">Plantilla</span>
                             <button 
                                onClick={() => updateTemplateImage({ isVisible: !templateImage.isVisible })}
                                className={`p-1.5 rounded hover:bg-base-300 dark:hover:bg-dark-base-300 ${!templateImage.isVisible ? 'opacity-50' : 'text-primary'}`}
                                title={templateImage.isVisible ? "Ocultar plantilla" : "Mostrar plantilla"}
                            >
                                {templateImage.isVisible ? <EyeIcon className="w-4 h-4"/> : <EyeOffIcon className="w-4 h-4"/>}
                            </button>
                            <div className="flex items-center gap-2 px-2 border-l border-base-300 dark:border-dark-base-300">
                                <input 
                                    type="range" 
                                    min="0.1" 
                                    max="1" 
                                    step="0.1" 
                                    value={templateImage.opacity}
                                    onChange={(e) => updateTemplateImage({ opacity: parseFloat(e.target.value) })}
                                    className="w-16 h-1 bg-base-300 rounded-lg appearance-none cursor-pointer"
                                    title="Opacidad"
                                />
                            </div>
                             <button 
                                onClick={() => setShowTemplateSettingsModal(true)}
                                className="p-1.5 rounded hover:bg-base-300 dark:hover:bg-dark-base-300"
                                title="Ajustar posición y tamaño"
                            >
                                <SettingsIcon className="w-4 h-4"/>
                            </button>
                             <button 
                                onClick={() => setTemplateImage(null)}
                                className="p-1.5 rounded hover:bg-red-500 hover:text-white text-base-content/50"
                                title="Eliminar plantilla"
                            >
                                <TrashIcon className="w-4 h-4"/>
                            </button>
                        </div>
                        <div className="w-px h-6 bg-base-300 dark:bg-dark-base-300"></div>
                        </>
                    )}

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/70 dark:text-dark-base-content/70 hidden sm:inline">Ajustar a:</span>
                        <SnapToggle label="Puntos Finales" mode="endpoints" />
                        <SnapToggle label="Puntos Medios" mode="midpoints" />
                        <SnapToggle label="Centros" mode="centers" />
                        <SnapToggle label="Inferencia" mode="inference" />
                    </div>
                     <div className="w-px h-6 bg-base-300 dark:bg-dark-base-300"></div>
                     <div className="flex items-center gap-2">
                         <button
                            onClick={() => setIsOrthoMode(!isOrthoMode)}
                            className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-2 transition-colors ${
                                isOrthoMode ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300 dark:bg-dark-base-300 dark:hover:bg-dark-base-200'
                            }`}
                        >
                            Ortho
                            {isOrthoMode && <CheckIcon className="w-3 h-3" />}
                        </button>
                     </div>
                     <div className="w-px h-6 bg-base-300 dark:bg-dark-base-300"></div>
                     
                     {/* Scale Selector */}
                     <div className="flex items-center gap-2">
                        <label htmlFor="scale-select" className="text-xs text-base-content/70 dark:text-dark-base-content/70 hidden sm:inline">Escala:</label>
                        <select
                            id="scale-select"
                            value={currentScaleValue}
                            onChange={handleScaleChange}
                            className="bg-base-200 dark:bg-dark-base-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer w-20"
                        >
                            {currentScaleValue === 'custom' && <option value="custom">{(viewTransform.scale * 100).toFixed(0)}%</option>}
                            {scales.map(s => <option key={s.label} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>

                     <div className="w-px h-6 bg-base-300 dark:bg-dark-base-300"></div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="unit-select" className="text-xs text-base-content/70 dark:text-dark-base-content/70 hidden sm:inline">Unidades:</label>
                        <select
                            id="unit-select"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value as Unit)}
                            className="bg-base-200 dark:bg-dark-base-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                            {units.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>
            </header>

            {/* --- Template Settings Modal --- */}
            {showTemplateSettingsModal && templateImage && (
                 <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-base-100 dark:bg-dark-base-100 rounded-xl shadow-2xl border border-base-300 dark:border-dark-base-300 w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
                        <div className="p-4 border-b border-base-300 dark:border-dark-base-300 flex justify-between items-center bg-base-200 dark:bg-dark-base-200">
                            <h3 className="font-bold text-lg">Ajustes de Plantilla</h3>
                            <button onClick={() => setShowTemplateSettingsModal(false)} className="p-1 hover:bg-base-300 dark:hover:bg-dark-base-300 rounded-full transition-colors">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold opacity-60 mb-1">Posición X</label>
                                    <input 
                                        type="number" 
                                        value={templateImage.x} 
                                        onChange={(e) => updateTemplateImage({ x: parseFloat(e.target.value) })}
                                        className="w-full bg-base-200 dark:bg-dark-base-300 px-3 py-2 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold opacity-60 mb-1">Posición Y</label>
                                    <input 
                                        type="number" 
                                        value={templateImage.y} 
                                        onChange={(e) => updateTemplateImage({ y: parseFloat(e.target.value) })}
                                        className="w-full bg-base-200 dark:bg-dark-base-300 px-3 py-2 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold opacity-60 mb-1">Ancho</label>
                                    <input 
                                        type="number" 
                                        value={templateImage.width} 
                                        onChange={(e) => updateTemplateImage({ width: parseFloat(e.target.value) })}
                                        className="w-full bg-base-200 dark:bg-dark-base-300 px-3 py-2 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold opacity-60 mb-1">Alto</label>
                                    <input 
                                        type="number" 
                                        value={templateImage.height} 
                                        onChange={(e) => updateTemplateImage({ height: parseFloat(e.target.value) })}
                                        className="w-full bg-base-200 dark:bg-dark-base-300 px-3 py-2 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-base-300 dark:border-dark-base-300 flex justify-end">
                                <button 
                                    onClick={() => setShowTemplateSettingsModal(false)}
                                    className="px-4 py-2 bg-primary hover:bg-primary-focus text-white rounded-lg transition-colors font-medium"
                                >
                                    Listo
                                </button>
                            </div>
                        </div>
                    </div>
                 </div>
            )}

            {/* --- New Drawing Modal --- */}
            {showNewDrawingModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-base-100 dark:bg-dark-base-100 rounded-xl shadow-2xl border border-base-300 dark:border-dark-base-300 w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
                        <div className="p-4 border-b border-base-300 dark:border-dark-base-300 flex justify-between items-center bg-base-200 dark:bg-dark-base-200">
                            <h3 className="font-bold text-lg">Nuevo Dibujo</h3>
                            <button onClick={() => setShowNewDrawingModal(false)} className="p-1 hover:bg-base-300 dark:hover:bg-dark-base-300 rounded-full transition-colors">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-secondary">
                                <FilePlusIcon className="w-8 h-8" />
                            </div>
                            <h4 className="text-lg font-bold mb-2">¿Empezar desde cero?</h4>
                            <p className="text-sm opacity-70 mb-6">
                                Se perderán los cambios no guardados del dibujo actual. Esta acción no se puede deshacer.
                            </p>
                            
                            <div className="flex gap-3 justify-center">
                                <button 
                                    onClick={() => setShowNewDrawingModal(false)}
                                    className="px-4 py-2 rounded-lg hover:bg-base-200 dark:hover:bg-dark-base-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmNewDrawing}
                                    className="px-4 py-2 bg-secondary hover:bg-secondary-focus text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Save As Modal --- */}
            {showSaveAsModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-base-100 dark:bg-dark-base-100 rounded-xl shadow-2xl border border-base-300 dark:border-dark-base-300 w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">
                        <div className="p-4 border-b border-base-300 dark:border-dark-base-300 flex justify-between items-center bg-base-200 dark:bg-dark-base-200">
                            <h3 className="font-bold text-lg">Guardar Proyecto</h3>
                            <button onClick={() => setShowSaveAsModal(false)} className="p-1 hover:bg-base-300 dark:hover:bg-dark-base-300 rounded-full transition-colors">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={performSaveAs} className="p-6">
                            <label className="block text-sm font-medium mb-2 opacity-80">Nombre del Archivo</label>
                            <div className="flex items-center bg-base-200 dark:bg-dark-base-200 rounded-lg border border-base-300 dark:border-dark-base-300 focus-within:ring-2 focus-within:ring-primary transition-all">
                                <input 
                                    type="text" 
                                    value={saveAsName}
                                    onChange={(e) => setSaveAsName(e.target.value)}
                                    className="flex-grow bg-transparent p-3 outline-none"
                                    placeholder="mi_proyecto"
                                    autoFocus
                                />
                                <span className="pr-3 opacity-50 select-none text-sm">.json</span>
                            </div>
                            <p className="text-xs mt-2 opacity-60">Se guardará una copia editable del proyecto actual.</p>
                            
                            <div className="flex gap-3 mt-6 justify-end">
                                <button 
                                    type="button"
                                    onClick={() => setShowSaveAsModal(false)}
                                    className="px-4 py-2 rounded-lg hover:bg-base-200 dark:hover:bg-dark-base-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 bg-primary hover:bg-primary-focus text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                                >
                                    <SaveIcon className="w-4 h-4"/>
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- Export Modal --- */}
            {showExportModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-base-100 dark:bg-dark-base-100 rounded-xl shadow-2xl border border-base-300 dark:border-dark-base-300 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-base-300 dark:border-dark-base-300 flex justify-between items-center bg-base-200 dark:bg-dark-base-200 sticky top-0 z-10">
                            <h3 className="font-bold text-lg">Exportar Dibujo</h3>
                            <button onClick={() => setShowExportModal(false)} className="p-1 hover:bg-base-300 dark:hover:bg-dark-base-300 rounded-full transition-colors">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            
                            {/* Format Selection */}
                            <div>
                                <label className="block text-sm font-bold mb-3 opacity-80">Formato</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {(['png', 'jpg', 'pdf', 'svg'] as const).map(fmt => (
                                        <button
                                            key={fmt}
                                            onClick={() => setExportConfig(prev => ({
                                                ...prev, 
                                                format: fmt, 
                                                theme: fmt === 'pdf' ? 'light' : prev.theme,
                                                includeTitleBlock: fmt === 'pdf' ? prev.includeTitleBlock : false // Disable title block for non-PDF
                                            }))}
                                            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                                                exportConfig.format === fmt 
                                                ? 'bg-primary/10 border-primary text-primary' 
                                                : 'bg-base-200 dark:bg-dark-base-200 border-transparent hover:border-base-300 dark:hover:border-dark-base-300 opacity-70 hover:opacity-100'
                                            }`}
                                        >
                                            <span className="text-base font-bold uppercase">{fmt}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Title Block Toggle - EXCLUSIVE TO PDF */}
                            {exportConfig.format === 'pdf' && (
                                <div className="flex items-center gap-3 bg-base-200 dark:bg-dark-base-200 p-3 rounded-lg border border-base-300 dark:border-dark-base-300">
                                    <input 
                                        type="checkbox" 
                                        id="includeTitleBlock"
                                        checked={exportConfig.includeTitleBlock}
                                        onChange={(e) => setExportConfig({...exportConfig, includeTitleBlock: e.target.checked, theme: e.target.checked ? 'light' : exportConfig.theme})}
                                        className="checkbox checkbox-primary checkbox-sm"
                                    />
                                    <label htmlFor="includeTitleBlock" className="text-sm font-bold cursor-pointer select-none flex-grow">
                                        Incluir Rótulo / Cajetín (Hoja Técnica)
                                        <span className="block text-xs opacity-60 font-normal mt-1">
                                            Añade marco y datos para planos profesionales.
                                        </span>
                                    </label>
                                </div>
                            )}

                            {/* Title Block Fields (Conditionally Rendered) */}
                            {exportConfig.includeTitleBlock && exportConfig.format === 'pdf' && (
                                <div className="space-y-3 bg-base-200/50 dark:bg-dark-base-200/50 p-4 rounded-lg border border-base-300 dark:border-dark-base-300">
                                    <div className="grid grid-cols-1 gap-3 mb-2">
                                         <div>
                                            <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">Empresa / Organización</label>
                                            <input 
                                                type="text" 
                                                value={titleBlockData.companyName}
                                                onChange={(e) => setTitleBlockData({...titleBlockData, companyName: e.target.value})}
                                                className="w-full bg-base-100 dark:bg-dark-base-300 px-2 py-1.5 rounded border border-base-300 dark:border-dark-base-100 text-sm focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">Nombre del Proyecto</label>
                                            <input 
                                                type="text" 
                                                value={titleBlockData.projectName}
                                                onChange={(e) => setTitleBlockData({...titleBlockData, projectName: e.target.value})}
                                                className="w-full bg-base-100 dark:bg-dark-base-300 px-2 py-1.5 rounded border border-base-300 dark:border-dark-base-100 text-sm focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">Contenido / Título</label>
                                            <input 
                                                type="text" 
                                                value={titleBlockData.drawingTitle}
                                                onChange={(e) => setTitleBlockData({...titleBlockData, drawingTitle: e.target.value})}
                                                className="w-full bg-base-100 dark:bg-dark-base-300 px-2 py-1.5 rounded border border-base-300 dark:border-dark-base-100 text-sm focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">Dibujó (Nombre Completo)</label>
                                            <input 
                                                type="text" 
                                                value={titleBlockData.drawnBy}
                                                onChange={(e) => setTitleBlockData({...titleBlockData, drawnBy: e.target.value})}
                                                className="w-full bg-base-100 dark:bg-dark-base-300 px-2 py-1.5 rounded border border-base-300 dark:border-dark-base-100 text-sm focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">Revisó (Nombre Completo)</label>
                                            <input 
                                                type="text" 
                                                value={titleBlockData.checkedBy}
                                                onChange={(e) => setTitleBlockData({...titleBlockData, checkedBy: e.target.value})}
                                                className="w-full bg-base-100 dark:bg-dark-base-300 px-2 py-1.5 rounded border border-base-300 dark:border-dark-base-100 text-sm focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                         <div>
                                            <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">Escala</label>
                                            <input 
                                                type="text" 
                                                value={titleBlockData.scale}
                                                onChange={(e) => setTitleBlockData({...titleBlockData, scale: e.target.value})}
                                                className="w-full bg-base-100 dark:bg-dark-base-300 px-2 py-1.5 rounded border border-base-300 dark:border-dark-base-100 text-sm focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">Clave / Plano</label>
                                                <input 
                                                    type="text" 
                                                    value={titleBlockData.sheetNumber}
                                                    onChange={(e) => setTitleBlockData({...titleBlockData, sheetNumber: e.target.value})}
                                                    className="w-full bg-base-100 dark:bg-dark-base-300 px-2 py-1.5 rounded border border-base-300 dark:border-dark-base-100 text-sm focus:ring-1 focus:ring-primary outline-none font-bold"
                                                />
                                            </div>
                                            <div className="w-16">
                                                <label className="block text-[10px] font-bold uppercase opacity-60 mb-1">Rev.</label>
                                                <input 
                                                    type="text" 
                                                    value={titleBlockData.revision}
                                                    onChange={(e) => setTitleBlockData({...titleBlockData, revision: e.target.value})}
                                                    className="w-full bg-base-100 dark:bg-dark-base-300 px-2 py-1.5 rounded border border-base-300 dark:border-dark-base-100 text-sm focus:ring-1 focus:ring-primary outline-none text-center"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs opacity-50 text-right mt-2">Fecha generada automáticamente.</div>
                                </div>
                            )}

                            {/* PDF Specific: Paper Size (Always visible if Title Block enabled or PDF) */}
                            {(exportConfig.format === 'pdf' || exportConfig.includeTitleBlock) && (
                                <div>
                                    <label className="block text-sm font-bold mb-3 opacity-80">
                                        {exportConfig.format === 'pdf' ? 'Tamaño de Papel' : 'Tamaño de Hoja / Resolución'}
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['Letter', 'Legal', 'A4'] as const).map(size => (
                                            <button
                                                key={size}
                                                onClick={() => setExportConfig(prev => ({...prev, paperSize: size}))}
                                                className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                                                    exportConfig.paperSize === size
                                                    ? 'bg-primary/10 border-primary text-primary'
                                                    : 'bg-base-200 dark:bg-dark-base-200 border-transparent opacity-70 hover:opacity-100'
                                                }`}
                                            >
                                                {size === 'Letter' ? 'Carta' : size === 'Legal' ? 'Oficio' : size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Theme & Scope (Hidden if Title Block enabled to simplify) */}
                            {!exportConfig.includeTitleBlock && (
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold mb-3 opacity-80">Tema</label>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => setExportConfig({...exportConfig, theme: 'dark'})}
                                                className={`p-2 rounded-lg border text-sm font-medium text-left px-3 transition-all ${
                                                    exportConfig.theme === 'dark'
                                                    ? 'bg-primary/10 border-primary text-primary'
                                                    : 'bg-base-200 dark:bg-dark-base-200 border-transparent opacity-70 hover:opacity-100'
                                                }`}
                                            >
                                                Oscuro (Pantalla)
                                            </button>
                                            <button
                                                onClick={() => setExportConfig({...exportConfig, theme: 'light'})}
                                                className={`p-2 rounded-lg border text-sm font-medium text-left px-3 transition-all ${
                                                    exportConfig.theme === 'light'
                                                    ? 'bg-primary/10 border-primary text-primary'
                                                    : 'bg-base-200 dark:bg-dark-base-200 border-transparent opacity-70 hover:opacity-100'
                                                }`}
                                            >
                                                Claro (Impresión)
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-3 opacity-80">Área</label>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => setExportConfig({...exportConfig, scope: 'extents'})}
                                                className={`p-2 rounded-lg border text-sm font-medium text-left px-3 transition-all ${
                                                    exportConfig.scope === 'extents'
                                                    ? 'bg-primary/10 border-primary text-primary'
                                                    : 'bg-base-200 dark:bg-dark-base-200 border-transparent opacity-70 hover:opacity-100'
                                                }`}
                                            >
                                                Todo el dibujo
                                            </button>
                                            <button
                                                onClick={() => setExportConfig({...exportConfig, scope: 'viewport'})}
                                                className={`p-2 rounded-lg border text-sm font-medium text-left px-3 transition-all ${
                                                    exportConfig.scope === 'viewport'
                                                    ? 'bg-primary/10 border-primary text-primary'
                                                    : 'bg-base-200 dark:bg-dark-base-200 border-transparent opacity-70 hover:opacity-100'
                                                }`}
                                            >
                                                Vista actual
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Legibility Checkbox */}
                            <div className="flex items-center gap-3 bg-base-200 dark:bg-dark-base-200 p-3 rounded-lg">
                                <input 
                                    type="checkbox" 
                                    id="optimizeLines"
                                    checked={exportConfig.optimizeLines}
                                    onChange={(e) => setExportConfig({...exportConfig, optimizeLines: e.target.checked})}
                                    className="checkbox checkbox-primary checkbox-sm"
                                />
                                <label htmlFor="optimizeLines" className="text-sm font-medium cursor-pointer select-none flex-grow">
                                    Mejorar legibilidad de líneas
                                    <span className="block text-xs opacity-60 font-normal">
                                        Engrosa automáticamente líneas finas en dibujos grandes.
                                    </span>
                                </label>
                            </div>

                            <div className="text-xs opacity-50 italic">
                                {exportConfig.format === 'pdf' 
                                    ? 'Nota: Se abrirá el diálogo de impresión. Selecciona "Guardar como PDF".' 
                                    : 'Nota: Las imágenes se exportan en Alta Resolución (300 DPI equiv).'}
                            </div>

                            <div className="flex gap-3 mt-6 justify-end pt-4 border-t border-base-300 dark:border-dark-base-300 sticky bottom-0 bg-base-100 dark:bg-dark-base-100 z-10 pb-2">
                                <button 
                                    onClick={() => setShowExportModal(false)}
                                    className="px-4 py-2 rounded-lg hover:bg-base-200 dark:hover:bg-dark-base-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={performExport}
                                    className="px-6 py-2 bg-primary hover:bg-primary-focus text-white rounded-lg transition-colors font-medium flex items-center gap-2 shadow-lg shadow-primary/20"
                                >
                                    <DownloadIcon className="w-4 h-4"/>
                                    Exportar {exportConfig.format.toUpperCase()}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Header;