import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { MapPin, Navigation, Loader2, AlertCircle, Plus, X, Map as MapIcon, FileText, Mic, History, ArrowRight, LocateFixed } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface RouteHistoryItem {
  id: string;
  startLocation: string;
  destination: string;
  timestamp: number;
}

interface RoutePlannerProps {
  onMapModeChange?: (isMap: boolean) => void;
  isExpanded?: boolean;
}

export function RoutePlanner({ onMapModeChange, isExpanded }: RoutePlannerProps = {}) {
  const [destination, setDestination] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [stops, setStops] = useState<string[]>([]);
  const [routeInfo, setRouteInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapLinks, setMapLinks] = useState<{ uri: string; title: string }[]>([]);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryItem[]>([]);

  React.useEffect(() => {
    const saved = localStorage.getItem('sentinel_route_history');
    if (saved) {
      try {
        setRouteHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveToHistory = (start: string, dest: string) => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      startLocation: start || 'Current Location',
      destination: dest,
      timestamp: Date.now()
    };
    const updated = [newItem, ...routeHistory.filter(r => r.destination !== dest)].slice(0, 10);
    setRouteHistory(updated);
    localStorage.setItem('sentinel_route_history', JSON.stringify(updated));
  };

  const addStop = () => setStops([...stops, '']);
  const removeStop = (index: number) => setStops(stops.filter((_, i) => i !== index));
  const updateStop = (index: number, value: string) => {
    const newStops = [...stops];
    newStops[index] = value;
    setStops(newStops);
  };

  const startVoiceCommand = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      await parseVoiceCommand(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setError(`Voice recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const parseVoiceCommand = async (transcript: string) => {
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Parse the following voice command for a route planner. Extract the starting location, destination, and any intermediate stops. Also detect if the user wants to avoid tolls or highways.
Command: "${transcript}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              startLocation: { type: Type.STRING },
              destination: { type: Type.STRING },
              stops: { type: Type.ARRAY, items: { type: Type.STRING } },
              avoidTolls: { type: Type.BOOLEAN },
              avoidHighways: { type: Type.BOOLEAN }
            }
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      
      if (data.startLocation) setStartLocation(data.startLocation);
      if (data.destination) setDestination(data.destination);
      if (data.stops && Array.isArray(data.stops)) setStops(data.stops);
      if (typeof data.avoidTolls === 'boolean') setAvoidTolls(data.avoidTolls);
      if (typeof data.avoidHighways === 'boolean') setAvoidHighways(data.avoidHighways);
      
    } catch (err: any) {
      console.error("Failed to parse voice command:", err);
      setError("Failed to understand voice command. Please try again or type manually.");
    } finally {
      setIsLoading(false);
    }
  };

  const planRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return;

    setIsLoading(true);
    setError('');
    setRouteInfo('');
    setMapLinks([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Try to get user location if startLocation is empty or 'Current Location'
      let latLng;
      if (!startLocation || startLocation.toLowerCase() === 'current location') {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          latLng = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
        } catch (geoErr) {
          console.warn("Geolocation failed, proceeding without it.", geoErr);
        }
      }

      const validStops = stops.filter(s => s.trim() !== '');
      const stopsText = validStops.length > 0 ? ` with the following intermediate stops in order: ${validStops.join(', ')}.` : '';

      const preferences = [];
      if (avoidTolls) preferences.push('avoiding tolls');
      if (avoidHighways) preferences.push('avoiding highways');
      const prefText = preferences.length > 0 ? ` Please ensure the route prefers ${preferences.join(' and ')}.` : '';

      const prompt = startLocation 
        ? `Plan a route from ${startLocation} to ${destination}${stopsText} Provide an optimized route considering real-time traffic and hazards.${prefText} Return the route details.`
        : `Plan a route to ${destination}${stopsText} Provide an optimized route considering real-time traffic and hazards.${prefText} Return the route details.`;

      const config: any = {
        tools: [{ googleMaps: {} }]
      };

      if (latLng) {
        config.toolConfig = {
          retrievalConfig: {
            latLng
          }
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config
      });

      setRouteInfo(response.text || "No route information found.");
      saveToHistory(startLocation, destination);
      
      // Extract map links
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const links: { uri: string; title: string }[] = [];
        chunks.forEach((chunk: any) => {
          if (chunk.maps?.uri) {
            links.push({ uri: chunk.maps.uri, title: chunk.maps.title || 'View on Google Maps' });
          }
        });
        setMapLinks(links);
      }

      // Auto switch to map mode
      if (onMapModeChange) onMapModeChange(true);
    } catch (err: any) {
      console.error("Route planning error:", err);
      setError(err.message || "Failed to plan route.");
    } finally {
      setIsLoading(false);
    }
  };

  const getMapEmbedUrl = () => {
    const origin = (!startLocation || startLocation.toLowerCase() === 'current location') ? 'Current+Location' : encodeURIComponent(startLocation);
    let dest = encodeURIComponent(destination);
    
    const validStops = stops.filter(s => s.trim() !== '');
    if (validStops.length > 0) {
      const stopsStr = validStops.map(s => encodeURIComponent(s)).join('+to:');
      dest = `${stopsStr}+to:${dest}`;
    }
    
    let url = `https://maps.google.com/maps?saddr=${origin}&daddr=${dest}&output=embed`;
    
    let dirflg = '';
    if (avoidTolls) dirflg += 't';
    if (avoidHighways) dirflg += 'h';
    if (dirflg) {
      url += `&dirflg=${dirflg}`;
    }
    
    return url;
  };

  return (
    <div className={cn(
      "border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex",
      isExpanded ? "bg-black/40 h-full flex-row" : "bg-zinc-950/80 max-h-full flex-col"
    )}>
      {/* Left Panel: Controls & Details */}
      <div className={cn(
        "flex flex-col transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] h-full",
        isExpanded ? "w-96 shrink-0 pr-6 border-r border-white/10" : "w-full"
      )}>
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <Navigation className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-medium text-white">Route Planner</h2>
          </div>
          
          {(routeInfo || routeHistory.length > 0) && (
            <button
              onClick={() => onMapModeChange?.(!isExpanded)}
              className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 bg-zinc-800/80 text-white hover:bg-zinc-700 border border-white/10"
            >
              <MapIcon className="w-3.5 h-3.5" />
              {isExpanded ? "Hide Map" : "Show Map"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <form onSubmit={planRoute} className="space-y-4">
                <button
                  type="button"
                  onClick={startVoiceCommand}
                  className={cn(
                    "w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 border",
                    isListening 
                      ? "bg-red-500/20 border-red-500/30 text-red-400 animate-pulse" 
                      : "bg-zinc-800/50 border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  )}
                >
                  <Mic className="w-4 h-4" />
                  {isListening ? "Listening..." : "Use Voice Command"}
                </button>

                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Starting point"
                    value={startLocation}
                    onChange={(e) => setStartLocation(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl py-3 pl-10 pr-12 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setStartLocation('Current Location')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                    title="Use Current Location"
                  >
                    <LocateFixed className="w-4 h-4" />
                  </button>
                </div>

                {stops.map((stop, index) => (
                  <div key={index} className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-zinc-500" />
                      <input
                        type="text"
                        placeholder={`Stop ${index + 1}`}
                        value={stop}
                        onChange={(e) => updateStop(index, e.target.value)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStop(index)}
                      className="p-3 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addStop}
                  className="w-full py-2 border border-dashed border-white/10 hover:border-white/20 text-zinc-400 hover:text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Stop
                </button>

                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="text"
                    placeholder="Destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                </div>

                <div className="flex flex-wrap gap-4 pt-1 pb-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer hover:text-zinc-300">
                    <input 
                      type="checkbox" 
                      checked={avoidTolls}
                      onChange={e => setAvoidTolls(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-950"
                    />
                    Avoid Tolls
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer hover:text-zinc-300">
                    <input 
                      type="checkbox" 
                      checked={avoidHighways}
                      onChange={e => setAvoidHighways(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-950"
                    />
                    Avoid Highways
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !destination}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Plan Route"}
                </button>
              </form>

              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {!routeInfo && routeHistory.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <History className="w-4 h-4" /> Recent Routes
                  </h3>
                  <div className="space-y-2">
                    {routeHistory.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setStartLocation(item.startLocation === 'Current Location' ? '' : item.startLocation);
                          setDestination(item.destination);
                        }}
                        className="w-full text-left p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm text-white font-medium">{item.destination}</span>
                          <span className="text-xs text-zinc-500">From: {item.startLocation}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {routeInfo && (
                <div className="mt-6 space-y-4">
                  <div className="prose prose-invert prose-sm max-w-none text-zinc-300">
                    <div className="markdown-body">
                      <Markdown>{routeInfo}</Markdown>
                    </div>
                  </div>
                  
                  {mapLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                      {mapLinks.map((link, i) => (
                        <a
                          key={i}
                          href={link.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors border border-white/5"
                        >
                          <MapPin className="w-3 h-3" />
                          {link.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
        </div>
      </div>

      {/* Right Panel: Map */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, width: 0, marginLeft: 0, scale: 0.95 }}
            animate={{ opacity: 1, width: '100%', marginLeft: 24, scale: 1 }}
            exit={{ opacity: 0, width: 0, marginLeft: 0, scale: 0.95 }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            className="relative rounded-xl overflow-hidden border border-white/10 bg-black/20 h-full flex-1 shadow-inner"
          >
            <iframe
              title="Route Map"
              width="100%"
              height="100%"
              style={{ border: 0, opacity: 0.75, filter: 'contrast(1.1) saturate(1.2)' }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={getMapEmbedUrl()}
            ></iframe>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
