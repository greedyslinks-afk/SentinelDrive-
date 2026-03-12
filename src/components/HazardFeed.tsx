/// <reference types="vite/client" />
import React, { useState } from 'react';
import { AlertTriangle, Clock, MapPin, ArrowLeft, Users, ShieldAlert, Navigation, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';

interface HazardData {
  id: string;
  hazard_level: number;
  hazard_type: string;
  auto_notify: string;
  timestamp: Date;
  manual?: boolean;
  lat?: number;
  lng?: number;
}

interface HazardFeedProps {
  hazards: HazardData[];
}

export function HazardFeed({ hazards }: HazardFeedProps) {
  const [selectedHazard, setSelectedHazard] = useState<HazardData | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-medium text-white">Community Hazards</h2>
        </div>
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Live Feed</span>
      </div>

      {selectedHazard && (
        <div className="mb-4 shrink-0 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-2 rounded-lg",
                  selectedHazard.hazard_level > 3 ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                )}>
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white capitalize">{selectedHazard.hazard_type}</h3>
                  <div className="text-xs text-zinc-400">
                    {selectedHazard.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedHazard(null)}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-md transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-lg overflow-hidden border border-white/10 h-32 bg-zinc-800 relative">
              {selectedHazard.lat && selectedHazard.lng ? (
                <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
                  <Map
                    defaultCenter={{ lat: selectedHazard.lat, lng: selectedHazard.lng }}
                    defaultZoom={15}
                    disableDefaultUI={true}
                    gestureHandling={'none'}
                    mapId="hazard-map"
                  >
                    <Marker position={{ lat: selectedHazard.lat, lng: selectedHazard.lng }} />
                  </Map>
                </APIProvider>
              ) : (
                <>
                  <div className="absolute inset-0 opacity-50" style={{
                    backgroundImage: 'url("https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1000")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'grayscale(100%) contrast(120%) brightness(40%)'
                  }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
                      <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
              className={cn(
                "p-4 rounded-xl border transition-colors group cursor-pointer",
                selectedHazard?.id === hazard.id ? "bg-zinc-900 border-indigo-500/50" : "bg-zinc-950 border-white/5 hover:border-white/10"
              )}
              onClick={() => setSelectedHazard(hazard)}
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
              {selectedHazard?.id !== hazard.id && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 group-hover:text-indigo-400 transition-colors w-fit">
                  <MapPin className="w-3 h-3" />
                  View on map
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
