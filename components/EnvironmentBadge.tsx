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

    const isStaging = ENV === 'staging';

    return (
        <div style={{
            position: 'fixed',
            top: '12px',
            right: '12px',
            'z-index': '99999',
            padding: '4px 12px',
            'border-radius': '9999px',
            'font-size': '11px',
            'font-weight': '900',
            'text-transform': 'uppercase',
            'letter-spacing': '0.1em',
            'box-shadow': '0 4px 12px rgba(0,0,0,0.3)',
            background: isStaging ? '#f59e0b' : '#6366f1',
            color: isStaging ? '#000' : '#fff',
            'pointer-events': 'none',
        }}>
            {CONFIG.name}
        </div>
    );
};

export default EnvironmentBadge;
