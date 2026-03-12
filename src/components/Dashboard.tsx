import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Activity, Plus, MapPin, Navigation, Map as MapIcon, BarChart2, AlertCircle, Package, Car, Construction, XOctagon, MoveHorizontal, User, AlertOctagon, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { cn } from '../lib/utils';
import { HazardFeed } from './HazardFeed';
import { GPSAnalysis } from './GPSAnalysis';
import { DriverProfile, DriverPreferences } from './DriverProfile';

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
  rapidAccelerations,
  score,
  activeTab,
  setActiveTab,
  savedTrips,
  onDeleteTrip,
  onTransferTrip,
  onTriggerSOS,
  driverPreferences,
  onSavePreferences
}: DashboardProps & {
  speed: number;
  hardStops: number;
  hardTurns: number;
  rapidAccelerations: number;
  score: number;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  savedTrips: any[];
  onDeleteTrip: (id: string) => void;
  onTransferTrip: (trip: any) => void;
  onTriggerSOS: () => void;
  driverPreferences: DriverPreferences;
  onSavePreferences: (prefs: DriverPreferences) => void;
}) {

  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedHazardType, setSelectedHazardType] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<number>(3);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  const getTripTips = (trip: any) => {
    const tips = [];
    if (trip.hardStops > 0) {
      tips.push("Anticipate stops earlier to avoid hard braking. This improves fuel efficiency and reduces brake wear.");
    }
    if (trip.hardTurns > 0) {
      tips.push("Slow down before entering corners. Smooth steering helps maintain vehicle stability and passenger comfort.");
    }
    if (trip.rapidAccelerations > 0) {
      tips.push("Accelerate smoothly to save fuel and reduce engine strain. Rapid acceleration consumes significantly more gas.");
    }
    if (tips.length === 0) {
      tips.push("Excellent driving! Your smooth driving habits maximize fuel efficiency and safety.");
    }
    return tips;
  };

  const handleManualHazard = (type: string, severity: number) => {
    onAddHazard({
      hazard_level: severity,
      hazard_type: type,
      haptic_pattern: severity > 3 ? 'long' : severity === 3 ? 'double' : 'short',
      auto_notify: `Manual report: ${type.replace('_', ' ')} (Level ${severity})`,
      history_available: true,
      manual: true
    });
    setShowReportModal(false);
    setSelectedHazardType(null);
    setSelectedSeverity(3);
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
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "text-sm font-medium transition-colors pb-3 -mb-3 border-b-2 flex items-center gap-1.5",
              activeTab === 'profile' ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-300"
            )}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onTriggerSOS}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors border border-red-400/50 shadow-lg shadow-red-600/30 animate-pulse"
            title="Trigger Emergency SOS"
          >
            <AlertOctagon className="w-4 h-4" />
            SOS
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Report Hazard
          </button>
        </div>
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
            
            <div className="sm:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
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

              <div className="bg-zinc-900/50 rounded-2xl border border-white/5 p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                  <MoveHorizontal className="w-4 h-4" />
                  <span className="text-sm font-medium">Rapid Accels</span>
                </div>
                <div className="text-3xl font-light text-white">{rapidAccelerations}</div>
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
                  <div key={trip.id} className="bg-zinc-900/50 rounded-xl border border-white/5 overflow-hidden">
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setExpandedTripId(expandedTripId === trip.id ? null : trip.id)}
                    >
                      <div>
                        <div className="font-medium text-white mb-1">
                          Trip on {new Date(trip.date).toLocaleString()}
                        </div>
                        <div className="text-sm text-zinc-400 flex gap-4">
                          <span>Score: {trip.score}</span>
                          <span>Hazards: {trip.hazardsCount}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium",
                          trip.score >= 90 ? "bg-emerald-500/20 text-emerald-400" :
                          trip.score >= 70 ? "bg-amber-500/20 text-amber-400" :
                          "bg-red-500/20 text-red-400"
                        )}>
                          {trip.score}
                        </div>
                        {expandedTripId === trip.id ? <ChevronUp className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}
                      </div>
                    </div>
                    
                    {expandedTripId === trip.id && (
                      <div className="p-4 border-t border-white/5 bg-black/20">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                          <div className="bg-zinc-900 rounded-lg p-3 border border-white/5">
                            <div className="text-xs text-zinc-500 mb-1">Score</div>
                            <div className="text-xl text-white">{trip.score}</div>
                          </div>
                          <div className="bg-zinc-900 rounded-lg p-3 border border-white/5">
                            <div className="text-xs text-zinc-500 mb-1">Hard Stops</div>
                            <div className="text-xl text-white">{trip.hardStops}</div>
                          </div>
                          <div className="bg-zinc-900 rounded-lg p-3 border border-white/5">
                            <div className="text-xs text-zinc-500 mb-1">Hard Turns</div>
                            <div className="text-xl text-white">{trip.hardTurns}</div>
                          </div>
                          <div className="bg-zinc-900 rounded-lg p-3 border border-white/5">
                            <div className="text-xs text-zinc-500 mb-1">Rapid Accels</div>
                            <div className="text-xl text-white">{trip.rapidAccelerations || 0}</div>
                          </div>
                        </div>

                        <div className="mb-6">
                          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                            Driving Insights & Tips
                          </h4>
                          <ul className="space-y-2">
                            {getTripTips(trip).map((tip, idx) => (
                              <li key={idx} className="text-sm text-zinc-400 bg-zinc-900/50 p-3 rounded-lg border border-white/5">
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onTransferTrip(trip); }}
                            className="px-4 py-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg text-sm font-medium transition-colors"
                          >
                            Export Trip Data
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteTrip(trip.id); }}
                            className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="h-full">
            <DriverProfile preferences={driverPreferences} onSave={onSavePreferences} />
          </div>
        )}
      </div>

      {/* Manual Report Modal */}
      {showReportModal && (
        <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {!selectedHazardType ? (
              <>
                <h3 className="text-xl font-semibold text-white mb-4">Report Hazard</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'pothole', label: 'Pothole', icon: AlertCircle },
                    { id: 'object', label: 'Debris', icon: Package },
                    { id: 'traffic', label: 'Traffic Jam', icon: Car },
                    { id: 'road_work', label: 'Road Work', icon: Construction },
                    { id: 'road_closure', label: 'Road Closure', icon: XOctagon },
                    { id: 'accident', label: 'Accident', icon: AlertTriangle },
                    { id: 'lane_drift', label: 'Lane Drift', icon: MoveHorizontal },
                    { id: 'driver_fatigue', label: 'Driver Fatigue', icon: User },
                    { id: 'pedestrian', label: 'Pedestrian', icon: User },
                    { id: 'animal', label: 'Animal', icon: AlertTriangle },
                    { id: 'lane_marker', label: 'Lane Marker', icon: MoveHorizontal },
                  ].map(h => (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHazardType(h.id)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-700 border border-white/5 transition-colors text-zinc-300 hover:text-white"
                    >
                      <h.icon className="w-6 h-6" />
                      <span className="text-sm font-medium">{h.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="mt-6 w-full py-3 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-white mb-2">Confirm Report</h3>
                <p className="text-zinc-400 mb-4">
                  Are you sure you want to report <span className="text-white font-medium capitalize">{selectedHazardType.replace('_', ' ')}</span> to the community?
                </p>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Severity Level (1-5)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button
                        key={level}
                        onClick={() => setSelectedSeverity(level)}
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                          selectedSeverity === level 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedHazardType(null);
                      setSelectedSeverity(3);
                    }}
                    className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleManualHazard(selectedHazardType, selectedSeverity)}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors"
                  >
                    Confirm Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
