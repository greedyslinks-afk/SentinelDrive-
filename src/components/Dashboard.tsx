import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Activity, Plus, MapPin, Navigation, Map as MapIcon, BarChart2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { HazardFeed } from './HazardFeed';
import { GPSAnalysis } from './GPSAnalysis';

interface DashboardProps {
  hazards: any[];
  onAddHazard: (hazard: any) => void;
}

export function Dashboard({ 
  hazards, 
  onAddHazard,
  speed,
  hardStops,
  hardTurns,
  score,
  activeTab,
  setActiveTab,
  savedTrips,
  onDeleteTrip,
  onTransferTrip
}: DashboardProps & {
  speed: number;
  hardStops: number;
  hardTurns: number;
  score: number;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  savedTrips: any[];
  onDeleteTrip: (id: string) => void;
  onTransferTrip: (trip: any) => void;
}) {

  const handleManualHazard = () => {
    const types = ['object', 'police', 'accident', 'pothole', 'traffic'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    onAddHazard({
      hazard_level: Math.floor(Math.random() * 3) + 2,
      hazard_type: randomType,
      haptic_pattern: 'short',
      auto_notify: `Manual report: ${randomType} ahead`,
      history_available: true,
      manual: true
    });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950/90 backdrop-blur-xl border-t border-white/10">
      {/* Dashboard Header & Tabs */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('safety')}
            className={cn(
              "text-sm font-medium transition-colors pb-3 -mb-3 border-b-2",
              activeTab === 'safety' ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-300"
            )}
          >
            Safety Score
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "text-sm font-medium transition-colors pb-3 -mb-3 border-b-2",
              activeTab === 'history' ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-300"
            )}
          >
            My History
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={cn(
              "text-sm font-medium transition-colors pb-3 -mb-3 border-b-2",
              activeTab === 'community' ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-300"
            )}
          >
            Community
          </button>
          <button
            onClick={() => setActiveTab('gps')}
            className={cn(
              "text-sm font-medium transition-colors pb-3 -mb-3 border-b-2 flex items-center gap-1.5",
              activeTab === 'gps' ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-300"
            )}
          >
            <BarChart2 className="w-4 h-4" />
            GPS Analysis
          </button>
          <button
            onClick={() => setActiveTab('trips')}
            className={cn(
              "text-sm font-medium transition-colors pb-3 -mb-3 border-b-2 flex items-center gap-1.5",
              activeTab === 'trips' ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-300"
            )}
          >
            Saved Trips
          </button>
        </div>
        
        <button
          onClick={handleManualHazard}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Report Hazard
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {activeTab === 'safety' && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 h-full">
            <div className="sm:col-span-1 flex flex-col justify-center items-center p-6 bg-zinc-900/50 rounded-2xl border border-white/5">
              <div className="relative flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-800" />
                  <circle 
                    cx="64" cy="64" r="56" 
                    stroke="currentColor" 
                    strokeWidth="8" 
                    fill="transparent" 
                    strokeDasharray={351.85} 
                    strokeDashoffset={351.85 - (351.85 * score) / 100}
                    className={cn(
                      "transition-all duration-1000",
                      score > 80 ? "text-emerald-500" : score > 60 ? "text-amber-500" : "text-red-500"
                    )} 
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-4xl font-light text-white">{score}</span>
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">Score</span>
                </div>
              </div>
            </div>
            
            <div className="sm:col-span-3 grid grid-cols-3 gap-4">
              <div className="bg-zinc-900/50 rounded-2xl border border-white/5 p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-medium">Current Speed</span>
                </div>
                <div className="text-3xl font-light text-white">{speed} <span className="text-lg text-zinc-500">mph</span></div>
              </div>
              
              <div className="bg-zinc-900/50 rounded-2xl border border-white/5 p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Hard Stops</span>
                </div>
                <div className="text-3xl font-light text-white">{hardStops}</div>
              </div>
              
              <div className="bg-zinc-900/50 rounded-2xl border border-white/5 p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                  <Navigation className="w-4 h-4" />
                  <span className="text-sm font-medium">Hard Turns</span>
                </div>
                <div className="text-3xl font-light text-white">{hardTurns}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="h-full">
            {hazards.filter(h => h.manual || h.history_available).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <Shield className="w-12 h-12 mb-4 opacity-20" />
                <p>No personal hazard history yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {hazards.filter(h => h.manual || h.history_available).map((hazard, idx) => (
                  <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-zinc-500">
                        {new Date(hazard.timestamp).toLocaleTimeString()}
                      </span>
                      {hazard.manual && (
                        <span className="text-[10px] uppercase tracking-wider bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">Manual</span>
                      )}
                    </div>
                    <div className="font-medium text-white mb-1 capitalize">{hazard.hazard_type}</div>
                    <div className="text-sm text-zinc-400">{hazard.auto_notify}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'community' && (
          <div className="h-full">
            <HazardFeed hazards={hazards} />
          </div>
        )}

        {activeTab === 'gps' && (
          <div className="h-full">
            <GPSAnalysis />
          </div>
        )}

        {activeTab === 'trips' && (
          <div className="h-full">
            {savedTrips.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <Shield className="w-12 h-12 mb-4 opacity-20" />
                <p>No saved trips yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {savedTrips.map((trip) => (
                  <div key={trip.id} className="bg-zinc-900/50 rounded-xl p-4 border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white mb-1">
                        Trip on {new Date(trip.date).toLocaleString()}
                      </div>
                      <div className="text-sm text-zinc-400 flex gap-4">
                        <span>Score: {trip.score}</span>
                        <span>Hard Stops: {trip.hardStops}</span>
                        <span>Hard Turns: {trip.hardTurns}</span>
                        <span>Hazards: {trip.hazardsCount}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => onTransferTrip(trip)}
                        className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg text-xs font-medium transition-colors"
                      >
                        Transfer
                      </button>
                      <button 
                        onClick={() => onDeleteTrip(trip.id)}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
