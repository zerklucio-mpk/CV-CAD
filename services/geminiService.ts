




import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnyShape } from "../types";

const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

// Definición del esquema para la respuesta estructurada
// Usamos una estructura plana que abarca las propiedades comunes para simplificar la generación
const shapeSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        type: {
            type: Type.STRING,
            enum: ['line', 'rectangle', 'circle', 'text', 'symbol'],
            description: 'The type of the shape to draw.'
        },
        // Properties for Line
        p1: {
            type: Type.OBJECT,
            properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
            },
            description: 'Start point for lines or dimension lines.'
        },
        p2: {
            type: Type.OBJECT,
            properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
            },
             description: 'End point for lines or dimension lines.'
        },
        // Properties for Rectangle, Text, Symbol
        x: { type: Type.NUMBER, description: 'Top-left X for rect/text/symbol.' },
        y: { type: Type.NUMBER, description: 'Top-left Y for rect/text/symbol.' },
        width: { type: Type.NUMBER, description: 'Width for rectangle.' },
        height: { type: Type.NUMBER, description: 'Height for rectangle.' },
        // Properties for Circle
        cx: { type: Type.NUMBER, description: 'Center X for circle.' },
        cy: { type: Type.NUMBER, description: 'Center Y for circle.' },
        r: { type: Type.NUMBER, description: 'Radius for circle.' },
        startAngle: { type: Type.NUMBER, description: 'Start angle for arcs (degrees).' },
        endAngle: { type: Type.NUMBER, description: 'End angle for arcs (degrees).' },
        // Properties for Text
        content: { type: Type.STRING, description: 'Content for text shape.' },
        fontSize: { type: Type.NUMBER, description: 'Font size for text.' },
        // Properties for Symbol
        name: {
            type: Type.STRING,
            enum: ['door', 'window', 'arrow', 'warning', 'extinguisher', 'emergency_exit', 'first_aid', 'restroom', 'trailer', 'hydrant', 'forklift', 'pallet', 'rack', 'conveyor', 'container'],
            description: 'Name of the symbol icon. Use door/window for architecture.'
        },
        size: { type: Type.NUMBER, description: 'Size of the symbol.' },
        rotation: { type: Type.NUMBER, description: 'Rotation in degrees.' },
        // Common Drawing Properties
        properties: {
            type: Type.OBJECT,
            properties: {
                color: { type: Type.STRING, description: 'Stroke color (hex code).' },
                fill: { type: Type.STRING, description: 'Fill color (hex code or transparent).' },
                strokeWidth: { type: Type.NUMBER, description: 'Stroke width in pixels.' },
                lineType: { 
                    type: Type.STRING, 
                    enum: ['solid', 'dashed', 'dotted', 'dash-dot'],
                    description: 'Line style (solid, dashed, dotted, dash-dot)'
                }
            }
        }
    },
    required: ['type']
};

export const generateCadData = async (prompt: string): Promise<any[]> => {
    if (!apiKey) {
        console.error("API Key not found");
        return [];
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: `You are an expert CAD assistant capable of generating 2D geometric shapes based on natural language descriptions.
                
                Coordinate System Rules:
                - Origin (0,0) is top-left.
                - X increases to the right.
                - Y increases downwards.
                - Assume 1 unit = 1 mm (unless specified otherwise).
                - Typically, a standard room might be 4000x3000 units.
                
                Task:
                - Analyze the user's request.
                - Generate a list of geometric shapes (lines, rectangles, circles, text, symbols) to fulfill the request.
                - For walls, use rectangles with thin width or double lines.
                - For doors and windows, use the 'symbol' type with name 'door' or 'window'.
                - For arcs, use 'circle' type and specify startAngle and endAngle.
                - For logistics, use symbols like 'forklift', 'pallet', 'rack', 'conveyor'.
                - If the user requests dashed or dotted lines (e.g. for projections, hidden lines), use the lineType property.
                - Default stroke color: #FFFFFF.
                - Default stroke width: 1 or 2.
                - If not specified, assume a central starting position around (0,0) or (2000, 2000).
                
                Output:
                - Return ONLY a JSON array of shape objects.
                `,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: shapeSchema
                }
            },
            contents: prompt
        });

        const text = response.text;
        if (!text) return [];
        
        const data = JSON.parse(text);
        return Array.isArray(data) ? data : [];

    } catch (error) {
        console.error("Error generating CAD data:", error);
        throw error;
    }
};
