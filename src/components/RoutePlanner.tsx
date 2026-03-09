import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MapPin, Navigation, Loader2, AlertCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';

export function RoutePlanner() {
  const [destination, setDestination] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [routeInfo, setRouteInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapLinks, setMapLinks] = useState<{ uri: string; title: string }[]>([]);

  const planRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return;

    setIsLoading(true);
    setError('');
    setRouteInfo('');
    setMapLinks([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Try to get user location if startLocation is empty
      let latLng;
      if (!startLocation) {
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

      const prompt = startLocation 
        ? `Plan a route from ${startLocation} to ${destination}. Provide an optimized route considering real-time traffic and hazards. Return the route details.`
        : `Plan a route to ${destination}. Provide an optimized route considering real-time traffic and hazards. Return the route details.`;

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
    } catch (err: any) {
      console.error("Route planning error:", err);
      setError(err.message || "Failed to plan route.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
          <Navigation className="w-5 h-5" />
        </div>
        <h2 className="text-xl font-medium text-white">Route Planner</h2>
      </div>

      <form onSubmit={planRoute} className="space-y-4">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Current Location (Leave empty for GPS)"
            value={startLocation}
            onChange={(e) => setStartLocation(e.target.value)}
            className="w-full bg-zinc-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
        <div className="relative">
          <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
            className="w-full bg-zinc-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
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
  );
}
