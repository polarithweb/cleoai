import React, { useEffect, useState, useRef } from 'react';
import { Timer, Check, Menu, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getRateLimitState } from '../utils/rateLimiter';

interface HeaderProps {
  rateTrigger: number;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

const modelOptions = [
  {
    id: 'kaze',
    name: "Polarith Kaze 1.0",
    badge: "Kaze 1.0",
    description: "Conversational model for everyday chatting and writing.",
    color: "bg-slate-100 text-slate-700 border-slate-200"
  },
  {
    id: 'amabie',
    name: "Polarith Amabie 1.0",
    badge: "Amabie 1.0",
    description: "Powerhouse core for complex code structures, math, and real-time search.",
    color: "bg-purple-50 text-purple-700 border-purple-100"
  },
  {
    id: 'kodama',
    name: "Polarith Kodama",
    badge: "Kodama",
    description: "Raw performance, extreme power, extreme coding, and real-time search.",
    color: "bg-emerald-50 text-emerald-700 border-emerald-100"
  }
];

export default function Header({ rateTrigger, selectedModel, onModelChange }: HeaderProps) {
  const [rateState, setRateState] = useState(() => getRateLimitState(selectedModel));
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    setRateState(getRateLimitState(selectedModel));
  }, [rateTrigger, selectedModel]);

  useEffect(() => {
    if (!rateState.resetTime) {
      setTimeRemaining('');
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = rateState.resetTime! - now;
      
      if (diff <= 0) {
        setRateState(getRateLimitState(selectedModel));
        clearInterval(interval);
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        let displayStr = '';
        if (minutes > 0) {
          displayStr = `${minutes}m ${seconds}s`;
        } else {
          displayStr = `${seconds}s`;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours > 0) {
          displayStr = `${hours}h ${displayStr}`;
        }
        
        setTimeRemaining(displayStr);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [rateState.resetTime, selectedModel]);

  const currentOption = modelOptions.find(opt => opt.id === selectedModel) || modelOptions[3];

  return (
    <header className="w-full mb-3 relative" id="polarith-header">
      <div 
        className="w-full grid grid-cols-3 items-center bg-white py-1.5 px-4 rounded-xl nm-flat border border-white/50" 
        id="polarith-header-box"
      >
        
        {/* Left Column: Hamburger Menu Button */}
        <div className="flex items-center justify-start z-30" id="header-hamburger-col">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center justify-center p-1.5 rounded-lg bg-[#f5f7fb] hover:bg-[#ebf0f7] text-slate-700 hover:text-slate-900 border border-slate-200/60 shadow-sm hover:scale-[1.03] transition-all cursor-pointer active:scale-95"
            aria-label="Open model list"
            id="hamburger-menu-btn"
          >
            <Menu className="w-4.5 h-4.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Middle Column: Exactly Centered Branding Credits in a single row */}
        <div className="flex items-center justify-center gap-1.5 md:gap-2.5 text-center z-10 flex-wrap" id="header-branding-col">
          <h1 className="text-base md:text-lg font-display font-extrabold tracking-tight text-slate-800 leading-none">
            Polarith <span className="text-sky-500 lowercase">cleo</span>
          </h1>
          <span className="text-[10px] text-slate-300 font-mono hidden sm:inline">•</span>
          <p className="text-[10px] font-mono text-slate-500 font-semibold tracking-wide whitespace-nowrap leading-none">
            developed by <span className="text-slate-800 font-extrabold font-sans">Priyam Kesh</span>
          </p>
        </div>

        {/* Right Column: Mini Pill showing Active Model Badge & remaining rate */}
        <div className="flex items-center justify-end z-20" id="header-active-col">
          <div className="flex items-center gap-1.5 bg-[#f5f7fb] py-1 px-2.5 rounded-lg nm-inset-xs border border-white/40 max-w-full">
            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border font-sans whitespace-nowrap hidden sm:inline-block ${currentOption.color}`}>
              {currentOption.badge}
            </span>
            <div className="flex items-center">
              <span className="text-[10px] font-sans font-bold text-slate-600">
                {rateState.remaining}/{rateState.limit}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Slide-out Sidebar Drawer with Model Selector */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-[2px]"
              id="sidebar-overlay"
            />

            {/* Sidebar Container */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 w-[300px] max-w-[85vw] bg-white z-50 shadow-2xl flex flex-col border-r border-slate-100"
              id="sidebar-drawer"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-100/80 flex items-center justify-between bg-[#fcfdfe]">
                <div>
                  <h2 className="text-base font-display font-extrabold tracking-tight text-slate-800 leading-none">
                    Select Core
                  </h2>
                  <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider font-bold mt-1">
                    Polarith <span className="text-sky-500 lowercase">cleo</span> Engine
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg bg-[#f5f7fb] hover:bg-slate-200/50 text-slate-500 hover:text-slate-800 transition-all active:scale-95 border border-slate-200/40"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body: Models List */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
                {modelOptions.map((option) => {
                  const isSelected = option.id === selectedModel;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onModelChange(option.id);
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full text-left p-3.5 rounded-xl transition-all flex flex-col border relative ${
                        isSelected 
                          ? 'bg-blue-50/90 border-blue-200 text-blue-900 shadow-sm shadow-blue-500/5' 
                          : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/30 text-slate-800'
                      }`}
                    >
                      {/* Left highlights for active state */}
                      {isSelected && (
                        <div className="absolute left-0 top-3.5 bottom-3.5 w-1 bg-blue-600 rounded-r-md" />
                      )}

                      <div className="flex items-center justify-between w-full">
                        <span className={`text-xs font-extrabold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {option.name}
                        </span>
                      </div>

                      {/* 1 line model description */}
                      <p className={`text-[10px] font-medium leading-relaxed mt-1.5 ${isSelected ? 'text-blue-700/90' : 'text-slate-400'}`}>
                        {option.description}
                      </p>
                    </button>
                  );
                })}

              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-1 text-center">
                <span className="text-[10px] text-slate-500 font-semibold font-sans">
                  developed by <span className="text-slate-800 font-extrabold">Priyam Kesh</span>
                </span>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
