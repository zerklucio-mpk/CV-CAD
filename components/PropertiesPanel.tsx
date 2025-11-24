
import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { AnyShape, Circle, Line, Rectangle, DrawingProperties, AnyShapePropertyUpdates, Point, Dimension, Unit, Text, SymbolShape, LineType, TitleBlock } from '../types';
import { TrashIcon } from './Icon';

const getUnitConversion = (unit: Unit) => {
    switch (unit) {
        case 'cm': return 10;
        case 'm': return 1000;
        default: return 1;
    }
};

const NumberInput: React.FC<{ label: string; value: number; onChange: (value: number) => void; onKeyDown?: (e: React.KeyboardEvent) => void; unit?: string; step?: number; readOnly?: boolean; min?: number }> = ({ label, value, onChange, onKeyDown, unit, step = 1, readOnly = false, min }) => {
    const [internalValue, setInternalValue] = useState(value.toString());

    useEffect(() => {
        setInternalValue(value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInternalValue(e.target.value);
    };

    const handleBlur = () => {
        const normalizedValue = internalValue.replace(/,/g, '.');
        let num = parseFloat(normalizedValue);
        
        if (!isNaN(num) && isFinite(num)) {
            if (min !== undefined && num < min) {
                num = min;
            }
            onChange(num);
            setInternalValue(num.toString());
        } else {
            setInternalValue(value.toString());
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (onKeyDown) onKeyDown(e);
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <div className="flex items-center justify-between text-sm">
            <label className="text-dark-base-content/80">{label}</label>
            <div className="flex items-center gap-1">
                <input
                    type="text"
                    className={`w-28 bg-dark-base-200 text-right px-2 py-1 rounded-md ${readOnly ? 'opacity-70 cursor-default' : ''}`}
                    value={internalValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    readOnly={readOnly}
                />
                {unit && <span className="text-xs text-dark-base-content/60 w-6 text-left">{unit}</span>}
            </div>
        </div>
    );
};

const TextInput: React.FC<{ label: string; value: string; placeholder?: string; onChange: (value: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void; }> = ({ label, value, placeholder, onChange, onKeyDown }) => {
    const [internalValue, setInternalValue] = useState(value);

    useEffect(() => {
        setInternalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInternalValue(e.target.value);
    };

    const handleBlur = () => {
        onChange(internalValue);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (onKeyDown) onKeyDown(e);
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <div className="flex flex-col gap-1 text-sm">
            <label className="text-dark-base-content/80">{label}</label>
            <input
                type="text"
                placeholder={placeholder}
                className="w-full bg-dark-base-200 text-left px-2 py-1 rounded-md text-dark-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                value={internalValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
            />
        </div>
    );
};


const ColorInput: React.FC<{ label: string; value: string; onChange: (value: string) => void; }> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between px-4 py-2">
        <label className="text-sm text-dark-base-content/80">{label}</label>
        <input
            type="color"
            className="w-10 h-6 p-0 border-none rounded-md bg-transparent"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);


const PropertiesPanel: React.FC = () => {
    const { shapes, selectedShapeId, updateShape, deleteShape, drawingProperties, setDrawingProperties, unit, setSelectedShapeId } = useAppContext();
    const selectedShape = shapes.find(s => s.id === selectedShapeId);

    const conversionFactor = getUnitConversion(unit);

    const handleDrawingPropertyChange = (updates: Partial<DrawingProperties>) => {
        if (selectedShape) {
            updateShape(selectedShape.id, { properties: updates });
        } else {
            setDrawingProperties(updates);
        }
    };
    
    const handleShapePropertyChange = (updates: AnyShapePropertyUpdates) => {
        if (selectedShape) {
            updateShape(selectedShape.id, updates);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
    };
    
    const subtract = (p1: Point, p2: Point) => ({ x: p1.x - p2.x, y: p1.y - p2.y });
    const magnitude = (p: Point) => Math.sqrt(p.x * p.x + p.y * p.y);
    const angle = (p: Point) => (Math.atan2(-p.y, p.x) * 180 / Math.PI + 360) % 360;

    const currentProps = selectedShape?.properties || drawingProperties;

    const renderShapeProperties = (shape: AnyShape) => {
        switch (shape.type) {
            case 'line': {
                const vec = subtract(shape.p2, shape.p1);
                const length = magnitude(vec);
                const ang = angle(vec);
                return (
                     <div className="space-y-2">
                        <NumberInput label={`Punto Inicial X (${unit})`} value={+(shape.p1.x / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ p1: { ...shape.p1, x: v * conversionFactor } })} />
                        <NumberInput label={`Punto Inicial Y (${unit})`} value={+(shape.p1.y / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ p1: { ...shape.p1, y: v * conversionFactor } })} />
                        <NumberInput label={`Longitud (${unit})`} value={+(length / conversionFactor).toFixed(2)} min={0.1} onKeyDown={handleKeyDown} onChange={v => {
                            const newLength = v * conversionFactor;
                            const rad = ang * Math.PI / 180;
                            handleShapePropertyChange({ p2: { x: shape.p1.x + newLength * Math.cos(rad), y: shape.p1.y - newLength * Math.sin(rad) } });
                        }} />
                        <NumberInput label="Ángulo (°)" value={+ang.toFixed(2)} onKeyDown={handleKeyDown} onChange={v => {
                            const rad = v * Math.PI / 180;
                            handleShapePropertyChange({ p2: { x: shape.p1.x + length * Math.cos(rad), y: shape.p1.y - length * Math.sin(rad) } });
                        }} />
                    </div>
                );
            }
            case 'rectangle': {
                 const width = shape.width / conversionFactor;
                 const height = shape.height / conversionFactor;
                 const area = width * height;
                 const perimeter = 2 * (width + height);
                 return (
                    <div className="space-y-2">
                        <NumberInput label={`Punto Inicial X (${unit})`} value={+(shape.x / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ x: v * conversionFactor })} />
                        <NumberInput label={`Punto Inicial Y (${unit})`} value={+(shape.y / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ y: v * conversionFactor })} />
                        <NumberInput label={`Ancho (${unit})`} value={+width.toFixed(2)} min={0.1} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ width: v * conversionFactor })} />
                        <NumberInput label={`Alto (${unit})`} value={+height.toFixed(2)} min={0.1} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ height: v * conversionFactor })} />
                        <NumberInput label="Rotación (°)" value={Math.round(shape.rotation || 0)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ rotation: v })} />
                        <div className="border-t border-dark-base-300 my-2 pt-2"></div>
                        <NumberInput label={`Área (${unit}²)`} value={+area.toFixed(2)} onChange={() => {}} readOnly />
                        <NumberInput label={`Perímetro (${unit})`} value={+perimeter.toFixed(2)} onChange={() => {}} readOnly />
                    </div>
                 );
            }
            case 'circle': {
                const r = shape.r / conversionFactor;
                const area = Math.PI * r * r;
                const circum = 2 * Math.PI * r;
                return (
                    <div className="space-y-2">
                        <NumberInput label={`Centro X (${unit})`} value={+(shape.cx / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ cx: v * conversionFactor })} />
                        <NumberInput label={`Centro Y (${unit})`} value={+(shape.cy / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ cy: v * conversionFactor })} />
                        <NumberInput label={`Radio (${unit})`} value={+r.toFixed(2)} min={0.1} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ r: v * conversionFactor })} />
                         <div className="border-t border-dark-base-300 my-2 pt-2"></div>
                        <NumberInput label={`Área (${unit}²)`} value={+area.toFixed(2)} onChange={() => {}} readOnly />
                        <NumberInput label={`Circunferencia (${unit})`} value={+circum.toFixed(2)} onChange={() => {}} readOnly />
                    </div>
                );
            }
            case 'dimension': {
                 return (
                    <>
                        <div className="space-y-2">
                            <NumberInput label={`Punto 1 X (${unit})`} value={+(shape.p1.x / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ p1: { ...shape.p1, x: v * conversionFactor } })} />
                            <NumberInput label={`Punto 1 Y (${unit})`} value={+(shape.p1.y / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ p1: { ...shape.p1, y: v * conversionFactor } })} />
                            <NumberInput label={`Punto 2 X (${unit})`} value={+(shape.p2.x / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ p2: { ...shape.p2, x: v * conversionFactor } })} />
                            <NumberInput label={`Punto 2 Y (${unit})`} value={+(shape.p2.y / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ p2: { ...shape.p2, y: v * conversionFactor } })} />
                            <NumberInput label={`Offset X (${unit})`} value={+(shape.offsetPoint.x / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ offsetPoint: { ...shape.offsetPoint, x: v * conversionFactor } })} />
                            <NumberInput label={`Offset Y (${unit})`} value={+(shape.offsetPoint.y / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ offsetPoint: { ...shape.offsetPoint, y: v * conversionFactor } })} />
                        </div>
                        
                        {(shape.subType === 'radial' || shape.subType === 'diameter') && (
                            <div className="px-0 py-2">
                                <label className="text-xs text-dark-base-content/80 block mb-1 font-semibold">Tipo de Cota Circular</label>
                                <select
                                    value={shape.subType}
                                    onChange={(e) => handleShapePropertyChange({ subType: e.target.value as 'radial' | 'diameter' })}
                                    className="w-full bg-dark-base-200 text-dark-base-content p-2 rounded-md text-sm border border-transparent focus:border-primary focus:outline-none"
                                >
                                    <option value="radial">Radio (R)</option>
                                    <option value="diameter">Diámetro (Ø)</option>
                                </select>
                            </div>
                        )}

                        <div className="py-2">
                             <h3 className="px-4 py-2 text-sm font-semibold text-dark-base-content/70">Detalles de Cota</h3>
                             <div className="px-4 space-y-2">
                                <TextInput 
                                    label="Texto"
                                    placeholder="Auto"
                                    value={shape.textOverride ?? ''}
                                    onKeyDown={handleKeyDown}
                                    onChange={v => handleShapePropertyChange({ textOverride: v === '' ? null : v })}
                                />
                                <NumberInput 
                                    label="Tamaño Texto"
                                    value={shape.fontSize ?? 4}
                                    min={1}
                                    onKeyDown={handleKeyDown}
                                    onChange={v => handleShapePropertyChange({ fontSize: v })}
                                />
                                <NumberInput
                                    label={`Offset Ext. (${unit})`}
                                    value={+((shape.extensionLineOffset ?? 2) / conversionFactor).toFixed(2)}
                                    onKeyDown={handleKeyDown}
                                    onChange={v => handleShapePropertyChange({ extensionLineOffset: v * conversionFactor })}
                                />
                                <NumberInput
                                    label={`Sobresale Ext. (${unit})`}
                                    value={+((shape.extensionLineOvershoot ?? 2) / conversionFactor).toFixed(2)}
                                    onKeyDown={handleKeyDown}
                                    onChange={v => handleShapePropertyChange({ extensionLineOvershoot: v * conversionFactor })}
                                />
                             </div>
                        </div>
                    </>
                 );
            }
            case 'text': {
                return (
                    <div className="space-y-2">
                        <TextInput label="Contenido" value={shape.content} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ content: v })} />
                        <NumberInput label={`Posición X (${unit})`} value={+(shape.x / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ x: v * conversionFactor })} />
                        <NumberInput label={`Posición Y (${unit})`} value={+(shape.y / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ y: v * conversionFactor })} />
                        <NumberInput label="Tamaño Fuente" value={shape.fontSize} min={1} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ fontSize: v })} />
                        <NumberInput label="Rotación (°)" value={Math.round(shape.rotation || 0)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ rotation: v })} />
                    </div>
                );
            }
            case 'symbol': {
                 return (
                    <div className="space-y-2">
                        <NumberInput label={`Posición X (${unit})`} value={+(shape.x / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ x: v * conversionFactor })} />
                        <NumberInput label={`Posición Y (${unit})`} value={+(shape.y / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ y: v * conversionFactor })} />
                        <NumberInput label={`Tamaño`} value={shape.size} min={5} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ size: v })} />
                        <NumberInput label="Rotación (°)" value={Math.round(shape.rotation || 0)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ rotation: v })} />
                    </div>
                );
            }
            case 'title_block': {
                return (
                    <div className="space-y-2">
                        <h4 className="font-semibold text-xs opacity-70 mt-2">Geometría</h4>
                        <NumberInput label={`Posición X (${unit})`} value={+(shape.x / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ x: v * conversionFactor })} />
                        <NumberInput label={`Posición Y (${unit})`} value={+(shape.y / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ y: v * conversionFactor })} />
                        <NumberInput label={`Ancho (${unit})`} value={+(shape.width / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ width: v * conversionFactor })} />
                        <NumberInput label={`Alto (${unit})`} value={+(shape.height / conversionFactor).toFixed(2)} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ height: v * conversionFactor })} />
                        
                        <div className="border-t border-dark-base-300 my-2 pt-2"></div>
                        <h4 className="font-semibold text-xs opacity-70">Tipografía</h4>
                        <NumberInput label="Escala Fuente" value={shape.fontScale || 1} step={0.1} min={0.1} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ fontScale: v })} />
                        <NumberInput label="Espaciado Letras" value={shape.letterSpacing || 0} step={0.5} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ letterSpacing: v })} />
                        <NumberInput label="Espaciado Líneas" value={shape.lineSpacing || 1} step={0.1} min={0.1} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ lineSpacing: v })} />

                        <div className="border-t border-dark-base-300 my-2 pt-2"></div>
                        <h4 className="font-semibold text-xs opacity-70">Datos del Proyecto</h4>
                        
                        <TextInput label="Empresa" value={shape.data.company} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ data: { company: v } })} />
                        <TextInput label="Proyecto" value={shape.data.project} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ data: { project: v } })} />
                        <TextInput label="Plano/Clave" value={shape.data.sheet} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ data: { sheet: v } })} />
                        <div className="grid grid-cols-2 gap-2">
                            <TextInput label="Escala" value={shape.data.scale} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ data: { scale: v } })} />
                            <TextInput label="Revisión" value={shape.data.revision} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ data: { revision: v } })} />
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                            <TextInput label="Realizó" value={shape.data.drawnBy} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ data: { drawnBy: v } })} />
                            <TextInput label="Revisó" value={shape.data.checkedBy} onKeyDown={handleKeyDown} onChange={v => handleShapePropertyChange({ data: { checkedBy: v } })} />
                        </div>
                    </div>
                );
            }
            default:
                return <p className="px-4 py-2 text-sm text-dark-base-content/60">No hay propiedades editables.</p>;
        }
    };
    

    return (
        <div className="flex flex-col h-full text-sm">
            <h2 className="text-base font-semibold p-4 border-b border-dark-base-300">
                {selectedShape ? `Propiedades (${selectedShape.type})` : 'Propiedades de Dibujo'}
            </h2>
            <div className="flex-grow overflow-y-auto">
                {selectedShape && (
                    <div className="py-2 px-4 space-y-2">
                        <h3 className="py-2 text-sm font-semibold text-dark-base-content/70">Geometría</h3>
                        {renderShapeProperties(selectedShape)}
                    </div>
                )}
                 <div className="py-2">
                    <h3 className="px-4 py-2 text-sm font-semibold text-dark-base-content/70">Apariencia</h3>
                    <ColorInput label="Color Trazo" value={currentProps.color} onChange={v => handleDrawingPropertyChange({ color: v })} />
                    <ColorInput label="Relleno" value={currentProps.fill} onChange={v => handleDrawingPropertyChange({ fill: v })} />
                    <div className="px-4 py-2 space-y-2">
                        <NumberInput label={`Grosor Trazo (mm)`} value={currentProps.strokeWidth} onChange={v => handleDrawingPropertyChange({ strokeWidth: v })} step={0.1} min={0.1}/>
                    </div>
                     <div className="px-4 py-2 space-y-2">
                        <label className="text-sm text-dark-base-content/80">Tipo de Línea</label>
                        <select
                            value={currentProps.lineType || 'solid'}
                            onChange={(e) => handleDrawingPropertyChange({ lineType: e.target.value as LineType })}
                            className="w-full bg-dark-base-200 text-dark-base-content p-2 rounded-md text-sm border border-transparent focus:border-primary focus:outline-none"
                        >
                            <option value="solid">Sólida</option>
                            <option value="dashed">Discontinua ( - - - )</option>
                            <option value="dotted">Punteada ( · · · )</option>
                            <option value="dash-dot">Trazo y Punto ( - · - )</option>
                        </select>
                    </div>
                </div>
                 {selectedShape && (
                    <div className="px-4 py-4">
                        <button 
                            onClick={() => {
                                deleteShape(selectedShape.id);
                                setSelectedShapeId(null);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-400 border border-red-400/50 rounded-lg hover:bg-red-400/10"
                        >
                            <TrashIcon className="w-4 h-4" />
                            Eliminar Forma
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropertiesPanel;
