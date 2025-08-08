import React, { useEffect } from 'react';

// Game Logo Component
export const GameLogo = ({ className }) => (
    <img 
        src="https://i.ibb.co/ks5kVy20/Chat-GPT-Image-Aug-8-2025-05-47-52-PM.png" 
        alt="Murder Mystery Logo" 
        className={`w-48 ${className}`}
    />
);

// Notification Popup Container
export function NotificationContainer({ notifications }) {
    return (
        <div className="fixed top-5 right-5 z-[100] w-full max-w-xs">
            <div className="flex flex-col-reverse gap-2">
                {notifications.map(n => (
                    <div key={n.id} className="bg-gradient-to-br from-emerald-500 to-green-600 text-white p-4 rounded-lg shadow-lg animate-fade-in-out flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        <span>{n.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Component to load external scripts and styles
export function ScriptLoader() {
    useEffect(() => {
        const papaScript = document.createElement('script');
        papaScript.src = "https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js";
        papaScript.async = true;
        document.body.appendChild(papaScript);

        const fontLink = document.createElement('link');
        fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
        fontLink.rel = "stylesheet";
        document.head.appendChild(fontLink);

        const customStyles = document.createElement('style');
        customStyles.innerHTML = `
            @keyframes fade-in-out {
                0% { opacity: 0; transform: translateX(100%); }
                10% { opacity: 1; transform: translateX(0); }
                90% { opacity: 1; transform: translateX(0); }
                100% { opacity: 0; transform: translateX(100%); }
            }
            .animate-fade-in-out {
                animation: fade-in-out 5s ease-in-out forwards;
            }
            body {
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
        `;
        document.head.appendChild(customStyles);

        return () => {
            if (document.body.contains(papaScript)) {
                document.body.removeChild(papaScript);
            }
            if (document.head.contains(fontLink)) {
                document.head.removeChild(fontLink);
            }
            if (document.head.contains(customStyles)) {
                document.head.removeChild(customStyles);
            }
        };
    }, []);
    return null;
}

// Generic Modal Component
export function Modal({ message, onClose }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-neutral-900 p-6 rounded-lg shadow-xl max-w-sm w-full text-center border border-neutral-800">
                <p className="text-slate-100 text-lg mb-6">{message}</p>
                <button onClick={onClose} className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md hover:bg-cyan-700">OK</button>
            </div>
        </div>
    );
}

// Confirmation Modal Component
export function ConfirmationModal({ message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-neutral-900 p-6 rounded-lg shadow-xl max-w-sm w-full text-center border border-neutral-800">
                <p className="text-slate-100 text-lg mb-6">{message}</p>
                <div className="flex justify-center space-x-4">
                    <button onClick={onConfirm} className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md">Confirm</button>
                    <button onClick={onCancel} className="bg-neutral-700 hover:bg-neutral-600 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md">Cancel</button>
                </div>
            </div>
        </div>
    );
}
