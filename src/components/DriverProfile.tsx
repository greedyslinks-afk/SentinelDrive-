import React, { useState, useEffect } from 'react';
import { User, Save, CheckCircle2 } from 'lucide-react';

export interface DriverPreferences {
  name: string;
  preferredSpeed: 'cautious' | 'normal' | 'brisk';
  avoidHighways: boolean;
  avoidTolls: boolean;
  predictiveAlertSensitivity: number;
  hapticSettings: {
    enabled: boolean;
    lowHazard: string;
    medHazard: string;
    highHazard: string;
  };
}

export const defaultPreferences: DriverPreferences = {
  name: 'Driver',
  preferredSpeed: 'normal',
  avoidHighways: false,
  avoidTolls: false,
  predictiveAlertSensitivity: 5,
  hapticSettings: {
    enabled: true,
    lowHazard: 'short',
    medHazard: 'double',
    highHazard: 'long'
  }
};

interface DriverProfileProps {
  preferences: DriverPreferences;
  onSave: (prefs: DriverPreferences) => void;
}

export function DriverProfile({ preferences, onSave }: DriverProfileProps) {
  const [localPrefs, setLocalPrefs] = useState<DriverPreferences>(preferences);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localPrefs);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
          <User className="w-5 h-5" />
        </div>
        <h2 className="text-xl font-medium text-white">Driver Profile</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
        <div className="space-y-4 bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Driver Name</label>
            <input
              type="text"
              value={localPrefs.name}
              onChange={(e) => setLocalPrefs({ ...localPrefs, name: e.target.value })}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              placeholder="Enter your name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Preferred Driving Speed</label>
            <div className="grid grid-cols-3 gap-3">
              {(['cautious', 'normal', 'brisk'] as const).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setLocalPrefs({ ...localPrefs, preferredSpeed: speed })}
                  className={`py-3 px-4 rounded-xl text-sm font-medium capitalize transition-colors border ${
                    localPrefs.preferredSpeed === speed
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                      : 'bg-zinc-950 border-white/10 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {speed}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              {localPrefs.preferredSpeed === 'cautious' && 'Prefers slower, safer routes. AI will warn earlier.'}
              {localPrefs.preferredSpeed === 'normal' && 'Standard routing and alert timing.'}
              {localPrefs.preferredSpeed === 'brisk' && 'Prefers faster routes. AI will adjust alert timing for higher speeds.'}
            </p>
          </div>
        </div>

        <div className="space-y-4 bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Alert Settings</h3>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-400">Predictive Alert Sensitivity</label>
              <span className="text-xs font-medium text-indigo-400">{localPrefs.predictiveAlertSensitivity} seconds</span>
            </div>
            <input
              type="range"
              min="3"
              max="15"
              step="1"
              value={localPrefs.predictiveAlertSensitivity}
              onChange={(e) => setLocalPrefs({ ...localPrefs, predictiveAlertSensitivity: parseInt(e.target.value) })}
              className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-2">
              <span>Closer (3s)</span>
              <span>Further (15s)</span>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Adjust how early the AI warns you about potential hazards ahead.
            </p>
          </div>
        </div>

        <div className="space-y-4 bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Route Preferences</h3>
          
          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">Avoid Highways</span>
              <span className="text-xs text-zinc-500">Prefer local roads and streets</span>
            </div>
            <div className="relative inline-block w-12 h-6 rounded-full bg-zinc-950 border border-white/10">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={localPrefs.avoidHighways}
                onChange={(e) => setLocalPrefs({ ...localPrefs, avoidHighways: e.target.checked })}
              />
              <span className="absolute inset-y-1 left-1 w-4 h-4 bg-zinc-500 rounded-full transition-all peer-checked:bg-indigo-500 peer-checked:left-7"></span>
            </div>
          </label>

          <div className="h-px bg-white/5 w-full" />

          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">Avoid Toll Roads</span>
              <span className="text-xs text-zinc-500">Prefer free routes even if they take longer</span>
            </div>
            <div className="relative inline-block w-12 h-6 rounded-full bg-zinc-950 border border-white/10">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={localPrefs.avoidTolls}
                onChange={(e) => setLocalPrefs({ ...localPrefs, avoidTolls: e.target.checked })}
              />
              <span className="absolute inset-y-1 left-1 w-4 h-4 bg-zinc-500 rounded-full transition-all peer-checked:bg-indigo-500 peer-checked:left-7"></span>
            </div>
          </label>
        </div>

        <button
          type="submit"
          className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            isSaved
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
          }`}
        >
          {isSaved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Preferences Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Profile
            </>
          )}
        </button>
      </form>
    </div>
  );
}
