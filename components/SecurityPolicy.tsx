import { Motion } from 'solid-motionone';
import { ShieldAlert } from 'lucide-solid';
import type { JSX } from 'solid-js';

interface SectionProps {
    title: string;
    children: JSX.Element;
}

const Section = (props: SectionProps): JSX.Element => (
    <div class="mb-8 border-b border-white/5 pb-8 last:border-0">
        <h3 class="text-xl font-semibold text-white mb-4">{props.title}</h3>
        <div class="text-gray-400 text-sm leading-relaxed space-y-4">
            {props.children}
        </div>
    </div>
);

const SecurityPolicy = (): JSX.Element => {
    return (
        <section class="bg-black min-h-screen pt-32 pb-24 px-6">
            <div class="max-w-[800px] mx-auto">
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div class="flex items-center gap-3 mb-6">
                        <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <ShieldAlert class="w-6 h-6" />
                        </div>
                        <h1 class="text-4xl md:text-5xl font-semibold text-white tracking-tight">Security Policy</h1>
                    </div>

                    <p class="text-gray-400 text-lg mb-12 pb-8 border-b border-white/10">
                        Last Updated: June 6, 2026
                    </p>

                    <Section title="1. Reporting a Security Issue">
                        <p>
                            Vision Chain takes the security of our protocol, gateway, and end-user products seriously. If you believe you have found a security vulnerability in any Vision Chain property, please report it to us privately so we can investigate and remediate.
                        </p>
                        <div class="mt-4 p-4 bg-white/5 rounded-lg border border-white/5">
                            <p class="text-white font-medium mb-2">Primary contact</p>
                            <p>
                                Email: <a href="mailto:security@visai.io" class="text-emerald-400 hover:text-emerald-300 underline">security@visai.io</a>
                            </p>
                            <p class="mt-1">PGP key: published at <code class="text-emerald-400">/.well-known/security.txt</code> (key fingerprint forthcoming — placeholder)</p>
                        </div>
                        <p>
                            <strong class="text-white">Acknowledgement SLA:</strong> we aim to acknowledge every credible report within <strong class="text-white">48 hours</strong> of receipt and to provide a substantive triage update within 5 business days.
                        </p>
                        <p>
                            Please include: a clear description of the issue, reproduction steps (request/response, code, or screenshots), the affected endpoint or page, and an estimate of impact. Reports in English or Korean are both accepted.
                        </p>
                    </Section>

                    <Section title="2. Responsible Disclosure Policy">
                        <p>
                            We follow a coordinated disclosure model. Researchers who report in good faith, respect this policy, and give us a reasonable window to remediate will not be subject to legal action by Vision Chain.
                        </p>
                        <ul class="list-disc pl-5 space-y-2">
                            <li><strong>Disclosure window:</strong> we ask researchers to refrain from public disclosure for up to <strong class="text-white">90 days</strong> from the date of report, or until a fix is shipped and verified — whichever is sooner. We will not seek extensions in bad faith.</li>
                            <li><strong>Good-faith safe harbor:</strong> testing that is limited to your own accounts and avoids privacy violations, data destruction, service disruption, and harm to other users is considered authorized activity.</li>
                            <li><strong>No bug-bounty payouts</strong> are offered at this stage, but we will publicly credit researchers (with consent) in the Recognition section below once a fix is shipped.</li>
                            <li><strong>No legal action</strong> will be initiated against researchers who comply with this policy in good faith.</li>
                        </ul>
                    </Section>

                    <Section title="3. Scope">
                        <p>The following Vision Chain properties are in scope for security research:</p>
                        <ul class="list-disc pl-5 space-y-2">
                            <li><strong>Vision Chain web</strong> — <code class="text-emerald-400">https://visionchain.co</code> and its subpaths (excluding third-party embeds).</li>
                            <li><strong>Vision Chain gateway API</strong> — the public agent gateway endpoint and its handlers (<code class="text-emerald-400">/agentGateway</code> and related Cloud Functions).</li>
                            <li><strong>Vision Predict (Beta)</strong> — <code class="text-emerald-400">/predict</code> and its server-side handlers (<code class="text-emerald-400">polymarket.*</code> actions).</li>
                            <li><strong>Vision Agent Gateway</strong> — <code class="text-emerald-400">/agent</code>, the developer-facing API surface, and its documentation pages.</li>
                            <li><strong>Vision Chain RPC and explorer</strong> — the public RPC endpoints documented on the Mainnet page and the Vision Scan explorer.</li>
                        </ul>
                    </Section>

                    <Section title="4. Out of Scope">
                        <p>The following are explicitly out of scope and should not be tested:</p>
                        <ul class="list-disc pl-5 space-y-2">
                            <li><strong>Third-party services:</strong> Polymarket itself (Gamma API, on-chain markets), Firebase, Cloudflare, RPC providers, wallet extensions, or any other service we integrate with but do not operate.</li>
                            <li><strong>Denial-of-service:</strong> volumetric DDoS, application-level flooding, or any test that could degrade service for other users.</li>
                            <li><strong>Social engineering:</strong> phishing, vishing, or pretexting against Vision Chain staff, contractors, or community members.</li>
                            <li><strong>Physical access</strong> to Vision Chain facilities, offices, or hardware.</li>
                            <li><strong>Spam / content-quality issues</strong> on community channels (Telegram, Discord, X).</li>
                            <li><strong>Reports based solely on automated scanner output</strong> without a demonstrable impact (e.g. missing security headers on static pages, version-disclosure of public software).</li>
                            <li><strong>Issues in user-generated content</strong> that the user themselves submitted (e.g. cross-site scripting in your own private notes that only you can see).</li>
                        </ul>
                    </Section>

                    <Section title="5. Recognition">
                        <p>
                            Researchers who report a valid issue in accordance with this policy will, with their consent, be credited on the Hall of Fame below once the fix has shipped and the disclosure window has closed.
                        </p>
                        <div class="mt-4 p-4 bg-white/5 rounded-lg border border-white/5">
                            <p class="text-white font-medium mb-2">Hall of Fame</p>
                            <p class="text-gray-400 italic">No researchers credited yet — be the first.</p>
                        </div>
                    </Section>

                    <Section title="6. Machine-Readable Policy">
                        <p>
                            A machine-readable version of this policy is published at <a href="/.well-known/security.txt" class="text-emerald-400 hover:text-emerald-300 underline"><code>/.well-known/security.txt</code></a> per RFC 9116.
                        </p>
                    </Section>

                    <Section title="7. Contact">
                        <p>
                            For all security-related correspondence, please use <a href="mailto:security@visai.io" class="text-emerald-400 hover:text-emerald-300 underline">security@visai.io</a>. For non-security questions about Vision Chain, please use the <a href="/contact" class="text-emerald-400 hover:text-emerald-300 underline">general contact form</a>.
                        </p>
                        <div class="mt-4 p-4 bg-white/5 rounded-lg border border-white/5 inline-block">
                            <p class="text-white font-medium">Vision Chain Foundation</p>
                            <p class="text-gray-400">114 Lavender Street #07-72 CT Hub 2</p>
                            <p class="text-gray-400">(Lobby 1) Singapore 338729</p>
                        </div>
                    </Section>

                </Motion.div>
            </div>
        </section>
    );
};

export default SecurityPolicy;
