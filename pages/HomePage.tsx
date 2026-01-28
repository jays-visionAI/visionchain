import { lazy, Suspense } from 'solid-js';
import Hero from '../components/Hero';

// Non-critical sections lazy-loaded
const Stats = lazy(() => import('../components/Stats'));
const Applications = lazy(() => import('../components/Applications'));
const Architecture = lazy(() => import('../components/Architecture'));

const HomePage = () => {
    document.title = 'Vision Chain | Network Neutral New Age AI L1';

    return (
        <>
            <Hero />
            <Suspense>
                <Stats />
            </Suspense>
            <Suspense>
                <div id="ecosystem">
                    <Applications />
                </div>
            </Suspense>
            <Suspense>
                <div id="governance">
                    <Architecture />
                </div>
            </Suspense>
        </>
    );
};

export default HomePage;
