import React from 'react';
import { motion } from 'framer-motion';
import { Cookie } from 'lucide-react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8 border-b border-white/5 pb-8 last:border-0">
    <h3 className="text-xl font-semibold text-white mb-4">{title}</h3>
    <div className="text-gray-400 text-sm leading-relaxed space-y-4">
      {children}
    </div>
  </div>
);

const CookiePolicy: React.FC = () => {
  return (
    <section className="bg-black min-h-screen pt-32 pb-24 px-6">
      <div className="max-w-[800px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Cookie className="w-6 h-6" />
                </div>
                <h1 className="text-4xl md:text-5xl font-semibold text-white tracking-tight">Cookie Policy</h1>
            </div>
            
            <p className="text-gray-400 text-lg mb-12 pb-8 border-b border-white/10">
                Last Updated: October 24, 2025
            </p>

            <Section title="1. What Are Cookies">
                <p>
                    Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently and to provide information to the owners of the site.
                </p>
            </Section>

            <Section title="2. How We Use Cookies">
                <p>
                   We use cookies to:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>Understand how you use our website (analytics).</li>
                    <li>Remember your preferences (like language or theme).</li>
                    <li>Ensure the security of our services.</li>
                </ul>
            </Section>

            <Section title="3. Types of Cookies We Use">
                <p>
                    <strong>Essential Cookies:</strong> Necessary for the website to function. We cannot switch these off.
                </p>
                <p>
                    <strong>Analytics Cookies:</strong> Help us improve our website by collecting and reporting information on how you use it.
                </p>
            </Section>

            <Section title="4. Managing Cookies">
                <p>
                    You can set your browser not to accept cookies. However, some of our website features may not function as a result.
                </p>
            </Section>
            
        </motion.div>
      </div>
    </section>
  );
};

export default CookiePolicy;