import React, { useState, useEffect } from 'react';
import { SentinelCamera } from './components/SentinelCamera';
import { RoutePlanner } from './components/RoutePlanner';
import { Dashboard } from './components/Dashboard';
import { EmergencyAlertSystem } from './components/EmergencyAlertSystem';
import { DriverPreferences, defaultPreferences } from './components/DriverProfile';
import { Shield, Settings, X, ChevronDown, Map as MapIcon, Activity, Power, AlertOctagon } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [hazards, setHazards] = useState<any[]>([]);
  
  // UI States
  const [showRoutePlanner, setShowRoutePlanner] = useState(true);
  const [isRouteExpanded, setIsRouteExpanded] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [uiScale, setUiScale] = useState(1);
  const [isEndingTrip, setIsEndingTrip] = useState(false);
  
  // Dashboard & Trip States
  const [activeTab, setActiveTab] = useState<'safety' | 'history' | 'community' | 'gps' | 'trips' | 'profile'>('safety');
  const [savedTrips, setSavedTrips] = useState<any[]>(() => {
    const saved = localStorage.getItem('sentinel_saved_trips');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Driver Profile State
  const [driverPreferences, setDriverPreferences] = useState<DriverPreferences>(() => {
    const saved = localStorage.getItem('sentinel_driver_prefs');
    return saved ? JSON.parse(saved) : defaultPreferences;
  });

  useEffect(() => {
    localStorage.setItem('sentinel_driver_prefs', JSON.stringify(driverPreferences));
  }, [driverPreferences]);
  
  // Safety Score State
  const [speed, setSpeed] = useState(0);
  const [hardStops, setHardStops] = useState(0);
  const [hardTurns, setHardTurns] = useState(0);
  const [rapidAccelerations, setRapidAccelerations] = useState(0);
  const [score, setScore] = useState(100);
  
  // Safety Lock States
  const [tapCount, setTapCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  // Emergency States
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');

  // Location State
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const currentLocationRef = React.useRef<{lat: number, lng: number} | null>(null);
  const [isGpsEnabled, setIsGpsEnabled] = useState(false);
  const [gpsPermissionState, setGpsPermissionState] = useState<PermissionState | 'unknown'>('unknown');

  // Check initial GPS permission
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setGpsPermissionState(result.state);
        if (result.state === 'granted') {
          setIsGpsEnabled(true);
        }
        result.onchange = () => {
          setGpsPermissionState(result.state);
          if (result.state === 'granted') setIsGpsEnabled(true);
          else setIsGpsEnabled(false);
        };
      }).catch(() => {
        // Fallback for browsers that don't support permissions.query for geolocation
        setGpsPermissionState('unknown');
      });
    }
  }, []);

  // Track Speed and Safety globally
  useEffect(() => {
    if (!isGpsEnabled) return;

    let lastSpeed: number | null = null;
    let lastHeading: number | null = null;
    let lastTime: number | null = null;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        currentLocationRef.current = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentLocation(currentLocationRef.current);
        
        const currentSpeed = position.coords.speed || 0; // m/s
        const currentHeading = position.coords.heading;
        const currentTime = position.timestamp;
        
        // Convert m/s to mph
        const speedMph = currentSpeed * 2.23694;
        setSpeed(Math.round(speedMph));

        if (lastSpeed !== null && lastTime !== null && currentTime > lastTime) {
          const timeDelta = (currentTime - lastTime) / 1000; // seconds
          const speedDelta = currentSpeed - lastSpeed; // m/s
          const acceleration = speedDelta / timeDelta; // m/s^2

          // Hard stop threshold: deceleration > 3 m/s^2 (approx 0.3g)
          if (acceleration < -6) {
            // Severe hard stop -> Emergency
            setIsEmergency(true);
            setEmergencyReason('Severe sudden stop detected');
          } else if (acceleration < -3) {
            setHardStops(prev => prev + 1);
            setScore(prev => Math.max(0, prev - 2));
          } else if (acceleration > 3) {
            setRapidAccelerations(prev => prev + 1);
            setScore(prev => Math.max(0, prev - 1));
          }
        }

        if (lastHeading !== null && currentHeading !== null && lastTime !== null && currentTime > lastTime) {
          // Calculate shortest heading difference
          let headingDelta = Math.abs(currentHeading - lastHeading);
          if (headingDelta > 180) headingDelta = 360 - headingDelta;
          
          const timeDelta = (currentTime - lastTime) / 1000;
          const turnRate = headingDelta / timeDelta; // degrees per second

          // Hard turn threshold: > 30 degrees per second while moving
          if (turnRate > 60 && currentSpeed > 5) {
            // Erratic steering -> Emergency
            setIsEmergency(true);
            setEmergencyReason('Erratic steering detected');
          } else if (turnRate > 30 && currentSpeed > 2) {
            setHardTurns(prev => prev + 1);
            setScore(prev => Math.max(0, prev - 1));
          }
        }

        lastSpeed = currentSpeed;
        lastHeading = currentHeading;
        lastTime = currentTime;
      },
      (error) => {
        console.warn('GPS Error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setIsGpsEnabled(false);
          setGpsPermissionState('denied');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isGpsEnabled]);

  // Tap Lock Logic
  useEffect(() => {
    let maxTaps = Infinity;
    if (speed > 60) maxTaps = 1;
    else if (speed >= 20) maxTaps = 2;

    if (tapCount >= maxTaps && maxTaps !== Infinity) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  }, [speed, tapCount]);

  // Reset taps after 8 seconds of inactivity
  useEffect(() => {
    if (tapCount > 0) {
      const timer = setTimeout(() => {
        setTapCount(0);
        setIsLocked(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [tapCount]);

  const handleGlobalClick = (e: React.MouseEvent) => {
    if (isLocked) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    
    let maxTaps = Infinity;
    if (speed > 60) maxTaps = 1;
    else if (speed >= 20) maxTaps = 2;

    if (maxTaps !== Infinity) {
      setTapCount(prev => prev + 1);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Scroll to scale the page
    if (e.ctrlKey || e.metaKey || e.altKey) {
      setUiScale(prev => Math.min(Math.max(0.5, prev - e.deltaY * 0.005), 1.5));
    }
  };

  const handleHazardReported = (hazard: any) => {
    if (hazard.hazard_level > 0 || hazard.manual) {
      setHazards(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        ...hazard,
        lat: currentLocationRef.current?.lat,
        lng: currentLocationRef.current?.lng,
        timestamp: new Date()
      }, ...prev].slice(0, 50)); // Keep last 50
      
      // Trigger emergency for severe hazards
      if (hazard.hazard_level >= 4) {
        setIsEmergency(true);
        setEmergencyReason(`Severe hazard detected: ${hazard.hazard_type}`);
      }
    }
  };

  const handleEndTrip = () => {
    if (window.confirm("Are you sure you want to end the current trip and save the data?")) {
      setIsEndingTrip(true);
      
      const newTrip = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        score,
        hardStops,
        hardTurns,
        rapidAccelerations,
        hazardsCount: hazards.filter(h => h.manual || h.history_available).length,
        hazards: hazards.filter(h => h.manual || h.history_available)
      };

      const updatedTrips = [newTrip, ...savedTrips].slice(0, 10); // Keep only 10 trips
      setSavedTrips(updatedTrips);
      localStorage.setItem('sentinel_saved_trips', JSON.stringify(updatedTrips));

      setTimeout(() => {
        setShowRoutePlanner(false);
        setIsRouteExpanded(false);
        setActiveTab('trips');
        setShowDashboard(true);
        setIsEndingTrip(false);
        
        // Reset current trip stats
        setScore(100);
        setHardStops(0);
        setHardTurns(0);
        setRapidAccelerations(0);
        setHazards([]);
      }, 1200); // Wait for animation
    }
  };

  const handleDeleteTrip = (id: string) => {
    if (window.confirm("Delete this saved trip?")) {
      const updated = savedTrips.filter(t => t.id !== id);
      setSavedTrips(updated);
      localStorage.setItem('sentinel_saved_trips', JSON.stringify(updated));
    }
  };

  const handleTransferTrip = (trip: any) => {
    // Export trip data as JSON, ensuring no sensitive data is included
    const exportData = {
      id: trip.id,
      date: trip.date,
      score: trip.score,
      hardStops: trip.hardStops,
      hardTurns: trip.hardTurns,
      hazards: trip.hazards.map((h: any) => ({
        type: h.hazard_type,
        level: h.hazard_level,
        timestamp: h.timestamp,
        manual: h.manual
      }))
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `sentinel_trip_${trip.id}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div 
      className="relative h-screen w-screen overflow-hidden bg-black text-zinc-100 font-sans selection:bg-indigo-500/30"
      onClickCapture={handleGlobalClick}
      onWheel={handleWheel}
    >
      {/* Scalable Container */}
      <div 
        className="absolute inset-0 origin-top-left transition-transform duration-75"
        style={{ 
          transform: `scale(${uiScale})`, 
          width: `${100 / uiScale}%`, 
          height: `${100 / uiScale}%` 
        }}
      >
        {/* Background: Sentry Camera */}
        <SentinelCamera 
          onHazardReported={handleHazardReported} 
          hazards={hazards}
          currentLocation={currentLocation}
          driverPreferences={driverPreferences}
          onUpdatePreferences={setDriverPreferences}
        />

        {/* Header Overlay */}
        <header className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="max-w-screen-2xl mx-auto px-6 h-20 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white drop-shadow-md">
                Sentinel<span className="text-indigo-400">Drive</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {!isGpsEnabled ? (
                <button
                  onClick={() => {
                    if (gpsPermissionState === 'denied') {
                      alert("GPS permission is denied. Please enable it in your browser settings.");
                    } else {
                      setIsGpsEnabled(true);
                    }
                  }}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-medium backdrop-blur-md hover:bg-yellow-500/30 transition-colors cursor-pointer"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  Enable GPS
                </button>
              ) : (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium backdrop-blur-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  GPS Active
                </div>
              )}
              
              <div className="relative">
                <button 
                  onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                  className="flex items-center gap-2 p-2 px-3 text-zinc-300 hover:text-white transition-colors rounded-lg hover:bg-white/10 backdrop-blur-md bg-black/20"
                >
                  <Settings className="w-5 h-5" />
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showSettingsDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    <button 
                      onClick={() => { setShowRoutePlanner(!showRoutePlanner); setShowSettingsDropdown(false); }}
                      className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center justify-between"
                    >
                      Route Planner
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", showRoutePlanner ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500")}>
                        {showRoutePlanner ? 'ON' : 'OFF'}
                      </span>
                    </button>
                    <button 
                      onClick={() => { setShowDashboard(!showDashboard); setShowSettingsDropdown(false); }}
                      className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors border-t border-white/5 flex items-center justify-between"
                    >
                      Dashboard
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", showDashboard ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500")}>
                        {showDashboard ? 'ON' : 'OFF'}
                      </span>
                    </button>
                    <div className="px-4 py-3 border-t border-white/5">
                      <div className="text-xs text-zinc-500 mb-2 flex justify-between">
                        <span>UI Scale</span>
                        <span>{Math.round(uiScale * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" max="1.5" step="0.1" 
                        value={uiScale} 
                        onChange={(e) => setUiScale(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                      <div className="text-[10px] text-zinc-600 mt-1">Scroll with Alt/Ctrl to scale</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Overlay: Route Planner */}
        {showRoutePlanner && (
          <div className={cn(
            "absolute z-10 flex flex-col transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isRouteExpanded 
              ? "inset-6 bottom-80" // Expanded but leaving room for dashboard
              : "top-24 left-6 w-96 max-h-[calc(100vh-400px)]",
            isEndingTrip && "scale-50 opacity-0 translate-y-12 origin-center"
          )}>
            <div className={cn(
              "relative h-full w-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
              isRouteExpanded ? "shadow-2xl" : "shadow-2xl"
            )}>
              <button 
                onClick={() => {
                  setShowRoutePlanner(false);
                  setIsRouteExpanded(false);
                }}
                className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/80 text-zinc-400 hover:text-white rounded-full backdrop-blur-md transition-colors"
                title="Close Route Planner"
              >
                <X className="w-4 h-4" />
              </button>
              <RoutePlanner 
                onMapModeChange={setIsRouteExpanded} 
                isExpanded={isRouteExpanded} 
                driverPreferences={driverPreferences}
              />
            </div>
          </div>
        )}

        {/* Footer Dashboard */}
        {showDashboard && (
          <div className={cn(
            "absolute bottom-0 left-0 right-0 z-20 h-72 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] origin-bottom",
            isEndingTrip && "scale-y-50 opacity-0 translate-y-12"
          )}>
            <div className="relative h-full">
              <button 
                onClick={() => setShowDashboard(false)}
                className="absolute -top-12 right-6 z-20 p-3 bg-black/50 hover:bg-black/80 text-zinc-400 hover:text-white rounded-full backdrop-blur-md transition-colors border border-white/10"
                title="Close Dashboard"
              >
                <X className="w-5 h-5" />
              </button>
              <Dashboard 
                hazards={hazards} 
                onAddHazard={handleHazardReported}
                speed={speed}
                hardStops={hardStops}
                hardTurns={hardTurns}
                rapidAccelerations={rapidAccelerations}
                score={score}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                savedTrips={savedTrips}
                onDeleteTrip={handleDeleteTrip}
                onTransferTrip={handleTransferTrip}
                onTriggerSOS={() => {
                  setIsEmergency(true);
                  setEmergencyReason('Manual SOS Triggered');
                }}
                driverPreferences={driverPreferences}
                onSavePreferences={setDriverPreferences}
              />
            </div>
          </div>
        )}

        {/* Restore Buttons if hidden */}
        {(!showRoutePlanner || !showDashboard) && (
          <div className="absolute left-6 bottom-6 z-10 flex flex-col gap-3">
            {!showRoutePlanner && (
              <button 
                onClick={() => setShowRoutePlanner(true)}
                className="p-4 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-2xl backdrop-blur-md shadow-xl border border-white/10 flex items-center gap-2"
              >
                <MapIcon className="w-5 h-5" />
                <span className="font-medium">Route</span>
              </button>
            )}
            {!showDashboard && (
              <button 
                onClick={() => setShowDashboard(true)}
                className="p-4 bg-zinc-900/90 hover:bg-zinc-800 text-white rounded-2xl backdrop-blur-md shadow-xl border border-white/10 flex items-center gap-2"
              >
                <Activity className="w-5 h-5" />
                <span className="font-medium">Dashboard</span>
              </button>
            )}
          </div>
        )}

        {/* Tap Lock Overlay */}
        {isLocked && !isEmergency && (
          <div className="absolute inset-0 z-[100] bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto">
            <Shield className="w-24 h-24 text-red-500 mb-6 animate-pulse" />
            <h2 className="text-4xl font-bold text-white mb-2 text-center">Safety Lock Active</h2>
            <p className="text-xl text-red-200 text-center max-w-md">
              Screen interactions are restricted while driving at high speeds. Keep your eyes on the road!
            </p>
            <div className="mt-8 px-6 py-3 bg-red-500/20 rounded-full border border-red-500/30 text-red-300 font-medium">
              Lock will release automatically
            </div>
          </div>
        )}

        {/* Emergency Alert System */}
        <EmergencyAlertSystem 
          isEmergency={isEmergency}
          reason={emergencyReason}
          location={currentLocation}
          onDismiss={() => setIsEmergency(false)}
        />
      </div>
    </div>
  );
}
