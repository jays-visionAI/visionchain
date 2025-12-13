import { Motion } from 'solid-motionone';
import { FileText } from 'lucide-solid';
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

const TermsOfService = (): JSX.Element => {
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
              <FileText class="w-6 h-6" />
            </div>
            <h1 class="text-4xl md:text-5xl font-semibold text-white tracking-tight">Terms of Service</h1>
          </div>

          <p class="text-gray-400 text-lg mb-12 pb-8 border-b border-white/10">
            Last Updated: October 24, 2025
          </p>

          <Section title="1. Agreement to Terms">
            <p>
              By accessing or using the Vision Chain protocol, website, and related services (collectively, the "Services"), you agree to be bound by these Terms of Service. If you do not agree to these Terms, do not use our Services.
            </p>
          </Section>

          <Section title="2. Description of Services">
            <p>
              Vision Chain is a decentralized Layer 1 blockchain protocol designed for autonomous AI agents. The Services include the blockchain network, developer tools, and informational websites. We do not control the blockchain, which is run by independent validators.
            </p>
          </Section>

          <Section title="3. User Responsibilities">
            <p>
              You are responsible for safeguarding your private keys and digital assets. Vision Chain Foundation has no control over user wallets and cannot recover lost funds. You agree not to use the Services for any illegal activities.
            </p>
          </Section>

          <Section title="4. Risks">
            <p>
              Using blockchain technology involves significant risks, including regulatory uncertainty, technical failures, and market volatility. By using the Services, you acknowledge and accept these risks.
            </p>
          </Section>

          <Section title="5. Intellectual Property">
            <p>
              The Vision Chain protocol code is open-source. However, branding, logos, and website content are owned by the Foundation unless otherwise stated.
            </p>
          </Section>

          <Section title="6. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Vision Chain Foundation shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues.
            </p>
          </Section>

          <Section title="7. Contact Us">
            <p>
              If you have questions about these Terms, please contact us at jays@visai.io.
            </p>
          </Section>

        </Motion.div>
      </div>
    </section>
  );
};

export default TermsOfService;