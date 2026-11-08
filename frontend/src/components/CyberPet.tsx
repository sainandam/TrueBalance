import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, Shield, ArrowDown, Bot, Heart } from 'lucide-react';

interface CyberPetProps {
  onTipClick?: (tipIndex: number) => void;
}

const TIPS = [
  '👋 Hi Judge! Click any card below for 1-Click Instant Demo Login — no typing required!',
  '⚡ Tip: Try the Concurrency Lab to fire 10 simultaneous overdraft withdrawals!',
  '🛡️ Fun Fact: All money is stored as 64-bit integer paise (0.00% float drift).',
  '🔐 Want to create your own custom user? Click "Register now" at the bottom!',
  '🔍 The Auditor Cockpit mathematically validates SHA-256 hash chains in real time.',
];

export const CyberPet: React.FC<CyberPetProps> = () => {
  const [tipIndex, setTipIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isHappy, setIsHappy] = useState(false);

  // Auto-cycle tips every 7 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const handleClick = () => {
    setIsHappy(true);
    setTipIndex((prev) => (prev + 1) % TIPS.length);
    setTimeout(() => setIsHappy(false), 900);
  };

  return (
    <div className="relative mb-3 flex items-end justify-center space-x-3 select-none">
      {/* Animated Speech Bubble */}
      <div
        onClick={handleClick}
        className="relative max-w-xs bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-cyan-950/90 border border-emerald-500/40 rounded-2xl p-3 shadow-lg shadow-emerald-500/10 cursor-pointer hover:border-emerald-400 transition-all duration-300 group"
      >
        {/* Glowing badge */}
        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-emerald-400 mb-1">
          <span className="flex items-center space-x-1">
            <Bot className="w-3 h-3 text-cyan-400" />
            <span className="tracking-wider uppercase">TRUEBOT &middot; DEMO GUIDE</span>
          </span>
          <span className="text-[9px] text-slate-400 group-hover:text-emerald-300 font-sans">
            (click me!)
          </span>
        </div>

        {/* Speech Text */}
        <p className="text-xs text-slate-200 font-medium leading-relaxed">
          {TIPS[tipIndex]}
        </p>

        {/* Speech Bubble Arrow pointing to the pet */}
        <div className="absolute -bottom-2 right-6 w-3 h-3 bg-slate-900 border-r border-b border-emerald-500/40 transform rotate-45" />
      </div>

      {/* Cyber Pet Robot Character */}
      <div
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative cursor-pointer group flex flex-col items-center"
        title="I am TrueBot! Click me for banking engine tips!"
      >
        {/* Floating motion wrapper */}
        <div
          className={`relative transition-transform duration-500 ${
            isHappy ? 'animate-bounce scale-110' : 'animate-float'
          }`}
        >
          {/* Energy Halo / Glow behind head */}
          <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 rounded-full blur-md opacity-70 group-hover:opacity-100 transition-opacity" />

          {/* Droid Body SVG */}
          <svg
            className="w-14 h-14 relative z-10 filter drop-shadow(0 4px 8px rgba(0,0,0,0.5))"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Left Antenna */}
            <line x1="22" y1="18" x2="16" y2="10" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="15" cy="9" r="3" fill="#38bdf8" className="animate-pulse" />

            {/* Right Antenna */}
            <line x1="42" y1="18" x2="48" y2="10" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="49" cy="9" r="3" fill="#10b981" className="animate-pulse" />

            {/* Main Robot Head */}
            <rect
              x="14"
              y="16"
              width="36"
              height="30"
              rx="12"
              fill="url(#headGradient)"
              stroke="#334155"
              strokeWidth="2"
            />

            {/* Visor Screen */}
            <rect
              x="18"
              y="22"
              width="28"
              height="16"
              rx="7"
              fill="#050811"
              stroke="#0ea5e9"
              strokeWidth="1.2"
            />

            {/* Glowing Eyes */}
            {isHappy ? (
              // Happy Arc Eyes (^ ^)
              <>
                <path d="M23 31 Q26 27 29 31" stroke="#34d399" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M35 31 Q38 27 41 31" stroke="#34d399" strokeWidth="2" strokeLinecap="round" fill="none" />
              </>
            ) : isHovered ? (
              // Wink / Star Eyes
              <>
                <circle cx="26" cy="30" r="3" fill="#38bdf8" />
                <path d="M36 30 L40 30" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
              </>
            ) : (
              // Standard Cute Glowing Eyes with blink animation
              <>
                <circle cx="26" cy="30" r="2.8" fill="#38bdf8">
                  <animate attributeName="ry" values="2.8;0.3;2.8" dur="4s" repeatCount="indefinite" />
                </circle>
                <circle cx="38" cy="30" r="2.8" fill="#10b981">
                  <animate attributeName="ry" values="2.8;0.3;2.8" dur="4s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            {/* Cheerful Blush Dots */}
            <circle cx="21" cy="34" r="1.5" fill="#f43f5e" opacity="0.6" />
            <circle cx="43" cy="34" r="1.5" fill="#f43f5e" opacity="0.6" />

            {/* Little Neck Connector */}
            <rect x="28" y="46" width="8" height="4" rx="2" fill="#475569" />

            {/* Hover Thruster Glow */}
            <ellipse cx="32" cy="54" rx="10" ry="3" fill="url(#thrusterGlow)" />

            {/* Gradients */}
            <defs>
              <linearGradient id="headGradient" x1="14" y1="16" x2="50" y2="46" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1e293b" />
                <stop offset="1" stopColor="#0f172a" />
              </linearGradient>
              <radialGradient id="thrusterGlow" cx="0.5" cy="0.5" r="0.5">
                <stop stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        {/* Shadow underneath */}
        <div className="w-8 h-1.5 bg-cyan-500/20 rounded-full blur-xs mt-0.5 animate-pulse" />
      </div>
    </div>
  );
};
