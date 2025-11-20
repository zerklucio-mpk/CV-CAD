
import React, { createContext, useState, useCallback, useMemo } from 'react';
import { AnyShape, DrawingProperties, Tool, Unit, SnapMode, AnyShapePropertyUpdates, Point } from '../types';

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
        } else if (key === 'properties' || key === 'content' || key === 'name' || key === 'subType' || key === 'textOverride') {
            (safeUpdates as any)[key] = value;
        } else if (typeof value === 'number') {
            if (isValidNumber(value)) {
                // Strict Validation: Prevent negative dimensions causing crashes
                if (['width', 'height', 'r', 'size'].includes(key) && value <= 0.0001) {
                    // Skip invalid update or clamp? Let's skip to be safe against corruption
                    // or clamp to tiny value
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
    deleteShape: (id: string) => void;
    deleteShapes: (ids: string[]) => void;
    replaceShapes: (idsToDelete: string[], shapesToAdd: Omit<AnyShape, 'id'>[]) => void;
    createNewDrawing: () => void; 
    selectedShapeId: string | null;
    setSelectedShapeId: (id: string | null) => void;
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
}

// Create the context
export const AppContext = createContext<AppContextType | undefined>(undefined);

// Create a provider component
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [history, setHistory] = useState<AnyShape[][]>([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);
    
    // Safety fallback: Ensure shapes is always an array, even if index is out of bounds temporarily
    const shapes = history[historyIndex] || [];

    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [drawingProperties, _setDrawingProperties] = useState<DrawingProperties>({
        color: '#FFFFFF',
        fill: 'transparent',
        strokeWidth: 1,
    });
    const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [unit, setUnit] = useState<Unit>('mm');
    const [snapModes, setSnapModes] = useState<Set<SnapMode>>(new Set(['endpoints', 'midpoints', 'centers', 'inference']));
    const [isOrthoMode, setIsOrthoMode] = useState(true);
    const [clipboard, setClipboard] = useState<Clipboard | null>(null);

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
    
    const setDrawingProperties = useCallback((updates: Partial<DrawingProperties>) => {
        _setDrawingProperties(prev => ({...prev, ...updates}));
    }, []);

    const addShape = useCallback((shape: Omit<AnyShape, 'id'>) => {
        const newShape = { ...shape, id: generateId() } as AnyShape;
        const newShapes = [...shapes, newShape];
        updateHistory(newShapes);
    }, [shapes, updateHistory]);

     const addShapes = useCallback((shapesToAdd: Omit<AnyShape, 'id'>[]) => {
        const newShapesWithIds = shapesToAdd.map(s => ({ ...s, id: generateId() } as AnyShape));
        const newShapes = [...shapes, ...newShapesWithIds];
        updateHistory(newShapes);
    }, [shapes, updateHistory]);

    const updateShape = useCallback((id: string, updates: AnyShapePropertyUpdates) => {
        // Validate updates before applying to prevent NaN poisoning
        const safeUpdates = validateUpdates(updates);
        
        // If validation stripped everything (all invalid), abort
        if (Object.keys(safeUpdates).length === 0 && Object.keys(updates).length > 0 && !updates.properties) {
             return;
        }

        const newShapes = shapes.map(s => {
            if (s.id === id) {
                const updatedShape = { ...s };
                // Handle nested properties update
                Object.entries(safeUpdates).forEach(([key, value]) => {
                    if (key === 'properties' && value && typeof value === 'object') {
                        updatedShape.properties = { ...updatedShape.properties, ...value };
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
    }, [shapes, updateHistory, selectedShapeId]);
    
    const deleteShapes = useCallback((ids: string[]) => {
        const idsToDelete = new Set(ids);
        const newShapes = shapes.filter(s => !idsToDelete.has(s.id));
        updateHistory(newShapes);
        if (selectedShapeId && idsToDelete.has(selectedShapeId)) {
            setSelectedShapeId(null);
        }
    }, [shapes, updateHistory, selectedShapeId]);

    const replaceShapes = useCallback((idsToDelete: string[], shapesToAdd: Omit<AnyShape, 'id'>[]) => {
        const deleteSet = new Set(idsToDelete);
        const remainingShapes = shapes.filter(s => !deleteSet.has(s.id));
        const newShapesWithIds = shapesToAdd.map(s => ({ ...s, id: generateId() } as AnyShape));
        const newShapes = [...remainingShapes, ...newShapesWithIds];
        updateHistory(newShapes);
    }, [shapes, updateHistory]);

    // Completely resets the drawing state
    const createNewDrawing = useCallback(() => {
        setHistory([[]]);
        setHistoryIndex(0);
        setSelectedShapeId(null);
        setClipboard(null);
        
        const rootElement = document.getElementById('root');
        if (rootElement) {
             const rect = rootElement.getBoundingClientRect();
             // Reset view to center
             setViewTransform({ x: rect.width / 2, y: rect.height / 2, scale: 1 });
        } else {
             setViewTransform({ x: 0, y: 0, scale: 1 });
        }
    }, []);

    const undo = useCallback(() => {
        if (canUndo) {
            setHistoryIndex(prev => prev - 1);
            setSelectedShapeId(null); // Clear selection on undo
        }
    }, [canUndo]);

    const redo = useCallback(() => {
        if (canRedo) {
            setHistoryIndex(prev => prev + 1);
            setSelectedShapeId(null); // Clear selection on redo
        }
    }, [canRedo]);

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

    const value = useMemo(() => ({
        shapes,
        addShape,
        addShapes,
        updateShape,
        deleteShape,
        deleteShapes,
        replaceShapes,
        createNewDrawing,
        selectedShapeId,
        setSelectedShapeId,
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
    }), [
        shapes, addShape, addShapes, updateShape, deleteShape, deleteShapes, replaceShapes, createNewDrawing, selectedShapeId, activeTool, drawingProperties, 
        setDrawingProperties, viewTransform, unit, snapModes, toggleSnapMode, isOrthoMode, 
        undo, redo, canUndo, canRedo, clipboard
    ]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
