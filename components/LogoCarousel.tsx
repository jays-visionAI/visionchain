import React from 'react';

const chains = [
  { name: "Avalanche", logo: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png?1696512369" },
  { name: "Optimism", logo: "https://assets.coingecko.com/coins/images/25244/large/Optimism.png?1696524385" },
  { name: "BNB Chain", logo: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?1696501970" },
  { name: "Ethereum", logo: "https://assets.coingecko.com/coins/images/279/large/ethereum.png?1696501628" },
  { name: "Bitcoin", logo: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400" },
  { name: "Solana", logo: "https://assets.coingecko.com/coins/images/4128/large/solana.png?1696504756" },
  { name: "Polygon", logo: "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png?1624768688" },
  { name: "Arbitrum", logo: "https://assets.coingecko.com/coins/images/16547/large/arb.jpg?1721381665" },
];

const LogoCarousel: React.FC = () => {
  return (
    <div className="w-full py-12 bg-transparent relative z-10 flex flex-col items-center justify-center overflow-hidden">
       <style>{`
         @keyframes marquee {
           0% { transform: translate3d(0, 0, 0); }
           100% { transform: translate3d(-100%, 0, 0); }
         }
         .animate-marquee {
           animation: marquee 40s linear infinite;
           will-change: transform;
         }
       `}</style>

       <div className="mb-10 text-center">
          <span className="text-blue-500 font-semibold tracking-wide uppercase text-xs">
             Interoperable Ecosystem
          </span>
       </div>

       <div className="w-full relative overflow-hidden group [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
         <div className="flex" style={{ transform: 'translateZ(0)' }}>
             {/* Track 1 */}
             <div className="flex shrink-0 animate-marquee items-center gap-12 md:gap-24 px-6 md:px-12">
               {chains.map((chain, i) => (
                 <LogoItem key={`1-${i}`} chain={chain} />
               ))}
             </div>
             
             {/* Track 2 (Duplicate for Seamless Loop) */}
             <div className="flex shrink-0 animate-marquee items-center gap-12 md:gap-24 px-6 md:px-12" aria-hidden="true">
               {chains.map((chain, i) => (
                 <LogoItem key={`2-${i}`} chain={chain} />
               ))}
             </div>
         </div>
       </div>
    </div>
  );
};

const LogoItem: React.FC<{ chain: { name: string, logo: string } }> = ({ chain }) => (
    <div 
        className="flex items-center gap-3 select-none transition-all duration-300 cursor-default group/item transform translate-z-0"
    >
       <img 
          src={chain.logo} 
          alt={chain.name} 
          className="w-10 h-10 object-contain filter brightness-110 contrast-110 group-hover/item:scale-110 transition-transform duration-300"
          loading="eager"
        />
      
      <span className="text-sm md:text-base font-medium text-gray-300 tracking-wide group-hover/item:text-white transition-colors shadow-black drop-shadow-md">
          {chain.name}
      </span>
    </div>
);

export default LogoCarousel;