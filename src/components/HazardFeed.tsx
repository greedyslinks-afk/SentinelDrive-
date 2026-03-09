import React from 'react';
import { AlertTriangle, Clock, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';

interface HazardData {
  id: string;
  hazard_level: number;
  hazard_type: string;
  auto_notify: string;
  timestamp: Date;
}

interface HazardFeedProps {
  hazards: HazardData[];
}

export function HazardFeed({ hazards }: HazardFeedProps) {
  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-sm flex flex-col h-full">
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
              <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 group-hover:text-indigo-400 transition-colors cursor-pointer">
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
