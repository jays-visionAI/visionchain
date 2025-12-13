import { For } from 'solid-js';
import type { JSX } from 'solid-js';

const chains = [
  { name: "Avalanche", logo: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png?1696512369" },
  { name: "Optimism", logo: "https://assets.coingecko.com/coins/images/25244/large/Optimism.png?1696524385" },
  { name: "BNB Chain", logo: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?1696501970" },
  { name: "Ethereum", logo: "https://assets.coingecko.com/coins/images/279/large/ethereum.png?1696501628" },
  { name: "Bitcoin", logo: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400" },
  { name: "Solana", logo: "https://assets.coingecko.com/coins/images/4128/large/solana.png?1696504756" },
  { name: "Polygon", logo: "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png?1624768688" },
  { name: "Arbitrum", logo: "https://assets.coingecko.com/coins/images/16547/large/arb.jpg?1721381665" },
  { name: "Base", logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 111 111' fill='none'%3E%3Ccircle cx='55.5' cy='55.5' r='55.5' fill='%230052FF'/%3E%3Cpath d='M55.4 92.3c-20.6 0-37.3-16.7-37.3-37.3 0-20.6 16.7-37.3 37.3-37.3 18.1 0 33.3 12.9 36.6 30.1H67.6c-2.8-8.4-10.6-14.5-19.8-14.5-11.6 0-21 9.4-21 21s9.4 21 21 21c9.2 0 17-6.1 19.8-14.5H92c-3.3 17.2-18.5 30.1-36.6 30.1z' fill='white'/%3E%3C/svg%3E" },
];

interface LogoItemProps {
  chain: { name: string, logo: string };
}

const LogoItem = (props: LogoItemProps): JSX.Element => (
  <div
    class="flex items-center gap-3 select-none transition-all duration-300 cursor-default group/item transform translate-z-0"
  >
    <img
      src={props.chain.logo}
      alt={props.chain.name}
      class="w-10 h-10 object-contain filter brightness-110 contrast-110 group-hover/item:scale-110 transition-transform duration-300"
      loading="eager"
    />

    <span class="text-sm md:text-base font-medium text-gray-300 tracking-wide group-hover/item:text-white transition-colors shadow-black drop-shadow-md">
      {props.chain.name}
    </span>
  </div>
);

const LogoCarousel = (): JSX.Element => {
  return (
    <div class="w-full py-12 bg-transparent relative z-10 flex flex-col items-center justify-center overflow-hidden">
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

      <div class="mb-10 text-center">
        <span class="text-blue-500 font-semibold tracking-wide uppercase text-xs">
          Interoperable Ecosystem
        </span>
      </div>

      <div class="w-full relative overflow-hidden group [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
        <div class="flex" style={{ transform: 'translateZ(0)' }}>
          {/* Track 1 */}
          <div class="flex shrink-0 animate-marquee items-center gap-12 md:gap-24 px-6 md:px-12">
            <For each={chains}>
              {(chain, i) => <LogoItem chain={chain} />}
            </For>
          </div>

          {/* Track 2 (Duplicate for Seamless Loop) */}
          <div class="flex shrink-0 animate-marquee items-center gap-12 md:gap-24 px-6 md:px-12" aria-hidden="true">
            <For each={chains}>
              {(chain, i) => <LogoItem chain={chain} />}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoCarousel;