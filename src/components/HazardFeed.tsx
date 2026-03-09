import React, { useState } from 'react';
import { AlertTriangle, Clock, MapPin, ArrowLeft, Users, ShieldAlert, Navigation } from 'lucide-react';
import { cn } from '../lib/utils';

interface HazardData {
  id: string;
  hazard_level: number;
  hazard_type: string;
  auto_notify: string;
  timestamp: Date;
  manual?: boolean;
}

interface HazardFeedProps {
  hazards: HazardData[];
}

export function HazardFeed({ hazards }: HazardFeedProps) {
  const [selectedHazard, setSelectedHazard] = useState<HazardData | null>(null);

  if (selectedHazard) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => setSelectedHazard(null)}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-medium text-white">Hazard Details</h2>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-white/10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-3 rounded-xl",
                  selectedHazard.hazard_level > 3 ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                )}>
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white capitalize">{selectedHazard.hazard_type}</h3>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Clock className="w-3.5 h-3.5" />
                    {selectedHazard.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border",
                selectedHazard.hazard_level > 3 ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              )}>
                Level {selectedHazard.hazard_level}
              </div>
            </div>

            <p className="text-zinc-300 leading-relaxed mb-6">
              {selectedHazard.auto_notify}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Reports</span>
                </div>
                <div className="text-2xl font-light text-white">
                  {Math.floor(Math.random() * 15) + 2}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <Navigation className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Distance</span>
                </div>
                <div className="text-2xl font-light text-white">
                  {(Math.random() * 2 + 0.1).toFixed(1)} <span className="text-sm text-zinc-500">mi</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/10 h-48 bg-zinc-800 relative">
              {/* Mock map view */}
              <div className="absolute inset-0 opacity-50" style={{
                backgroundImage: 'url("https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1000")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'grayscale(100%) contrast(120%) brightness(40%)'
              }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
                  <div className="w-4 h-4 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-medium text-white">Community Hazards</h2>
        </div>
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Live Feed</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {hazards.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-3 py-12">
            <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-500/50" />
            </div>
            <p className="text-sm">No hazards reported nearby.</p>
          </div>
        ) : (
          hazards.map((hazard) => (
            <div 
              key={hazard.id} 
              className="p-4 rounded-xl bg-zinc-950 border border-white/5 hover:border-white/10 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    hazard.hazard_level > 3 ? "bg-red-500" : "bg-amber-500"
                  )} />
                  <span className="text-sm font-medium text-white capitalize">
                    {hazard.hazard_type}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="w-3 h-3" />
                  {hazard.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {hazard.auto_notify}
              </p>
              <div 
                className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 group-hover:text-indigo-400 transition-colors cursor-pointer w-fit"
                onClick={() => setSelectedHazard(hazard)}
              >
                <MapPin className="w-3 h-3" />
                View on map
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ShieldCheck(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
