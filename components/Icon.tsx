




// This file contains all the SVG icon components used throughout the application.

import React from 'react';

// Common props for all icons
type IconProps = React.SVGProps<SVGSVGElement>;

export const MousePointerIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    </svg>
);

export const HandIcon: React.FC<IconProps> = (props) => (
     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
        <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
        <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2" />
    </svg>
);

export const LineIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="4" cy="20" r="2" fill="currentColor" stroke="none"/>
        <circle cx="20" cy="4" r="2" fill="currentColor" stroke="none"/>
        <line x1="4" y1="20" x2="20" y2="4" />
    </svg>
);

export const RectangleIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="3" cy="3" r="1" fill="currentColor" stroke="none" />
        <circle cx="21" cy="21" r="1" fill="currentColor" stroke="none" />
    </svg>
);

export const CircleIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
);

export const ArcIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <circle cx="3" cy="8" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="3" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="21" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
);

export const DimensionIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 12h16" />
        <path d="M4 12l4-4" />
        <path d="M4 12l4 4" />
        <path d="M20 12l-4-4" />
        <path d="M20 12l-4 4" />
        <line x1="4" y1="5" x2="4" y2="19" strokeWidth="2" />
        <line x1="20" y1="5" x2="20" y2="19" strokeWidth="2" />
    </svg>
);

export const UndoIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M9 14 4 9l5-5"/>
        <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
    </svg>
);

export const RedoIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m15 14 5-5-5-5"/>
        <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/>
    </svg>
);

export const TrashIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
);

export const CheckIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export const CopyIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
);

export const PasteIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
);

export const CutIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M6 10a3 3 0 1 0-2.6 5" />
        <path d="m10.5 13.5 3-4.5" />
        <path d="M6 10a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
        <path d="M20.4 4 12.5 16" />
    </svg>
);

export const ExtendIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M20 2v20" strokeDasharray="4 2" />
        <line x1="4" y1="12" x2="14" y2="12" />
        <path d="M14 9l3 3-3 3" />
    </svg>
);

export const RotateCwIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
    </svg>
);

export const TextIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 4V2h16v2" />
        <path d="M12 2v18" />
        <path d="M8 22h8" />
        <path d="M4 8h16" opacity="0.3" />
    </svg>
);

export const MoveIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M5 9l-3 3 3 3" />
        <path d="M9 5l3-3 3 3" />
        <path d="M19 9l3 3-3 3" />
        <path d="M15 19l-3 3-3-3" />
        <path d="M2 12h20" />
        <path d="M12 2v20" />
    </svg>
);

export const StarIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <circle cx="6.5" cy="17.5" r="3.5" />
    </svg>
);

// --- ARCHITECTURE ICONS ---

export const DoorIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M3 21V3" />
        <path d="M3 3h14v18" />
        <path d="M17 21H3" />
        <path d="M3 21c9.941 0 18-8.059 18-18" strokeDasharray="2 2"/>
    </svg>
);

export const WindowIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="6" width="18" height="12" strokeWidth="2" />
        <line x1="3" y1="12" x2="21" y2="12" strokeWidth="1.5" />
        <line x1="12" y1="6" x2="12" y2="18" strokeWidth="1.5" />
    </svg>
);


// --- SIGNAGE & LOGISTICS ICONS (Signage Style) ---

export const ExtinguisherIcon: React.FC<IconProps> = (props) => (
     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Square Frame */}
        <rect x="2" y="2" width="20" height="20" rx="2" strokeWidth="2"/>
        {/* Simplified Extinguisher */}
        <path d="M12 6v-1" strokeWidth="2"/>
        <path d="M9 10h6" strokeWidth="1.5"/>
        <path d="M12 8a2 2 0 0 0-2 2v8a2 2 0 0 0 4 0v-8a2 2 0 0 0-2-2z" fill="currentColor" fillOpacity="0.2" />
        <path d="M12 10l3-2" strokeWidth="1.5"/>
    </svg>
);

export const EmergencyExitIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Rect Frame */}
        <rect x="1" y="4" width="22" height="16" rx="2" strokeWidth="2" />
        {/* Door */}
        <rect x="4" y="6" width="6" height="12" strokeWidth="1.5" />
        {/* Running Man Abstract */}
        <circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none"/>
        <path d="M13 12l2-1 2 1.5" strokeWidth="1.5"/>
        <path d="M15 11v4" strokeWidth="1.5"/>
        <path d="M15 15l-2 3" strokeWidth="1.5"/>
        <path d="M15 15l2 2 1-1" strokeWidth="1.5"/>
    </svg>
);

export const FirstAidIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Square Frame */}
        <rect x="2" y="2" width="20" height="20" rx="2" strokeWidth="2" />
        {/* Filled Cross */}
        <rect x="10" y="6" width="4" height="12" fill="currentColor" stroke="none"/>
        <rect x="6" y="10" width="12" height="4" fill="currentColor" stroke="none"/>
    </svg>
);

export const RestroomIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
         {/* Square Frame */}
        <rect x="2" y="2" width="20" height="20" rx="2" strokeWidth="2"/>
        {/* Divider */}
        <line x1="12" y1="4" x2="12" y2="20" strokeWidth="1"/>
        {/* Man */}
        <circle cx="7" cy="8" r="1.5" fill="currentColor" stroke="none" />
        <path d="M5.5 11h3v5h-3z" fill="currentColor" stroke="none" />
        <line x1="6" y1="16" x2="6" y2="19" strokeWidth="1.5"/>
        <line x1="8" y1="16" x2="8" y2="19" strokeWidth="1.5"/>
        {/* Woman */}
        <circle cx="17" cy="8" r="1.5" fill="currentColor" stroke="none" />
        <path d="M17 10l-2 4h4l-2-4z" fill="currentColor" stroke="none" />
        <line x1="16" y1="14" x2="16" y2="19" strokeWidth="1.5"/>
        <line x1="18" y1="14" x2="18" y2="19" strokeWidth="1.5"/>
    </svg>
);

export const HydrantIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
         {/* Square Frame */}
         <rect x="2" y="2" width="20" height="20" rx="2" strokeWidth="2"/>
         {/* H Letter */}
         <path d="M8 7v10" strokeWidth="3"/>
         <path d="M16 7v10" strokeWidth="3"/>
         <path d="M8 12h8" strokeWidth="3"/>
    </svg>
);

export const TrailerIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Dock/Zone Frame */}
        <rect x="2" y="4" width="20" height="16" rx="0" strokeWidth="2" />
        <line x1="2" y1="4" x2="22" y2="20" strokeWidth="1" opacity="0.2"/>
        <line x1="22" y1="4" x2="2" y2="20" strokeWidth="1" opacity="0.2"/>
        {/* Truck Representation */}
        <rect x="6" y="8" width="12" height="8" rx="1" fill="currentColor" fillOpacity="0.3" stroke="none" />
        <line x1="18" y1="10" x2="21" y2="10" strokeWidth="2" />
        <line x1="18" y1="14" x2="21" y2="14" strokeWidth="2" />
    </svg>
);


// Logistics Icons
export const ForkliftIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Diamond Frame (Warning Zone) */}
        <rect x="12" y="2.5" width="13.5" height="13.5" transform="rotate(45 12 2.5)" rx="1" strokeWidth="2" />
        {/* Forklift Glyph */}
        <path d="M9 16h3v-5h-2v-1h3l1 6h-5z" fill="currentColor" stroke="none"/>
        <path d="M14 10v6" strokeWidth="1.5"/>
        <line x1="7" y1="16" x2="9" y2="16" strokeWidth="1.5"/>
        <circle cx="10" cy="17" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="15" cy="17" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
);

export const PalletIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Zone Frame */}
        <rect x="2" y="2" width="20" height="20" rx="1" strokeWidth="2" />
        {/* Pallet Symbol */}
        <rect x="5" y="5" width="14" height="14" strokeWidth="1.5" />
        <line x1="5" y1="12" x2="19" y2="12" strokeWidth="1"/>
        <line x1="12" y1="5" x2="12" y2="19" strokeWidth="1"/>
    </svg>
);

export const RackIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Frame */}
        <rect x="2" y="2" width="20" height="20" strokeWidth="2"/>
        {/* Shelves */}
        <line x1="2" y1="8" x2="22" y2="8" strokeWidth="1.5"/>
        <line x1="2" y1="16" x2="22" y2="16" strokeWidth="1.5"/>
        <line x1="7" y1="2" x2="7" y2="22" strokeWidth="1.5"/>
        <line x1="17" y1="2" x2="17" y2="22" strokeWidth="1.5"/>
    </svg>
);

export const ConveyorIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
         {/* Frame */}
         <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth="2" />
         {/* Rollers */}
         <circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"/>
         <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
         <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"/>
    </svg>
);

export const ContainerIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
         {/* Frame */}
         <rect x="2" y="4" width="20" height="16" strokeWidth="2" />
         {/* Ribs */}
         <line x1="6" y1="4" x2="6" y2="20" strokeWidth="1.5"/>
         <line x1="10" y1="4" x2="10" y2="20" strokeWidth="1.5"/>
         <line x1="14" y1="4" x2="14" y2="20" strokeWidth="1.5"/>
         <line x1="18" y1="4" x2="18" y2="20" strokeWidth="1.5"/>
         {/* Filled Zone */}
         <rect x="6" y="8" width="12" height="8" rx="1" fill="currentColor" fillOpacity="0.2" stroke="none" />
    </svg>
);


export const SparklesIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
        <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" opacity="0.5" transform="scale(0.5) translate(10, 10)"/>
        <path d="M16 4l1.2 3.6h3.8l-3 2.4 1.2 3.6-3-2.4-3 2.4 1.2-3.6-3-2.4h3.8z" />
        <path d="M6 12l1.6 4.8h4.8l-3.6 3.2 1.6 4.8-3.6-3.2-3.6 3.2 1.6-4.8-3.6-3.2h4.8z" />
    </svg>
);

// New Icons for File Operations
export const SaveIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </svg>
);

export const FolderOpenIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
    </svg>
);

export const FilePlusIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
);

export const DownloadIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

export const XIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);

export const ChevronUpIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="18 15 12 9 6 15" />
    </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

export const HomeIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

export const PlusIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

export const MinusIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

export const ImageIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
);

export const EyeIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

export const EyeOffIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
);

export const SettingsIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);
