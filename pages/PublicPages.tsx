import { lazy } from 'solid-js';

// Lazy-loaded components
export const Technology = lazy(() => import('../components/Technology'));
export const Research = lazy(() => import('../components/Research'));
export const Community = lazy(() => import('../components/Community'));
export const Academy = lazy(() => import('../components/Academy'));
export const DeveloperCommunity = lazy(() => import('../components/DeveloperCommunity'));
export const ContactUs = lazy(() => import('../components/ContactUs'));
export const PrivacyPolicy = lazy(() => import('../components/PrivacyPolicy'));
export const TermsOfService = lazy(() => import('../components/TermsOfService'));
export const CookiePolicy = lazy(() => import('../components/CookiePolicy'));
export const Wallet = lazy(() => import('../components/Wallet'));
export const VisionScan = lazy(() => import('../components/VisionScan'));
export const TrafficSimulator = lazy(() => import('../components/TrafficSimulator'));
export const Testnet = lazy(() => import('../components/Testnet'));
export const Bridge = lazy(() => import('../components/Bridge'));
export const Paymaster = lazy(() => import('../components/Paymaster'));

// Page Wrapper Components
export const ResearchPage = () => {
    document.title = 'Research | Vision Chain';
    return <div id="research"><Research /></div>;
};

export const TechnologyPage = () => {
    document.title = 'Technology | Vision Chain';
    return <div id="technology"><Technology /></div>;
};

export const CommunityPage = () => {
    document.title = 'Community | Vision Chain';
    return <div id="community"><Community /></div>;
};

export const AcademyPage = () => {
    document.title = 'Academy | Vision Chain';
    return <div id="academy"><Academy /></div>;
};

export const DeveloperCommunityPage = () => {
    document.title = 'Developer Hub | Vision Chain';
    return <div id="developer-community"><DeveloperCommunity /></div>;
};

export const ContactPage = () => {
    document.title = 'Contact Us | Vision Chain';
    return <div id="contact"><ContactUs /></div>;
};

export const PrivacyPage = () => {
    document.title = 'Privacy Policy | Vision Chain';
    return <div id="privacy"><PrivacyPolicy /></div>;
};

export const TermsPage = () => {
    document.title = 'Terms of Service | Vision Chain';
    return <div id="terms"><TermsOfService /></div>;
};

export const CookiesPage = () => {
    document.title = 'Cookie Policy | Vision Chain';
    return <div id="cookies"><CookiePolicy /></div>;
};

export const WalletPage = () => {
    document.title = 'Wallet | Vision Chain';
    return <div id="wallet"><Wallet /></div>;
};

export const TrafficSimulatorPage = () => {
    document.title = 'Simulation Hub | Vision Chain';
    return <div id="traffic-sim"><TrafficSimulator /></div>;
};

export const VisionScanPage = () => {
    document.title = 'Vision Scan | Accounting-Grade Explorer';
    return <div id="vision-scan"><VisionScan /></div>;
};

export const TestnetPage = () => {
    document.title = 'Testnet Hub | Vision Chain';
    return <div id="testnet"><Testnet /></div>;
};

export const BridgePage = () => {
    document.title = 'Vision Bridge | Cross-chain Asset Migration';
    return <div id="bridge"><Bridge /></div>;
};

export const PaymasterPage = () => {
    document.title = 'Vision Paymaster | Gasless Transaction Hub';
    return <div id="paymaster"><Paymaster /></div>;
};
