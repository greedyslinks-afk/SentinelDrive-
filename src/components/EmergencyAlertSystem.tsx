import React, { useEffect, useState, useRef } from 'react';
import { AlertOctagon, Phone, X, MapPin, Volume2 } from 'lucide-react';

interface EmergencyAlertSystemProps {
  isEmergency: boolean;
  reason: string;
  location: { lat: number; lng: number } | null;
  onDismiss: () => void;
}

export function EmergencyAlertSystem({ isEmergency, reason, location, onDismiss }: EmergencyAlertSystemProps) {
  const [countdown, setCountdown] = useState(10);
  const [notified, setNotified] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (isEmergency) {
      setCountdown(10);
      setNotified(false);
      
      // Play audible alert
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      
      const playAlert = () => {
        if (!audioCtxRef.current) return;
        
        // Resume context if suspended (browser autoplay policy)
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }

        const oscillator = audioCtxRef.current.createOscillator();
        const gainNode = audioCtxRef.current.createGain();
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, audioCtxRef.current.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtxRef.current.currentTime + 0.5);
        
        gainNode.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtxRef.current.destination);
        
        oscillator.start();
        oscillator.stop(audioCtxRef.current.currentTime + 0.5);
      };

      playAlert();
      const interval = setInterval(playAlert, 1000);

      const countdownTimer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownTimer);
            clearInterval(interval);
            setNotified(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(interval);
        clearInterval(countdownTimer);
      };
    }
  }, [isEmergency]);

  if (!isEmergency) return null;

  return (
    <div className="absolute inset-0 z-[200] bg-red-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-zinc-900 rounded-3xl border border-red-500/30 shadow-2xl shadow-red-500/20 overflow-hidden flex flex-col items-center text-center p-8 relative">
        <button 
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <AlertOctagon className="w-12 h-12 text-red-500" />
        </div>

        <h2 className="text-3xl font-bold text-white mb-2">Emergency Detected</h2>
        <p className="text-red-400 font-medium mb-6">{reason}</p>

        {!notified ? (
          <>
            <div className="text-6xl font-light text-white mb-8 tabular-nums">
              00:{countdown.toString().padStart(2, '0')}
            </div>
            <p className="text-zinc-400 text-sm mb-8">
              Notifying emergency contacts and emergency services in {countdown} seconds unless dismissed.
            </p>
            <button 
              onClick={onDismiss}
              className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl transition-colors"
            >
              I'm Okay - Cancel Alert
            </button>
          </>
        ) : (
          <>
            <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-medium mb-2">
                <Phone className="w-5 h-5" />
                Emergency Contacts Notified
              </div>
              <p className="text-sm text-zinc-400">
                An SMS with your current location has been sent to your emergency contacts.
              </p>
            </div>
            
            {location && (
              <div className="w-full bg-black/30 rounded-xl p-4 mb-6 flex items-start gap-3 text-left">
                <MapPin className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-zinc-300">Last Known Location</div>
                  <div className="text-xs text-zinc-500 font-mono mt-1">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={onDismiss}
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors"
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
