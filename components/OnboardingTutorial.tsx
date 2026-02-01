import React, { useState, useEffect } from 'react';
import { ArrowRight, Calendar, Users, Sparkles, Check, X, Mail } from 'lucide-react';
import { generateWelcomeEmailContent } from '../services/geminiService';

interface OnboardingTutorialProps {
  ownerName: string;
  businessName: string;
  onComplete: () => void;
}

const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ ownerName, businessName, onComplete }) => {
  const [step, setStep] = useState(0);
  const [showEmailNotification, setShowEmailNotification] = useState(false);
  const [emailContent, setEmailContent] = useState('');

  const slides = [
    {
      title: `Welcome, ${ownerName}`,
      subtitle: `Let's get ${businessName} set up for success.`,
      description: "Halo is more than just a calendar. It's an intelligent OS designed to handle your scheduling, clients, and finances automatically.",
      icon: <Sparkles className="w-12 h-12 text-orange-600" />
    },
    {
      title: "Smart Scheduling",
      subtitle: "Never double-book again.",
      description: "Your calendar is aware of your preferences. It handles recurrence, conflicts, and even time zones effortlessly.",
      icon: <Calendar className="w-12 h-12 text-blue-500" />
    },
    {
      title: "Client Intelligence",
      subtitle: "Know your customers better.",
      description: "Halo uses AI to summarize client history and suggest talking points before every appointment.",
      icon: <Users className="w-12 h-12 text-emerald-500" />
    }
  ];

  // Simulate receiving the welcome email after the first slide
  useEffect(() => {
    if (step === 1 && !showEmailNotification) {
        // Trigger email generation
        generateWelcomeEmailContent(ownerName, businessName).then(content => {
            setEmailContent(content);
            setShowEmailNotification(true);
            
            // Auto hide after 6 seconds
            setTimeout(() => {
                setShowEmailNotification(false);
            }, 6000);
        });
    }
  }, [step, ownerName, businessName, showEmailNotification]);

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-80"></div>
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-orange-600/5 blur-[150px] rounded-full pointer-events-none animate-pulse"></div>

        {/* Email Notification Toast */}
        {showEmailNotification && (
            <div className="absolute top-8 right-8 z-[70] bg-zinc-900 border border-zinc-800 p-4 shadow-2xl max-w-sm animate-in slide-in-from-top-5 duration-500">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-orange-600 flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">New Email Received</h4>
                        <p className="text-zinc-400 text-xs mb-2">From: Halo Support</p>
                        <div className="bg-black p-3 border border-zinc-800 text-zinc-500 text-xs italic line-clamp-3">
                            "{emailContent}"
                        </div>
                    </div>
                    <button onClick={() => setShowEmailNotification(false)} className="text-zinc-500 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}

        <div className="relative z-10 max-w-4xl w-full p-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            
            {/* Left Side: Visuals */}
            <div className="hidden md:flex justify-center">
                 <div className="w-full aspect-square relative">
                      <div className="absolute inset-0 bg-gradient-to-tr from-orange-600 to-purple-600 rounded-full blur-[100px] opacity-20"></div>
                      <div className="relative z-10 bg-zinc-900 border border-zinc-800 aspect-square flex items-center justify-center p-12 shadow-2xl transform transition-all duration-500 rotate-3 hover:rotate-0">
                           {slides[step].icon}
                      </div>
                      {/* Decorative elements based on step */}
                      {step === 0 && (
                          <div className="absolute -bottom-4 -right-4 bg-white text-black px-4 py-2 font-bold uppercase text-xs tracking-widest shadow-lg">
                              Setup Complete
                          </div>
                      )}
                 </div>
            </div>

            {/* Right Side: Content */}
            <div className="space-y-8">
                <div className="flex gap-2 mb-4">
                    {slides.map((_, i) => (
                        <div key={i} className={`h-1 flex-1 transition-all duration-500 ${i <= step ? 'bg-orange-600' : 'bg-zinc-800'}`}></div>
                    ))}
                </div>

                <div className="animate-fade-in key={step}"> {/* Key ensures re-animation */}
                    <h2 className="text-4xl font-bold text-white mb-2">{slides[step].title}</h2>
                    <h3 className="text-xl text-zinc-400 mb-6">{slides[step].subtitle}</h3>
                    <p className="text-zinc-500 leading-relaxed text-lg">{slides[step].description}</p>
                </div>

                <div className="pt-8 flex items-center gap-4">
                    <button 
                        onClick={handleNext}
                        className="bg-white text-black px-8 py-4 font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center gap-2 group"
                    >
                        {step === slides.length - 1 ? "Get Started" : "Next Step"}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                    {step < slides.length - 1 && (
                        <button 
                            onClick={onComplete}
                            className="px-6 py-4 text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-colors text-xs"
                        >
                            Skip Tutorial
                        </button>
                    )}
                </div>
            </div>

        </div>
    </div>
  );
};

export default OnboardingTutorial;