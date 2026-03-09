import React, { useState } from 'react';
import { SentinelCamera } from './components/SentinelCamera';
import { RoutePlanner } from './components/RoutePlanner';
import { HazardFeed } from './components/HazardFeed';
import { Shield, Activity, Map as MapIcon, Settings } from 'lucide-react';

export default function App() {
  const [hazards, setHazards] = useState<any[]>([]);

  const handleHazardReported = (hazard: any) => {
    if (hazard.hazard_level > 0) {
      setHazards(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        ...hazard,
        timestamp: new Date()
      }, ...prev].slice(0, 50)); // Keep last 50
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Sentinel<span className="text-indigo-400">Drive</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              System Online
            </div>
            <button className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Camera & Stats */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  Live Sentry View
                </h2>
                <span className="text-xs text-zinc-500 font-mono">CAM-01</span>
              </div>
              <SentinelCamera onHazardReported={handleHazardReported} />
            </section>
            
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                <div className="text-zinc-400 text-sm font-medium mb-2">Safety Score</div>
                <div className="text-4xl font-light text-white">98<span className="text-xl text-zinc-500">/100</span></div>
                <div className="mt-4 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[98%]" />
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm">
                <div className="text-zinc-400 text-sm font-medium mb-2">Hazards Detected</div>
                <div className="text-4xl font-light text-white">{hazards.length}</div>
                <div className="mt-4 text-xs text-zinc-500 flex items-center gap-1">
                  <span className="text-emerald-400">All clear</span> in your immediate vicinity
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Route & Feed */}
          <div className="space-y-8 flex flex-col h-full">
            <section>
              <RoutePlanner />
            </section>
            
            <section className="flex-1 min-h-[400px]">
              <HazardFeed hazards={hazards} />
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}
