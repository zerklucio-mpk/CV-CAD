
import React, { useState, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { SnapMode, Unit } from '../types';
import { CheckIcon, SaveIcon, FilePlusIcon, FolderOpenIcon, DownloadIcon, XIcon } from './Icon';

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

const Header: React.FC = () => {
    const { unit, setUnit, isOrthoMode, setIsOrthoMode, shapes, replaceShapes, createNewDrawing, viewTransform, setViewTransform } = useAppContext();
    const units: Unit[] = ['mm', 'cm', 'm'];
    
    const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
    const [currentFileName, setCurrentFileName] = useState('dibujo_sin_titulo.json');
    
    // --- Modals State ---
    const [showNewDrawingModal, setShowNewDrawingModal] = useState(false);
    const [showSaveAsModal, setShowSaveAsModal] = useState(false);
    const [saveAsName, setSaveAsName] = useState('');

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportConfig, setExportConfig] = useState<{
        format: 'png' | 'jpg' | 'pdf' | 'svg', 
        scope: 'extents' | 'viewport',
        theme: 'dark' | 'light',
        optimizeLines: boolean,
        paperSize: 'A4' | 'Letter' | 'Legal' // Added Paper Size
    }>({
        format: 'png',
        scope: 'extents',
        theme: 'dark',
        optimizeLines: true,
        paperSize: 'A4'
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

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
            // We keep the current center position but update scale
            // Ideally we zoom into center, but simple scale update works for header control
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
                    // Use replaceShapes to avoid race conditions with consecutive delete/add calls
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

    // --- Export Logic ---

    const initiateExport = () => {
        if (shapes.length === 0) {
            alert('No hay elementos para exportar.');
            setIsFileMenuOpen(false);
            return;
        }
        // Default configuration
        setExportConfig(prev => ({ 
            ...prev, 
            theme: prev.format === 'pdf' ? 'light' : 'dark',
            optimizeLines: true
        }));
        setShowExportModal(true);
        setIsFileMenuOpen(false);
    }

    const generateSvgString = (mode: 'extents' | 'viewport', theme: 'dark' | 'light', optimizeLines: boolean) => {
         if (shapes.length === 0) return null;

        let vbX, vbY, vbW, vbH;

        if (mode === 'viewport') {
            const mainElement = document.querySelector('main');
            const viewportWidth = mainElement ? mainElement.clientWidth : window.innerWidth;
            const viewportHeight = mainElement ? mainElement.clientHeight : window.innerHeight;
            
            vbX = (0 - viewTransform.x) / viewTransform.scale;
            vbY = (0 - viewTransform.y) / viewTransform.scale;
            vbW = viewportWidth / viewTransform.scale;
            vbH = viewportHeight / viewTransform.scale;
        } else {
            // EXTENTS
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            shapes.forEach(s => {
                if (s.type === 'line' || s.type === 'dimension') {
                    minX = Math.min(minX, s.p1.x, s.p2.x);
                    maxX = Math.max(maxX, s.p1.x, s.p2.x);
                    minY = Math.min(minY, s.p1.y, s.p2.y);
                    maxY = Math.max(maxY, s.p1.y, s.p2.y);
                } else if (s.type === 'rectangle') {
                    minX = Math.min(minX, s.x);
                    maxX = Math.max(maxX, s.x + s.width);
                    minY = Math.min(minY, s.y);
                    maxY = Math.max(maxY, s.y + s.height);
                } else if (s.type === 'circle') {
                    minX = Math.min(minX, s.cx - s.r);
                    maxX = Math.max(maxX, s.cx + s.r);
                    minY = Math.min(minY, s.cy - s.r);
                    maxY = Math.max(maxY, s.cy + s.r);
                } else if (s.type === 'text' || s.type === 'symbol') {
                    minX = Math.min(minX, s.x);
                    maxX = Math.max(maxX, s.x + (s.type === 'symbol' ? s.size : 100)); 
                    minY = Math.min(minY, s.y);
                    maxY = Math.max(maxY, s.y + (s.type === 'symbol' ? s.size : 12));
                }
            });

            const padding = 50; // Add some padding
            vbX = minX - padding;
            vbY = minY - padding;
            vbW = (maxX - minX) + padding * 2;
            vbH = (maxY - minY) + padding * 2;
        }

        // Ensure we don't have negative/zero width/height if drawing is empty or single point
        if (vbW <= 0) vbW = 100;
        if (vbH <= 0) vbH = 100;

        const bgColor = theme === 'dark' ? '#000000' : '#FFFFFF';
        const defaultStroke = theme === 'dark' ? '#FFFFFF' : '#000000';

        // --- Smart Line Weight Logic ---
        // Calculate a minimum readable stroke width relative to the total view size.
        // For a 4000px image, we want lines to be at least ~1px or ~2px thick.
        // 4000 / 2000 = 2. So factor is 1/2000 of max dimension.
        const maxDimension = Math.max(vbW, vbH);
        const minReadableStroke = optimizeLines ? maxDimension / 2000 : 0;

        const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;
        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${vbW}" height="${vbH}">`;
        
        // Background
        svgContent += `<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${bgColor}" />`;
        
        svgContent += `
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="${defaultStroke}" />
            </marker>
        </defs>
        `;

        shapes.forEach(s => {
            let color = s.properties.color || '#ffffff';
            // Invert colors if needed based on theme
            if (theme === 'light') {
                if (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fff') {
                    color = '#000000';
                }
            } else {
                if (color.toLowerCase() === '#000000' || color.toLowerCase() === '#000') {
                    color = '#ffffff';
                }
            }

            let strokeWidth = s.properties.strokeWidth || 1;
            // Apply smart weighting: ensure line is not too thin to be seen
            if (optimizeLines) {
                strokeWidth = Math.max(strokeWidth, minReadableStroke);
            }

            const fill = s.properties.fill !== 'transparent' ? s.properties.fill : 'none';

            if (s.type === 'line') {
                svgContent += `<line x1="${s.p1.x}" y1="${s.p1.y}" x2="${s.p2.x}" y2="${s.p2.y}" stroke="${color}" stroke-width="${strokeWidth}" />`;
            } else if (s.type === 'rectangle') {
                // Negate rotation for SVG output (CCW)
                const transform = s.rotation 
                    ? `rotate(${-s.rotation}, ${s.x + s.width/2}, ${s.y + s.height/2})` 
                    : '';
                svgContent += `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" stroke="${color}" stroke-width="${strokeWidth}" fill="${fill}" transform="${transform}"/>`;
            } else if (s.type === 'circle') {
                svgContent += `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" stroke="${color}" stroke-width="${strokeWidth}" fill="${fill}" />`;
            } else if (s.type === 'text') {
                 // Negate rotation for SVG output (CCW)
                 const transform = s.rotation 
                    ? `rotate(${-s.rotation}, ${s.x}, ${s.y})` 
                    : '';
                 svgContent += `<text x="${s.x}" y="${s.y}" fill="${color}" font-size="${s.fontSize}" font-family="sans-serif" transform="${transform}">${s.content}</text>`;
            } else if (s.type === 'symbol') {
                const rotation = s.rotation || 0;
                const size = s.size;
                // Normalize symbol stroke as well
                const symStroke = optimizeLines ? Math.max(1, minReadableStroke * (24/size)) : 1; 
                
                // Negate rotation for SVG output (CCW)
                const transform = `translate(${s.x}, ${s.y}) rotate(${-rotation}) scale(${size/24}) translate(-12, -12)`;
                
                // Helper for symbol paths to reduce redundancy
                const getStrokeProps = () => `stroke="${color}" stroke-width="${symStroke * (24/size) * strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;

                let innerPath = '';
                switch (s.name) {
                    case 'arrow':
                        innerPath = `<path d="M7 17l9.2-9.2M17 17V7H7" ${getStrokeProps()}/>`;
                        break;
                    case 'warning':
                        innerPath = `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" ${getStrokeProps()}/>
                                     <line x1="12" y1="9" x2="12" y2="13" ${getStrokeProps()}/>
                                     <line x1="12" y1="17" x2="12.01" y2="17" ${getStrokeProps()}/>`;
                        break;
                    case 'extinguisher':
                        innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()}/>
                                     <path d="M12 6v-1" ${getStrokeProps()}/>
                                     <path d="M9 10h6" ${getStrokeProps()}/>
                                     <path d="M12 8a2 2 0 0 0-2 2v8a2 2 0 0 0 4 0v-8a2 2 0 0 0-2-2z" fill="${color}" fill-opacity="0.2" stroke="none" />
                                     <path d="M12 10l3-2" ${getStrokeProps()}/>`;
                        break;
                    case 'emergency_exit':
                        innerPath = `<rect x="1" y="4" width="22" height="16" rx="2" ${getStrokeProps()}/>
                                     <rect x="4" y="6" width="6" height="12" ${getStrokeProps()} />
                                     <circle cx="15" cy="9" r="1.5" fill="${color}" stroke="none"/>
                                     <path d="M13 12l2-1 2 1.5" ${getStrokeProps()}/>
                                     <path d="M15 11v4" ${getStrokeProps()}/>
                                     <path d="M15 15l-2 3" ${getStrokeProps()}/>
                                     <path d="M15 15l2 2 1-1" ${getStrokeProps()}/>`;
                        break;
                    case 'first_aid':
                        innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()} />
                                     <rect x="10" y="6" width="4" height="12" fill="${color}" stroke="none"/>
                                     <rect x="6" y="10" width="12" height="4" fill="${color}" stroke="none"/>`;
                        break;
                    case 'restroom':
                        innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()}/>
                                     <line x1="12" y1="4" x2="12" y2="20" ${getStrokeProps()}/>
                                     <circle cx="7" cy="8" r="1.5" fill="${color}" stroke="none" />
                                     <path d="M5.5 11h3v5h-3z" fill="${color}" stroke="none" />
                                     <line x1="6" y1="16" x2="6" y2="19" ${getStrokeProps()}/>
                                     <line x1="8" y1="16" x2="8" y2="19" ${getStrokeProps()}/>
                                     <circle cx="17" cy="8" r="1.5" fill="${color}" stroke="none" />
                                     <path d="M17 10l-2 4h4l-2-4z" fill="${color}" stroke="none" />
                                     <line x1="16" y1="14" x2="16" y2="19" ${getStrokeProps()}/>
                                     <line x1="18" y1="14" x2="18" y2="19" ${getStrokeProps()}/>`;
                        break;
                    case 'trailer':
                        innerPath = `<rect x="2" y="4" width="20" height="16" rx="0" ${getStrokeProps()} />
                                     <line x1="2" y1="4" x2="22" y2="20" ${getStrokeProps()} opacity="0.2"/>
                                     <line x1="22" y1="4" x2="2" y2="20" ${getStrokeProps()} opacity="0.2"/>
                                     <rect x="6" y="8" width="12" height="8" rx="1" fill="${color}" fill-opacity="0.3" stroke="none" />
                                     <line x1="18" y1="10" x2="21" y2="10" ${getStrokeProps()} />
                                     <line x1="18" y1="14" x2="21" y2="14" ${getStrokeProps()} />`;
                        break;
                    case 'hydrant':
                        innerPath = `<rect x="2" y="2" width="20" height="20" rx="2" ${getStrokeProps()}/>
                                     <path d="M8 7v10" stroke="${color}" stroke-width="${symStroke * (24/size) * strokeWidth * 1.5}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                                     <path d="M16 7v10" stroke="${color}" stroke-width="${symStroke * (24/size) * strokeWidth * 1.5}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                                     <path d="M8 12h8" stroke="${color}" stroke-width="${symStroke * (24/size) * strokeWidth * 1.5}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
                        break;
                    case 'forklift':
                        innerPath = `<rect x="12" y="2.5" width="13.5" height="13.5" transform="rotate(45 12 2.5)" rx="1" ${getStrokeProps()} />
                                     <path d="M9 16h3v-5h-2v-1h3l1 6h-5z" fill="${color}" stroke="none"/>
                                     <path d="M14 10v6" ${getStrokeProps()}/>
                                     <line x1="7" y1="16" x2="9" y2="16" ${getStrokeProps()}/>
                                     <circle cx="10" cy="17" r="1.5" fill="${color}" stroke="none"/>
                                     <circle cx="15" cy="17" r="1.5" fill="${color}" stroke="none"/>`;
                        break;
                    case 'pallet':
                        innerPath = `<rect x="2" y="2" width="20" height="20" rx="1" ${getStrokeProps()} />
                                     <rect x="5" y="5" width="14" height="14" ${getStrokeProps()} />
                                     <line x1="5" y1="12" x2="19" y2="12" ${getStrokeProps()}/>
                                     <line x1="12" y1="5" x2="12" y2="19" ${getStrokeProps()}/>`;
                        break;
                    case 'rack':
                        innerPath = `<rect x="2" y="2" width="20" height="20" ${getStrokeProps()}/>
                                     <line x1="2" y1="8" x2="22" y2="8" ${getStrokeProps()}/>
                                     <line x1="2" y1="16" x2="22" y2="16" ${getStrokeProps()}/>
                                     <line x1="7" y1="2" x2="7" y2="22" ${getStrokeProps()}/>
                                     <line x1="17" y1="2" x2="17" y2="22" ${getStrokeProps()}/>`;
                        break;
                    case 'conveyor':
                        innerPath = `<rect x="2" y="6" width="20" height="12" rx="2" ${getStrokeProps()} />
                                     <circle cx="6" cy="12" r="2" fill="${color}" stroke="none"/>
                                     <circle cx="12" cy="12" r="2" fill="${color}" stroke="none"/>
                                     <circle cx="18" cy="12" r="2" fill="${color}" stroke="none"/>`;
                        break;
                    case 'container':
                        innerPath = `<rect x="2" y="4" width="20" height="16" ${getStrokeProps()} />
                                     <line x1="6" y1="4" x2="6" y2="20" ${getStrokeProps()}/>
                                     <line x1="10" y1="4" x2="10" y2="20" ${getStrokeProps()}/>
                                     <line x1="14" y1="4" x2="14" y2="20" ${getStrokeProps()}/>
                                     <line x1="18" y1="4" x2="18" y2="20" ${getStrokeProps()}/>
                                     <rect x="6" y="8" width="12" height="8" rx="1" fill="${color}" fill-opacity="0.2" stroke="none" />`;
                        break;
                }

                svgContent += `<g transform="${transform}">${innerPath}</g>`;
            } else if (s.type === 'dimension') {
                 if (s.subType === 'radial' || s.subType === 'diameter') {
                     // Radial/Diameter Dimension Export
                     const radius = Math.sqrt(Math.pow(s.p1.x - s.p2.x, 2) + Math.pow(s.p1.y - s.p2.y, 2));
                     const factor = unit === 'cm' ? 10 : (unit === 'm' ? 1000 : 1);
                     
                     // Center mark for export
                     const cmSize = 5; 
                     svgContent += `<line x1="${s.p1.x - cmSize}" y1="${s.p1.y}" x2="${s.p1.x + cmSize}" y2="${s.p1.y}" stroke="${color}" stroke-width="${strokeWidth}" />`;
                     svgContent += `<line x1="${s.p1.x}" y1="${s.p1.y - cmSize}" x2="${s.p1.x}" y2="${s.p1.y + cmSize}" stroke="${color}" stroke-width="${strokeWidth}" />`;

                     if (s.subType === 'diameter') {
                         const diameter = radius * 2;
                         const displayValue = (diameter / factor).toFixed(2);
                         const text = s.textOverride || `Ø ${displayValue}`;

                         // Calculate opposite point for diameter line
                         // P1 is center, P2 is one side.
                         const vecX = s.p1.x - s.p2.x;
                         const vecY = s.p1.y - s.p2.y;
                         const oppositeX = s.p1.x + vecX;
                         const oppositeY = s.p1.y + vecY;

                         svgContent += `<line x1="${s.p2.x}" y1="${s.p2.y}" x2="${oppositeX}" y2="${oppositeY}" stroke="${color}" stroke-width="${strokeWidth}" marker-start="url(#arrow)" marker-end="url(#arrow)" />`;
                         
                         svgContent += `<text x="${s.offsetPoint.x}" y="${s.offsetPoint.y}" fill="${color}" font-size="${s.fontSize || 4}" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${text}</text>`;

                     } else {
                         // Radial
                         const displayValue = (radius / factor).toFixed(2);
                         const text = s.textOverride || `R ${displayValue}`;
                         
                         svgContent += `<line x1="${s.p1.x}" y1="${s.p1.y}" x2="${s.p2.x}" y2="${s.p2.y}" stroke="${color}" stroke-width="${strokeWidth}" marker-end="url(#arrow)" />`;
                         
                         // Leader line if offset
                         const distOffset = Math.sqrt(Math.pow(s.p2.x - s.offsetPoint.x, 2) + Math.pow(s.p2.y - s.offsetPoint.y, 2));
                         if (distOffset > 1) {
                             svgContent += `<line x1="${s.p2.x}" y1="${s.p2.y}" x2="${s.offsetPoint.x}" y2="${s.offsetPoint.y}" stroke="${color}" stroke-width="${strokeWidth}" />`;
                         }

                         svgContent += `<text x="${s.offsetPoint.x}" y="${s.offsetPoint.y}" fill="${color}" font-size="${s.fontSize || 4}" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${text}</text>`;
                     }

                 } else {
                     // Linear Dimension Export
                     svgContent += `<line x1="${s.p1.x}" y1="${s.p1.y}" x2="${s.p2.x}" y2="${s.p2.y}" stroke="${color}" stroke-width="${strokeWidth}" />`;
                     const midX = (s.p1.x + s.p2.x) / 2;
                     const midY = (s.p1.y + s.p2.y) / 2;
                     const dist = Math.sqrt(Math.pow(s.p1.x - s.p2.x, 2) + Math.pow(s.p1.y - s.p2.y, 2));
                     
                     const factor = unit === 'cm' ? 10 : (unit === 'm' ? 1000 : 1);
                     const displayValue = (dist / factor).toFixed(2);

                     const angle = (Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x) * 180 / Math.PI + 360) % 360;
                     let textAngle = angle;
                     if (textAngle > 90 && textAngle < 270) {
                         textAngle -= 180;
                     }
                     
                     // Use negation for CCW rotation standard
                     svgContent += `<text x="${midX}" y="${midY}" fill="${color}" font-size="${s.fontSize || 4}" font-family="sans-serif" text-anchor="middle" transform="rotate(${-textAngle} ${midX} ${midY})">${s.textOverride || displayValue}</text>`;
                 }
             }
        });

        svgContent += `</svg>`;
        return { content: svgContent, width: vbW, height: vbH };
    };

    const performExport = () => {
        const { format, scope, theme, optimizeLines, paperSize } = exportConfig;
        const result = generateSvgString(scope, theme, optimizeLines);
        
        if (!result) {
             setShowExportModal(false);
             return;
        }

        const fileNameWithoutExt = currentFileName.replace('.json', '');

        if (format === 'svg') {
            downloadFile(`${fileNameWithoutExt}.svg`, result.content, 'image/svg+xml');
        } else if (format === 'png' || format === 'jpg') {
            const { content, width, height } = result;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            const svgBlob = new Blob([content], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);

            // High Resolution Export Target (4K approx)
            const TARGET_MAX_PIXEL = 4096;
            const currentMax = Math.max(width, height);
            const scaleFactor = TARGET_MAX_PIXEL / currentMax;
            
            // Calculate final canvas dimensions
            const canvasW = width * scaleFactor;
            const canvasH = height * scaleFactor;

            img.onload = () => {
                canvas.width = canvasW;
                canvas.height = canvasH;
                if (ctx) {
                    // For JPG, fill white background first
                    if (format === 'jpg' || theme === 'light') {
                         ctx.fillStyle = theme === 'light' ? '#FFFFFF' : '#000000';
                         ctx.fillRect(0, 0, canvasW, canvasH);
                    } else {
                         // Dark theme PNG: Fill black if desired, or leave transparent.
                         // Usually for viewing CAD, black background is better.
                         ctx.fillStyle = '#000000';
                         ctx.fillRect(0, 0, canvasW, canvasH);
                    }

                    // Draw image scaled to fit the high-res canvas
                    ctx.drawImage(img, 0, 0, canvasW, canvasH);
                    
                    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
                    // Maximum quality for JPG
                    const dataUrl = canvas.toDataURL(mimeType, 1.0);
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = `${fileNameWithoutExt}.${format}`;
                    a.click();
                    
                    // Clean up memory
                    canvas.remove();
                }
                URL.revokeObjectURL(url);
            };
            img.src = url;
        } else if (format === 'pdf') {
             const printWindow = window.open('', '', 'width=800,height=600');
            if (printWindow) {
                // Assume landscape for drawing exports usually
                const pageCss = `@page { size: ${paperSize} landscape; margin: 0; }`;
                
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
                                        // window.onafterprint = function() { window.close(); }
                                    }, 500);
                                }
                            </script>
                        </body>
                    </html>
                `);
                printWindow.document.close();
            }
        }
        
        setShowExportModal(false);
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
                    </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
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
                    <div className="bg-base-100 dark:bg-dark-base-100 rounded-xl shadow-2xl border border-base-300 dark:border-dark-base-300 w-full max-w-lg animate-in fade-in zoom-in duration-200 overflow-hidden">
                        <div className="p-4 border-b border-base-300 dark:border-dark-base-300 flex justify-between items-center bg-base-200 dark:bg-dark-base-200">
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
                                            onClick={() => setExportConfig(prev => ({...prev, format: fmt, theme: fmt === 'pdf' ? 'light' : prev.theme}))}
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

                            {/* PDF Specific: Paper Size */}
                            {exportConfig.format === 'pdf' && (
                                <div>
                                    <label className="block text-sm font-bold mb-3 opacity-80">Tamaño de Papel</label>
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

                            {/* Theme & Scope */}
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
                                    : 'Nota: Las imágenes se exportan en Alta Resolución (aprox 4K).'}
                            </div>

                            <div className="flex gap-3 mt-6 justify-end pt-4 border-t border-base-300 dark:border-dark-base-300">
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
