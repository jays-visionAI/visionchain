import { Show } from 'solid-js';
import { ENV, CONFIG } from '../services/envConfig';

/**
 * Environment Badge Component
 * 
 * Displays a floating badge indicating the current environment.
 * Only shown in non-production environments.
 */
export const EnvironmentBadge = () => {
    // Don't show in production
    if (ENV === 'production') return null;

    const badgeColor = ENV === 'staging'
        ? 'bg-amber-500 text-black'
        : 'bg-indigo-500 text-white';

    return (
        <div class={`fixed bottom-4 left-4 z-[9999] px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg ${badgeColor}`}>
            {CONFIG.name}
        </div>
    );
};

export default EnvironmentBadge;
