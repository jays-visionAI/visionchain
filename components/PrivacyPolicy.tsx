import { Motion } from 'solid-motionone';
import { Shield } from 'lucide-solid';
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

const PrivacyPolicy = (): JSX.Element => {
    return (
        <section class="bg-black min-h-screen pt-32 pb-24 px-6">
            <div class="max-w-[800px] mx-auto">
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div class="flex items-center gap-3 mb-6">
                        <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            <Shield class="w-6 h-6" />
                        </div>
                        <h1 class="text-4xl md:text-5xl font-semibold text-white tracking-tight">Privacy Policy</h1>
                    </div>

                    <p class="text-gray-400 text-lg mb-12 pb-8 border-b border-white/10">
                        Last Updated: October 24, 2025
                    </p>

                    <Section title="1. Introduction">
                        <p>
                            Vision Chain ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, decentralized applications (dApps), and use our protocol.
                        </p>
                        <p>
                            By accessing or using Vision Chain, you agree to the terms of this Privacy Policy. If you do not agree with the terms of this Privacy Policy, please do not access the site.
                        </p>
                    </Section>

                    <Section title="2. Information We Collect">
                        <p>
                            <strong>Blockchain Data:</strong> Due to the inherent nature of blockchain technology, transactions and wallet addresses are public and permanent. We do not control this data and it is not considered personal information under this policy once committed to the chain.
                        </p>
                        <p>
                            <strong>Voluntary Information:</strong> We may collect personal information that you voluntarily provide to us when you register on the website, subscribe to our newsletter, or contact support. This may include your email address.
                        </p>
                        <p>
                            <strong>Usage Data:</strong> We may automatically collect certain information when you visit, use, or navigate the Site. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Site, and other technical information.
                        </p>
                    </Section>

                    <Section title="3. How We Use Your Information">
                        <p>
                            We use the information we collect or receive:
                        </p>
                        <ul class="list-disc pl-5 space-y-2">
                            <li>To facilitate account creation and logon process.</li>
                            <li>To send you administrative information, such as product, service and new feature information and/or information about changes to our terms, conditions, and policies.</li>
                            <li>To protect our Services and for legal compliance.</li>
                            <li>To enforce our terms, conditions, and policies for business purposes, to comply with legal and regulatory requirements or in connection with our contract.</li>
                            <li>To respond to legal requests and prevent harm.</li>
                        </ul>
                    </Section>

                    <Section title="4. Sharing Your Information">
                        <p>
                            We may process or share your data that we hold based on the following legal basis:
                        </p>
                        <ul class="list-disc pl-5 space-y-2">
                            <li><strong>Consent:</strong> We may process your data if you have given us specific consent to use your personal information for a specific purpose.</li>
                            <li><strong>Legitimate Interests:</strong> We may process your data when it is reasonably necessary to achieve our legitimate business interests.</li>
                            <li><strong>Performance of a Contract:</strong> Where we have entered into a contract with you, we may process your personal information to fulfill the terms of our contract.</li>
                            <li><strong>Legal Obligations:</strong> We may disclose your information where we are legally required to do so in order to comply with applicable law, governmental requests, a judicial proceeding, court order, or legal process.</li>
                        </ul>
                    </Section>

                    <Section title="5. Security of Your Information">
                        <p>
                            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                        </p>
                    </Section>

                    <Section title="6. Contact Us">
                        <p>
                            If you have questions or comments about this policy, you may email us at privacy@visionchain.io or by post to:
                        </p>
                        <div class="mt-4 p-4 bg-white/5 rounded-lg border border-white/5 inline-block">
                            <p class="text-white font-medium">Vision Chain Foundation</p>
                            <p class="text-gray-400">123 Blockchain Blvd, Suite 100</p>
                            <p class="text-gray-400">Crypto Valley, Zug</p>
                        </div>
                    </Section>

                </Motion.div>
            </div>
        </section>
    );
};

export default PrivacyPolicy;