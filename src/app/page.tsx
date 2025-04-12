"use client";

import dynamic from 'next/dynamic';
import ClientOnly from "./Components/ClientOnly";
import CommonHeader from './Components/CommonHeader';

const POS = dynamic(() => import('./pages/POS'), { 
    ssr: false,
    loading: () => <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700"></div></div>
});

export default function Home() {
    return (
        <ClientOnly>
            <div className="flex flex-col h-screen bg-teal-700 overflow-hidden">
                {/* Common Header */}
                <CommonHeader activePage="home" />
                
                {/* Main content */}
                <main className="flex-grow overflow-auto">
                    <POS />
                </main>
            </div>
        </ClientOnly>
    );
}
