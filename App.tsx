
import React from 'react';
import { AppProvider } from './context/AppContext';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import Canvas from './components/Canvas';
import AIAssistant from './components/AIAssistant';

const AppContent: React.FC = () => {
    return (
        <div className="flex flex-col h-screen bg-base-100 dark:bg-dark-base-100 text-base-content dark:text-dark-base-content font-sans overflow-hidden">
            <Header />
            <div className="flex flex-grow overflow-hidden">
                <Toolbar />
                <main className="flex-grow flex flex-col relative">
                    <Canvas />
                </main>
                <aside className="w-72 bg-base-100 dark:bg-dark-base-100 border-l border-base-300 dark:border-dark-base-300 flex flex-col flex-shrink-0 overflow-y-auto">
                    <PropertiesPanel />
                </aside>
            </div>
            <AIAssistant />
        </div>
    );
};


const App: React.FC = () => {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};


export default App;
