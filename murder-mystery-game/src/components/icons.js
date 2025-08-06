import React from 'react';

// Base component for consistent icon sizing
const IconBase = ({ children, width = 28, height = 28 }) => (
    <div style={{ width, height }} className="flex items-center justify-center">
        {children}
    </div>
);

export const OverviewIcon = () => (
    <IconBase>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><filter id="puffyShadowOverview" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="1"/><feOffset dx="0" dy="1" result="offsetblur"/><feFlood floodColor="#000000" floodOpacity="0.4"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <g filter="url(#puffyShadowOverview)">
                <rect x="4" y="4" width="11" height="11" rx="2.5" fill="#a855f7"/>
                <rect x="4" y="17" width="11" height="11" rx="2.5" fill="#f43f5e"/>
                <rect x="17" y="4" width="11" height="11" rx="2.5" fill="#f43f5e"/>
                <rect x="17" y="17" width="11" height="11" rx="2.5" fill="#a855f7"/>
            </g>
        </svg>
    </IconBase>
);
export const PlayersIcon = () => (
    <IconBase>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="playerGradPlayers" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#6366f1"/></linearGradient><filter id="puffyShadowPlayers"><feGaussianBlur in="SourceAlpha" stdDeviation="1"/><feOffset dx="0" dy="1" result="offsetblur"/><feFlood floodColor="#000000" floodOpacity="0.4"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <g filter="url(#puffyShadowPlayers)">
                <rect x="4" y="4" width="24" height="24" rx="12" fill="url(#playerGradPlayers)"/>
                <circle cx="16" cy="13" r="4" fill="white"/>
                <path d="M10 21 C10 18, 22 18, 22 21 Z" fill="white"/>
            </g>
        </svg>
    </IconBase>
);
export const CluesIcon = () => (
    <IconBase>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="clueGradClues" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d946ef"/><stop offset="100%" stopColor="#f97316"/></linearGradient><filter id="puffyShadowClues"><feGaussianBlur in="SourceAlpha" stdDeviation="1"/><feOffset dx="0" dy="1" result="offsetblur"/><feFlood floodColor="#000000" floodOpacity="0.4"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <g filter="url(#puffyShadowClues)">
                <path d="M22 4H8C6.9 4 6 4.9 6 6V26C6 27.1 6.9 28 8 28H24C25.1 28 26 27.1 26 26V10L22 4Z" fill="url(#clueGradClues)"/>
                <path d="M22 4V10H26" fill="#f97316" opacity="0.7"/>
            </g>
        </svg>
    </IconBase>
);
export const PublicIcon = () => (
    <IconBase>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="publicGradPublic" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#22d3ee"/></linearGradient><filter id="puffyShadowPublic"><feGaussianBlur in="SourceAlpha" stdDeviation="1"/><feOffset dx="0" dy="1" result="offsetblur"/><feFlood floodColor="#000000" floodOpacity="0.4"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <g filter="url(#puffyShadowPublic)">
                <path d="M26 4H6C4.9 4 4 4.9 4 6V28L8 24H26C27.1 24 28 23.1 28 22V6C28 4.9 27.1 4 26 4Z" fill="url(#publicGradPublic)"/>
            </g>
        </svg>
    </IconBase>
);
export const PrivateIcon = () => (
    <IconBase>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="privateGradPrivate" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d946ef"/><stop offset="100%" stopColor="#f43f5e"/></linearGradient><filter id="puffyShadowPrivate"><feGaussianBlur in="SourceAlpha" stdDeviation="1"/><feOffset dx="0" dy="1" result="offsetblur"/><feFlood floodColor="#000000" floodOpacity="0.4"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <g filter="url(#puffyShadowPrivate)">
                <rect x="5" y="11" width="22" height="16" rx="4" fill="url(#privateGradPrivate)"/>
                <path d="M10 11V8C10 4.69 12.69 2 16 2S22 4.69 22 8V11H20V8C20 5.79 18.21 4 16 4S12 5.79 12 8V11H10Z" fill="url(#privateGradPrivate)"/>
            </g>
        </svg>
    </IconBase>
);
export const NotesIcon = () => (
    <IconBase>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="notesGradNotes" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f97316"/><stop offset="100%" stopColor="#eab308"/></linearGradient><filter id="puffyShadowNotes"><feGaussianBlur in="SourceAlpha" stdDeviation="1"/><feOffset dx="0" dy="1" result="offsetblur"/><feFlood floodColor="#000000" floodOpacity="0.4"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <g filter="url(#puffyShadowNotes)">
                <rect x="4" y="4" width="24" height="24" rx="4" fill="url(#notesGradNotes)"/>
                <path d="M10 12H22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M10 18H18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </g>
        </svg>
    </IconBase>
);
export const CharactersIcon = () => (
    <IconBase>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="charGradCharacters" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1"/><stop offset="100%" stopColor="#a855f7"/></linearGradient><filter id="puffyShadowCharacters"><feGaussianBlur in="SourceAlpha" stdDeviation="1"/><feOffset dx="0" dy="1" result="offsetblur"/><feFlood floodColor="#000000" floodOpacity="0.4"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <g filter="url(#puffyShadowCharacters)">
                <rect x="4" y="4" width="24" height="24" rx="12" fill="url(#charGradCharacters)"/>
                <circle cx="16" cy="13" r="4" fill="white"/>
                <path d="M10 21 C10 18, 22 18, 22 21 Z" fill="white"/>
            </g>
        </svg>
    </IconBase>
);
