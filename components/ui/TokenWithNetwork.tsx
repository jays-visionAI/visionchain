import { Component, JSX } from 'solid-js';

// Network badge types
type NetworkType = 'vision' | 'ethereum' | 'sepolia' | 'polygon';

interface TokenWithNetworkProps {
    /** Token symbol (e.g., 'VCN', 'ETH') */
    symbol: string;
    /** Network the token is on */
    network: NetworkType;
    /** Size of the token icon (default: 32) */
    size?: number;
    /** Custom class name */
    class?: string;
}

// VCN Logo SVG (main token)
const VCNLogo = (props: { size: number }) => (
    <svg width={props.size} height={props.size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="url(#vcn-gradient)" />
        <path d="M10 12L16 20L22 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M16 20V24" stroke="white" stroke-width="2.5" stroke-linecap="round" />
        <defs>
            <linearGradient id="vcn-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stop-color="#8B5CF6" />
                <stop offset="1" stop-color="#6366F1" />
            </linearGradient>
        </defs>
    </svg>
);

// Network Badge SVGs
const NetworkBadge: Record<NetworkType, (size: number) => JSX.Element> = {
    vision: (size: number) => (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="7" fill="#8B5CF6" stroke="white" stroke-width="2" />
            <path d="M5 7L8 10L11 7" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    ),
    ethereum: (size: number) => (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="7" fill="#627EEA" stroke="white" stroke-width="2" />
            <path d="M8 3L5 8L8 10L11 8L8 3Z" fill="white" fill-opacity="0.6" />
            <path d="M8 10L5 8L8 13L11 8L8 10Z" fill="white" />
        </svg>
    ),
    sepolia: (size: number) => (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="7" fill="#CFB5F0" stroke="white" stroke-width="2" />
            <path d="M8 3L5 8L8 10L11 8L8 3Z" fill="white" fill-opacity="0.6" />
            <path d="M8 10L5 8L8 13L11 8L8 10Z" fill="white" />
            <text x="8" y="11" font-size="5" fill="#627EEA" text-anchor="middle" font-weight="bold">T</text>
        </svg>
    ),
    polygon: (size: number) => (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="7" fill="#8247E5" stroke="white" stroke-width="2" />
            <path d="M10.5 6.5L8 5L5.5 6.5V9.5L8 11L10.5 9.5V6.5Z" stroke="white" stroke-width="1.2" fill="none" />
        </svg>
    ),
};

// Network display names
const NetworkNames: Record<NetworkType, string> = {
    vision: 'Vision Chain',
    ethereum: 'Ethereum',
    sepolia: 'Sepolia (Testnet)',
    polygon: 'Polygon',
};

/**
 * Token icon with network badge
 * Shows the token logo with a small network indicator in the bottom-right corner
 */
export const TokenWithNetwork: Component<TokenWithNetworkProps> = (props) => {
    const size = props.size || 32;
    const badgeSize = Math.max(12, size * 0.45);

    return (
        <div
            class={`relative inline-flex items-center justify-center ${props.class || ''}`}
            style={{ width: `${size}px`, height: `${size}px` }}
            title={`${props.symbol} on ${NetworkNames[props.network]}`}
        >
            {/* Main Token Logo */}
            <VCNLogo size={size} />

            {/* Network Badge */}
            <div
                class="absolute"
                style={{
                    bottom: '-2px',
                    right: '-2px',
                    width: `${badgeSize}px`,
                    height: `${badgeSize}px`,
                }}
            >
                {NetworkBadge[props.network](badgeSize)}
            </div>
        </div>
    );
};

/**
 * Token display with network label
 * Shows token icon, symbol, and network name
 */
export const TokenDisplay: Component<TokenWithNetworkProps & { showNetwork?: boolean }> = (props) => {
    return (
        <div class="flex items-center gap-2">
            <TokenWithNetwork
                symbol={props.symbol}
                network={props.network}
                size={props.size}
            />
            <div class="flex flex-col">
                <span class="font-semibold text-white">{props.symbol}</span>
                {props.showNetwork !== false && (
                    <span class="text-xs text-white/50">{NetworkNames[props.network]}</span>
                )}
            </div>
        </div>
    );
};

export default TokenWithNetwork;
