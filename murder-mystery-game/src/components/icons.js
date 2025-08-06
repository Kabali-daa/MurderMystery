import React from 'react';

// Base component to render an image tag with consistent sizing.
const IconBase = ({ src, alt, className = '' }) => (
    <img 
        src={src} 
        alt={alt}
        // Using w-6 and h-6 to match the previous 24x24px icon size.
        // object-contain ensures the image aspect ratio is maintained.
        className={`w-6 h-6 object-contain ${className}`}
    />
);

// Each component now points to the image URL you provided.

export const OverviewIcon = () => (
    <IconBase src="https://i.ibb.co/hFSFxqPK/overview.png" alt="Overview" />
);

export const PlayersIcon = () => (
    <IconBase src="https://i.ibb.co/rfGNkYQ4/player.png" alt="Players" />
);

export const CluesIcon = () => (
    <IconBase src="https://i.ibb.co/4Z4zRSvD/clues.png" alt="Clues" />
);

export const PublicIcon = () => (
    <IconBase src="https://i.ibb.co/MxfKZmrf/public.png" alt="Public" />
);

export const PrivateIcon = () => (
    <IconBase src="https://i.ibb.co/B2CMs4Y6/private.png" alt="Private" />
);

export const NotesIcon = () => (
    <IconBase src="https://i.ibb.co/Vc7ZSN6h/notes.png" alt="Notes" />
);

export const CharactersIcon = () => (
    <IconBase src="https://i.ibb.co/rfGNkYQ4/player.png" alt="Characters" />
);
