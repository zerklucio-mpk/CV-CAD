
import React, { createContext, useState, useCallback, useMemo } from 'react';
import { AnyShape, DrawingProperties, Tool, Unit, SnapMode, AnyShapePropertyUpdates, Point, TemplateImage } from '../types';

// Improved unique ID generator to avoid collisions during batch operations
const generateId = () => `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper to ensure numbers are valid finite numbers
const isValidNumber = (num: any): boolean => {
    return typeof num === 'number' && Number.isFinite(num) && !Number.isNaN(num);
};

// Helper to validate updates and prevent corrupt state
const validateUpdates = (updates: AnyShapePropertyUpdates): AnyShapePropertyUpdates => {
    const safeUpdates: AnyShapePropertyUpdates = {};
    
    Object.entries(updates).forEach(([key, value]) => {
        if (key === 'p1' || key === 'p2' || key === 'offsetPoint') {
            const p = value as Point;
            if (p && isValidNumber(p.x) && isValidNumber(p.y)) {
                (safeUpdates as any)[key] = value;
            }
        } else if (key === 'properties' || key === 'content' || key === 'name' || key === 'subType' || key === 'textOverride' || key === 'data') {
            (safeUpdates as any)[key] = value;
        } else if (typeof value === 'number') {
            if (isValidNumber(value)) {
                // Strict Validation: Prevent negative dimensions causing crashes
                if (['width', 'height', 'r', 'size'].includes(key) && value <= 0.0001) {
                    (safeUpdates as any)[key] = 0.01;
                } else {
                    (safeUpdates as any)[key] = value;
                }
            }
        } else {
             (safeUpdates as any)[key] = value;
        }
    });
    return safeUpdates;
};

export interface Clipboard {
    shapes: AnyShape[];
    origin: Point;
}

// The shape of our context
export interface AppContextType {
    shapes: AnyShape[];
    addShape: (shape: Omit<AnyShape, 'id'>) => void;
    addShapes: (shapes: Omit<AnyShape, 'id'>[]) => void;
    updateShape: (id: string, updates: AnyShapePropertyUpdates) => void;
    updateShapes: (batchUpdates: { id: string, updates: AnyShapePropertyUpdates }[]) => void; // NEW BATCH METHOD
    deleteShape: (id: string) => void;
    deleteShapes: (ids: string[]) => void;
    replaceShapes: (idsToDelete: string[], shapesToAdd: Omit<AnyShape, 'id'>[]) => void;
    createNewDrawing: () => void; 
    selectedShapeId: string | null;
    setSelectedShapeId: (id: string | null) => void;
    // Multi-selection support
    selectedShapeIds: Set<string>;
    setSelectedShapeIds: (ids: Set<string>) => void;
    toggleShapeSelection: (id: string) => void;
    
    activeTool: Tool;
    setActiveTool: (tool: Tool) => void;
    drawingProperties: DrawingProperties;
    setDrawingProperties: (updates: Partial<DrawingProperties>) => void;
    viewTransform: { x: number; y: number; scale: number; };
    setViewTransform: React.Dispatch<React.SetStateAction<{ x: number; y: number; scale: number; }>>;
    unit: Unit;
    setUnit: (unit: Unit) => void;
    snapModes: Set<SnapMode>;
    toggleSnapMode: (mode: SnapMode) => void;
    isOrthoMode: boolean;
    setIsOrthoMode: (isOn: boolean) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    clipboard: Clipboard | null;
    setClipboard: (clipboard: Clipboard | null) => void;
    templateImage: TemplateImage | null;
    setTemplateImage: (template: TemplateImage | null) => void;
    updateTemplateImage: (updates: Partial<TemplateImage>) => void;
}

// Create the context
export const AppContext = createContext<AppContextType | undefined>(undefined);

// Create a provider component
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [history, setHistory] = useState<AnyShape[][]>([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);
    
    // Safety fallback: Ensure shapes is always an array, even if index is out of bounds temporarily
    const shapes = history[historyIndex] || [];

    const [selectedShapeId, _setSelectedShapeId] = useState<string | null>(null);
    const [selectedShapeIds, _setSelectedShapeIds] = useState<Set<string>>(new Set());

    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [drawingProperties, _setDrawingProperties] = useState<DrawingProperties>({
        color: '#FFFFFF',
        fill: 'transparent',
        strokeWidth: 1,
        lineType: 'solid', // Default line type
    });
    const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [unit, setUnit] = useState<Unit>('mm');
    const [snapModes, setSnapModes] = useState<Set<SnapMode>>(new Set(['endpoints', 'midpoints', 'centers', 'inference']));
    const [isOrthoMode, setIsOrthoMode] = useState(true);
    const [clipboard, setClipboard] = useState<Clipboard | null>(null);
    const [templateImage, setTemplateImage] = useState<TemplateImage | null>(null);

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    const updateHistory = useCallback((newShapes: AnyShape[]) => {
        // Prevent adding duplicate states to history
        if (newShapes === shapes) return;

        setHistory(prevHistory => {
            const newHistory = prevHistory.slice(0, historyIndex + 1);
            newHistory.push(newShapes);
            return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex, shapes]);
    
    // Smart setters for selection to keep single/multi states in sync
    const setSelectedShapeId = useCallback((id: string | null) => {
        _setSelectedShapeId(id);
        if (id) {
            _setSelectedShapeIds(new Set([id]));
        } else {
            _setSelectedShapeIds(new Set());
        }
    }, []);

    const setSelectedShapeIds = useCallback((ids: Set<string>) => {
        _setSelectedShapeIds(ids);
        // If only one item is selected, sync it to the primary ID for properties panel compatibility
        if (ids.size === 1) {
            _setSelectedShapeId(Array.from(ids)[0]);
        } else {
            _setSelectedShapeId(null);
        }
    }, []);

    const toggleShapeSelection = useCallback((id: string) => {
        _setSelectedShapeIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            
            // Sync single selection state
            if (newSet.size === 1) {
                _setSelectedShapeId(Array.from(newSet)[0]);
            } else {
                _setSelectedShapeId(null);
            }
            
            return newSet;
        });
    }, []);

    const setDrawingProperties = useCallback((updates: Partial<DrawingProperties>) => {
        _setDrawingProperties(prev => ({...prev, ...updates}));
    }, []);

    const addShape = useCallback((shape: Omit<AnyShape, 'id'>) => {
        const newShape = { ...shape, id: generateId() } as AnyShape;
        if (!newShape.properties) {
             newShape.properties = { color: '#FFFFFF', fill: 'transparent', strokeWidth: 1, lineType: 'solid' };
        } else if (!newShape.properties.lineType) {
             newShape.properties.lineType = 'solid';
        }

        const newShapes = [...shapes, newShape];
        updateHistory(newShapes);
    }, [shapes, updateHistory]);

     const addShapes = useCallback((shapesToAdd: Omit<AnyShape, 'id'>[]) => {
        const newShapesWithIds = shapesToAdd.map(s => {
            const shape = { ...s, id: generateId() } as AnyShape;
            if (!shape.properties) {
                 shape.properties = { color: '#FFFFFF', fill: 'transparent', strokeWidth: 1, lineType: 'solid' };
            } else if (!shape.properties.lineType) {
                 shape.properties.lineType = 'solid';
            }
            return shape;
        });
        const newShapes = [...shapes, ...newShapesWithIds];
        updateHistory(newShapes);
    }, [shapes, updateHistory]);

    const updateShape = useCallback((id: string, updates: AnyShapePropertyUpdates) => {
        const safeUpdates = validateUpdates(updates);
        if (Object.keys(safeUpdates).length === 0 && Object.keys(updates).length > 0 && !updates.properties) {
             return;
        }

        const newShapes = shapes.map(s => {
            if (s.id === id) {
                const updatedShape = { ...s };
                Object.entries(safeUpdates).forEach(([key, value]) => {
                    if (key === 'properties' && value && typeof value === 'object') {
                        updatedShape.properties = { ...updatedShape.properties, ...value };
                    } else if (key === 'data' && value && typeof value === 'object') {
                        (updatedShape as any).data = { ...(updatedShape as any).data, ...value };
                    } else if (value !== undefined) {
                        (updatedShape as any)[key] = value;
                    }
                });
                return updatedShape;
            }
            return s;
        });
        updateHistory(newShapes);
    }, [shapes, updateHistory]);

    // --- CRITICAL FIX: BATCH UPDATE METHOD ---
    // This allows updating multiple shapes in a single render cycle, preventing race conditions
    // where iterating updates would overwrite previous updates in the loop.
    const updateShapes = useCallback((batchUpdates: { id: string, updates: AnyShapePropertyUpdates }[]) => {
        if (batchUpdates.length === 0) return;

        // Create a map for O(1) lookup during mapping
        const updatesMap = new Map<string, AnyShapePropertyUpdates>();
        batchUpdates.forEach(item => {
            updatesMap.set(item.id, validateUpdates(item.updates));
        });

        const newShapes = shapes.map(s => {
            if (updatesMap.has(s.id)) {
                const safeUpdates = updatesMap.get(s.id)!;
                const updatedShape = { ...s };
                Object.entries(safeUpdates).forEach(([key, value]) => {
                    if (key === 'properties' && value && typeof value === 'object') {
                        updatedShape.properties = { ...updatedShape.properties, ...value };
                    } else if (key === 'data' && value && typeof value === 'object') {
                        (updatedShape as any).data = { ...(updatedShape as any).data, ...value };
                    } else if (value !== undefined) {
                        (updatedShape as any)[key] = value;
                    }
                });
                return updatedShape;
            }
            return s;
        });
        updateHistory(newShapes);
    }, [shapes, updateHistory]);


    const deleteShape = useCallback((id: string) => {
        const newShapes = shapes.filter(s => s.id !== id);
        updateHistory(newShapes);
        if (selectedShapeId === id) {
            setSelectedShapeId(null);
        }
    }, [shapes, updateHistory, selectedShapeId, setSelectedShapeId]);
    
    const deleteShapes = useCallback((ids: string[]) => {
        const idsToDelete = new Set(ids);
        const newShapes = shapes.filter(s => !idsToDelete.has(s.id));
        updateHistory(newShapes);
        
        // Update selection states
        _setSelectedShapeIds(prev => {
             const newSet = new Set(prev);
             ids.forEach(id => newSet.delete(id));
             if (newSet.size === 1) _setSelectedShapeId(Array.from(newSet)[0]);
             else _setSelectedShapeId(null);
             return newSet;
        });

    }, [shapes, updateHistory]);

    const replaceShapes = useCallback((idsToDelete: string[], shapesToAdd: Omit<AnyShape, 'id'>[]) => {
        const deleteSet = new Set(idsToDelete);
        const remainingShapes = shapes.filter(s => !deleteSet.has(s.id));
        const newShapesWithIds = shapesToAdd.map(s => {
            const shape = { ...s, id: generateId() } as AnyShape;
            if (!shape.properties.lineType) shape.properties.lineType = 'solid';
            return shape;
        });
        const newShapes = [...remainingShapes, ...newShapesWithIds];
        updateHistory(newShapes);
    }, [shapes, updateHistory]);

    const createNewDrawing = useCallback(() => {
        setHistory([[]]);
        setHistoryIndex(0);
        setSelectedShapeId(null);
        setClipboard(null);
        setTemplateImage(null);
        
        const rootElement = document.getElementById('root');
        if (rootElement) {
             const rect = rootElement.getBoundingClientRect();
             setViewTransform({ x: rect.width / 2, y: rect.height / 2, scale: 1 });
        } else {
             setViewTransform({ x: 0, y: 0, scale: 1 });
        }
    }, [setSelectedShapeId]);

    const undo = useCallback(() => {
        if (canUndo) {
            setHistoryIndex(prev => prev - 1);
            setSelectedShapeId(null);
        }
    }, [canUndo, setSelectedShapeId]);

    const redo = useCallback(() => {
        if (canRedo) {
            setHistoryIndex(prev => prev + 1);
            setSelectedShapeId(null);
        }
    }, [canRedo, setSelectedShapeId]);

    const toggleSnapMode = useCallback((mode: SnapMode) => {
        setSnapModes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(mode)) {
                newSet.delete(mode);
            } else {
                newSet.add(mode);
            }
            return newSet;
        });
    }, []);

    const updateTemplateImage = useCallback((updates: Partial<TemplateImage>) => {
        setTemplateImage(prev => prev ? { ...prev, ...updates } : null);
    }, []);

    const value = useMemo(() => ({
        shapes,
        addShape,
        addShapes,
        updateShape,
        updateShapes, // Exported new method
        deleteShape,
        deleteShapes,
        replaceShapes,
        createNewDrawing,
        selectedShapeId,
        setSelectedShapeId,
        selectedShapeIds,
        setSelectedShapeIds,
        toggleShapeSelection,
        activeTool,
        setActiveTool,
        drawingProperties,
        setDrawingProperties,
        viewTransform,
        setViewTransform,
        unit,
        setUnit,
        snapModes,
        toggleSnapMode,
        isOrthoMode,
        setIsOrthoMode,
        undo,
        redo,
        canUndo,
        canRedo,
        clipboard,
        setClipboard,
        templateImage,
        setTemplateImage,
        updateTemplateImage,
    }), [
        shapes, addShape, addShapes, updateShape, updateShapes, deleteShape, deleteShapes, replaceShapes, createNewDrawing, 
        selectedShapeId, setSelectedShapeId, selectedShapeIds, setSelectedShapeIds, toggleShapeSelection,
        activeTool, drawingProperties, setDrawingProperties, viewTransform, unit, snapModes, toggleSnapMode, isOrthoMode, 
        undo, redo, canUndo, canRedo, clipboard, templateImage, updateTemplateImage
    ]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
