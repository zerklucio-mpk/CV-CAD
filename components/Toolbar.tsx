
import React, { useMemo, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { Tool } from '../types';
import { 
    MousePointerIcon, LineIcon, RectangleIcon, CircleIcon, UndoIcon, RedoIcon, 
    DimensionIcon, HandIcon, CopyIcon, PasteIcon, CutIcon, TextIcon, MoveIcon, 
    StarIcon, ExtinguisherIcon, EmergencyExitIcon, FirstAidIcon, RestroomIcon,
    TrailerIcon, HydrantIcon, ExtendIcon, RotateCwIcon, ForkliftIcon, PalletIcon, RackIcon, ConveyorIcon, ContainerIcon
} from './Icon';

interface ToolButtonProps {
    label: string;
    tool: Tool;
    icon: React.ReactNode;
    onClick?: () => void;
    isDisabled?: boolean;
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, tool, icon, onClick, isDisabled = false }) => {
    const { activeTool, setActiveTool } = useAppContext();
    const isActive = activeTool === tool;

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else {
            setActiveTool(tool);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={isDisabled}
            className={`flex flex-col items-center justify-center w-full p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                isActive
                    ? 'bg-primary text-primary-content'
                    : 'hover:bg-base-200 dark:hover:bg-dark-base-300'
            }`}
            aria-label={label}
            title={label}
        >
            {icon}
            <span className="text-xs mt-1 text-center">{label}</span>
        </button>
    );
};


const Toolbar: React.FC = () => {
    const { undo, redo, canUndo, canRedo, selectedShapeId, shapes, clipboard, setActiveTool } = useAppContext();
    const selectedShape = useMemo(() => shapes.find(s => s.id === selectedShapeId), [shapes, selectedShapeId]);
    const [showIconMenu, setShowIconMenu] = useState(false);

    const handleIconToolSelect = (tool: Tool) => {
        setActiveTool(tool);
        setShowIconMenu(false);
    };

    return (
        <aside className="w-24 bg-base-100 dark:bg-dark-base-100 p-2 border-r border-base-300 dark:border-dark-base-300 flex flex-col items-center space-y-2 overflow-y-auto relative z-50">
            <ToolButton label="Seleccionar" tool="select" icon={<MousePointerIcon className="w-6 h-6" />} />
            <ToolButton 
                label="Mover" 
                tool="move" 
                icon={<MoveIcon className="w-6 h-6" />}
                isDisabled={!selectedShapeId}
            />
            <ToolButton label="Desplazar" tool="pan" icon={<HandIcon className="w-6 h-6" />} />
            <ToolButton 
                label="Rotar" 
                tool="rotate" 
                icon={<RotateCwIcon className="w-6 h-6" />} 
                isDisabled={!selectedShapeId}
            />
             <hr className="w-full border-base-300 dark:border-dark-base-300 my-1"/>
            <ToolButton label="Copiar" tool="copy-area" icon={<CopyIcon className="w-6 h-6" />} />
            <ToolButton label="Recortar" tool="trim" icon={<CutIcon className="w-6 h-6" />} />
            <ToolButton label="Alargar" tool="extend" icon={<ExtendIcon className="w-6 h-6" />} />
            <ToolButton 
                label="Pegar" 
                tool="paste" 
                icon={<PasteIcon className="w-6 h-6" />}
                isDisabled={!clipboard || clipboard.shapes.length === 0}
            />
             <hr className="w-full border-base-300 dark:border-dark-base-300 my-1"/>
            <ToolButton label="Línea" tool="line" icon={<LineIcon className="w-6 h-6" />} />
            <ToolButton label="Rectángulo" tool="rectangle" icon={<RectangleIcon className="w-6 h-6" />} />
            <ToolButton label="Círculo" tool="circle" icon={<CircleIcon className="w-6 h-6" />} />
            
            <ToolButton label="Texto" tool="text" icon={<TextIcon className="w-6 h-6" />} />
            
            {/* Icon Button with Popup Window */}
            <div className="w-full relative">
                <ToolButton 
                    label="Librería" 
                    tool="icon" 
                    icon={<StarIcon className="w-6 h-6" />} 
                    onClick={() => setShowIconMenu(!showIconMenu)}
                />
                {showIconMenu && (
                    <>
                        {/* Backdrop to close menu when clicking outside */}
                        <div 
                            className="fixed inset-0 z-40 bg-transparent" 
                            onClick={() => setShowIconMenu(false)} 
                        />
                        
                        {/* Floating Window - Fixed position to avoid clipping by overflow-hidden/auto containers */}
                        <div className="fixed left-28 top-1/2 -translate-y-1/2 p-4 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl shadow-2xl grid grid-cols-2 gap-3 w-72 z-50 animate-in fade-in zoom-in duration-200 max-h-[80vh] overflow-y-auto">
                             
                             {/* Section: Logistics */}
                             <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-base-content/50 dark:text-white/70 mb-1">Almacén y Logística</div>

                             <button onClick={() => handleIconToolSelect('icon_forklift')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-yellow-500 mb-2">
                                     <ForkliftIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Montacargas</span>
                             </button>

                             <button onClick={() => handleIconToolSelect('icon_pallet')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-amber-700 mb-2">
                                     <PalletIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Palet</span>
                             </button>

                             <button onClick={() => handleIconToolSelect('icon_rack')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-blue-400 mb-2">
                                     <RackIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Estantería</span>
                             </button>

                             <button onClick={() => handleIconToolSelect('icon_conveyor')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-gray-400 mb-2">
                                     <ConveyorIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Cinta Transp.</span>
                             </button>

                             <button onClick={() => handleIconToolSelect('icon_container')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-blue-700 mb-2">
                                     <ContainerIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Contenedor</span>
                             </button>
                             
                             <button onClick={() => handleIconToolSelect('icon_trailer')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-base-content dark:text-dark-base-content mb-2">
                                     <TrailerIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Tráiler</span>
                             </button>

                             {/* Section: Safety */}
                             <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-base-content/50 dark:text-white/70 mb-1 mt-2">Seguridad y Otros</div>
                             
                             <button onClick={() => handleIconToolSelect('icon_extinguisher')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-secondary mb-2">
                                    <ExtinguisherIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Extintor</span>
                             </button>

                             <button onClick={() => handleIconToolSelect('icon_hydrant')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-red-500 mb-2">
                                     <HydrantIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Hidrante</span>
                             </button>

                             <button onClick={() => handleIconToolSelect('icon_emergency_exit')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-accent mb-2">
                                    <EmergencyExitIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Salida</span>
                             </button>

                             <button onClick={() => handleIconToolSelect('icon_first_aid')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-secondary mb-2">
                                    <FirstAidIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Botiquín</span>
                             </button>

                             <button onClick={() => handleIconToolSelect('icon_restroom')} className="flex flex-col items-center p-3 hover:bg-base-200 dark:hover:bg-dark-base-200 rounded-lg border border-transparent hover:border-base-300 dark:hover:border-dark-base-300 transition-all">
                                 <div className="text-primary mb-2">
                                     <RestroomIcon className="w-8 h-8" />
                                 </div>
                                 <span className="text-xs font-medium dark:text-white">Baños</span>
                             </button>

                        </div>
                    </>
                )}
            </div>

             <hr className="w-full border-base-300 dark:border-dark-base-300 my-1"/>
            <ToolButton 
                label="Acotar" 
                tool="dimension" 
                icon={<DimensionIcon className="w-6 h-6" />}
                isDisabled={!selectedShape || selectedShape.type === 'dimension'}
            />
             <hr className="w-full border-base-300 dark:border-dark-base-300 my-1"/>
            <ToolButton label="Deshacer" tool="select" onClick={undo} isDisabled={!canUndo} icon={<UndoIcon className="w-6 h-6" />} />
            <ToolButton label="Rehacer" tool="select" onClick={redo} isDisabled={!canRedo} icon={<RedoIcon className="w-6 h-6" />} />
        </aside>
    );
};

export default Toolbar;