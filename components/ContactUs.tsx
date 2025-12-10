import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageSquare, MapPin, Send, CheckCircle, ArrowRight, Building2, Users } from 'lucide-react';

const ContactUs: React.FC = () => {
  const [formState, setFormState] = useState({ name: '', email: '', subject: 'General Inquiry', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Construct email content for mailto link
    const { name, email, subject, message } = formState;
    const emailBody = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;
    const mailtoUrl = `mailto:jp@visai.io?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    // Trigger email client
    window.location.href = mailtoUrl;

    // Reset form UI after a brief delay to simulate processing
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setFormState({ name: '', email: '', subject: 'General Inquiry', message: '' });
    }, 1000);
  };

  return (
    <section className="bg-black min-h-screen pt-32 pb-24 px-6 relative overflow-hidden font-sans">
      {/* Background FX */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)] pointer-events-none" />

      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
            <Mail className="w-3 h-3" />
            <span>Get in touch</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold text-white tracking-tight mb-6">
            Contact Vision Chain.
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
             Whether you're a developer building the next unicorn, a validator ensuring network integrity, or a partner seeking collaboration.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Contact Info Column */}
            <div className="lg:col-span-5 space-y-8">
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-8 rounded-3xl bg-[#111] border border-white/5 space-y-8"
                >
                    <h3 className="text-2xl font-semibold text-white">Direct Channels</h3>
                    
                    <div className="space-y-6">
                        <div className="flex gap-4 items-start group">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-white font-medium mb-1">Partnerships</h4>
                                <p className="text-sm text-gray-500 mb-1">For ecosystem grants and integrations.</p>
                                <a href="mailto:jp@visai.io" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">jp@visai.io</a>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start group">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-white font-medium mb-1">Press & Media</h4>
                                <p className="text-sm text-gray-500 mb-1">For media kits and interview requests.</p>
                                <a href="mailto:jp@visai.io" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">jp@visai.io</a>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start group">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-white font-medium mb-1">Technical Support</h4>
                                <p className="text-sm text-gray-500 mb-1">Issues with nodes or smart contracts?</p>
                                <a href="mailto:jays@visai.io" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">jays@visai.io</a>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div 
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: 0.3 }}
                     className="p-8 rounded-3xl bg-[#0c0c0c] border border-white/5 relative overflow-hidden"
                >
                     <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full pointer-events-none" />
                     <div className="flex items-center gap-3 mb-4 text-white">
                         <MapPin className="w-5 h-5 text-gray-400" />
                         <span className="font-semibold">Headquarters</span>
                     </div>
                     <address className="text-gray-400 text-sm not-italic leading-relaxed">
                         Vision Chain Foundation<br/>
                         HONG LIM COMPLEX<br/>
                         531A UPPER CROSS STREET #04-098<br/>
                         Singapore 051531
                     </address>
                </motion.div>
            </div>

            {/* Form Column */}
            <div className="lg:col-span-7">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-8 md:p-10 rounded-[32px] bg-[#1d1d1f] border border-white/10 shadow-2xl relative"
                >
                    {isSubmitted ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1d1d1f] rounded-[32px] z-10 text-center p-8">
                             <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }} 
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6"
                             >
                                <CheckCircle className="w-8 h-8" />
                             </motion.div>
                             <h3 className="text-2xl font-bold text-white mb-2">Email Client Opened!</h3>
                             <p className="text-gray-400 max-w-sm">We've prepared a draft in your email client addressed to jp@visai.io. Please hit send to complete your inquiry.</p>
                             <button 
                                onClick={() => setIsSubmitted(false)}
                                className="mt-8 px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full text-sm font-medium transition-colors"
                             >
                                Send another message
                             </button>
                        </div>
                    ) : null}

                    <h2 className="text-2xl font-bold text-white mb-6">Send us a message</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 ml-1">Your Name</label>
                                <input 
                                    required
                                    type="text" 
                                    value={formState.name}
                                    onChange={e => setFormState({...formState, name: e.target.value})}
                                    className="w-full bg-[#000] border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-700"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 ml-1">Email Address</label>
                                <input 
                                    required
                                    type="email" 
                                    value={formState.email}
                                    onChange={e => setFormState({...formState, email: e.target.value})}
                                    className="w-full bg-[#000] border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-700"
                                    placeholder="john@company.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 ml-1">Subject</label>
                            <select 
                                value={formState.subject}
                                onChange={e => setFormState({...formState, subject: e.target.value})}
                                className="w-full bg-[#000] border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                            >
                                <option>General Inquiry</option>
                                <option>Partnership Proposal</option>
                                <option>Technical Support</option>
                                <option>Media/Press</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 ml-1">Message</label>
                            <textarea 
                                required
                                value={formState.message}
                                onChange={e => setFormState({...formState, message: e.target.value})}
                                className="w-full bg-[#000] border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-700 min-h-[160px] resize-none"
                                placeholder="Tell us about your project or inquiry..."
                            />
                        </div>

                        <div className="pt-2">
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-4 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <span className="animate-pulse">Preparing...</span>
                                ) : (
                                    <>
                                        Send Message <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </div>

      </div>
    </section>
  );
};

export default ContactUs;