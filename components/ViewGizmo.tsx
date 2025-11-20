
import React from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { ChevronUpIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, HomeIcon, PlusIcon, MinusIcon } from './Icon';

const ViewGizmo: React.FC = () => {
    const { viewTransform, setViewTransform, createNewDrawing } = useAppContext();

    const handlePan = (dx: number, dy: number) => {
        setViewTransform(prev => ({
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy
        }));
    };

    const handleZoom = (factor: number) => {
        setViewTransform(prev => ({
            ...prev,
            scale: prev.scale * factor,
            // Zoom towards center of screen roughly
            // Simple implementation: just zoom, center drift accepted for simple gizmo
            // Better: scale around center of view
        }));
    };
    
    const resetView = () => {
        const rootElement = document.getElementById('root');
        if (rootElement) {
             const rect = rootElement.getBoundingClientRect();
             setViewTransform({ x: rect.width / 2, y: rect.height / 2, scale: 1 });
        } else {
             setViewTransform({ x: 0, y: 0, scale: 1 });
        }
    };

    const btnClass = "bg-base-100 dark:bg-dark-base-300 hover:bg-base-200 dark:hover:bg-dark-base-200 text-base-content dark:text-dark-base-content p-1.5 rounded-md shadow-md border border-base-300 dark:border-dark-base-100 transition-colors flex items-center justify-center";

    return (
        <div className="absolute bottom-8 right-8 z-[50] flex flex-col gap-4 select-none">
            {/* Pan Controls */}
            <div className="relative w-24 h-24 bg-transparent">
                <div className="absolute top-0 left-1/2 -translate-x-1/2">
                    <button onClick={() => handlePan(0, 50)} className={btnClass} title="Pan Up">
                        <ChevronUpIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
                    <button onClick={() => handlePan(0, -50)} className={btnClass} title="Pan Down">
                        <ChevronDownIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                    <button onClick={() => handlePan(50, 0)} className={btnClass} title="Pan Left">
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    <button onClick={() => handlePan(-50, 0)} className={btnClass} title="Pan Right">
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <button onClick={resetView} className={`${btnClass} p-2 rounded-full bg-primary text-white border-none`} title="Reset View">
                        <HomeIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex flex-col gap-2 items-center">
                <button onClick={() => handleZoom(1.2)} className={btnClass} title="Zoom In">
                    <PlusIcon className="w-5 h-5" />
                </button>
                <button onClick={() => handleZoom(0.8)} className={btnClass} title="Zoom Out">
                    <MinusIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default ViewGizmo;
