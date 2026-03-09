import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { Camera, Mic, MicOff, AlertTriangle, ShieldCheck, Activity, SlidersHorizontal, Focus, Vibrate, Settings2, Construction, Car, Package, AlertCircle, XOctagon } from 'lucide-react';
import { cn } from '../lib/utils';

interface HazardData {
  hazard_level: number;
  hazard_type: string;
  haptic_pattern: string;
  auto_notify: string;
  history_available: boolean;
  manual?: boolean;
}

interface SentinelCameraProps {
  onHazardReported: (hazard: HazardData) => void;
  className?: string;
}

export function SentinelCamera({ onHazardReported, className }: SentinelCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLive, setIsLive] = useState(false);
  const [sessionPromise, setSessionPromise] = useState<any>(null);
  const [currentHazard, setCurrentHazard] = useState<HazardData | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [focus, setFocus] = useState<number>(0);
  const [focusMode, setFocusMode] = useState<'continuous' | 'manual'>('continuous');
  const [showControls, setShowControls] = useState(false);
  const [showHapticSettings, setShowHapticSettings] = useState(false);
  const [showManualReport, setShowManualReport] = useState(false);
  const [selectedHazardType, setSelectedHazardType] = useState<string | null>(null);
  
  const [hazardAlert, setHazardAlert] = useState<{
    severity: 'awareness' | 'critical' | 'safe';
    message: string;
    type: string;
    id: number;
  } | null>(null);

  const playAlertSound = (severity: 'awareness' | 'critical') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (severity === 'awareness') {
        for(let i=0; i<4; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 800;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.25);
          gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + i * 0.25 + 0.05);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.25 + 0.2);
          osc.start(ctx.currentTime + i * 0.25);
          osc.stop(ctx.currentTime + i * 0.25 + 0.2);
        }
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 400;
        osc.type = 'square';
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.5);
      }
    } catch (e) { console.error(e); }
  };

  const getHazardIcon = (type: string) => {
    switch(type.toLowerCase()) {
      case 'road_work': return <Construction className="w-8 h-8" />;
      case 'traffic': return <Car className="w-8 h-8" />;
      case 'object': return <Package className="w-8 h-8" />;
      case 'road_closure': return <XOctagon className="w-8 h-8" />;
      case 'pothole': return <AlertCircle className="w-8 h-8" />;
      default: return <AlertTriangle className="w-8 h-8" />;
    }
  };
  
  // Haptic Settings State
  const [hapticSettings, setHapticSettings] = useState({
    enabled: true,
    lowHazard: 'short', // level 1-2
    medHazard: 'double', // level 3
    highHazard: 'long' // level 4-5
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: true 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      const track = stream.getVideoTracks()[0];
      setVideoTrack(track);
      
      if (track.getCapabilities) {
        const caps = track.getCapabilities();
        setCapabilities(caps);
        const settings = track.getSettings();
        if (settings.zoom) setZoom(settings.zoom);
        if (settings.focusDistance) setFocus(settings.focusDistance);
        if (settings.focusMode) setFocusMode(settings.focusMode as any);
      }
      
      return stream;
    } catch (err) {
      console.error("Error accessing camera/mic:", err);
      return null;
    }
  };

  const connectLiveAPI = async () => {
    if (isLive) return;
    
    const stream = await startCamera();
    if (!stream) return;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    nextPlayTimeRef.current = audioContextRef.current.currentTime;

    const reportHazardTool = {
      functionDeclarations: [{
        name: "reportHazard",
        description: "Report a driving hazard, safety score, or historical fact data trigger.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            hazard_level: { type: Type.INTEGER, description: "0-5" },
            hazard_type: { type: Type.STRING, description: "none/pothole/object/road_work/road_closure/traffic/accident" },
            haptic_pattern: { type: Type.STRING, description: "short/double/long/none" },
            auto_notify: { type: Type.STRING, description: "Short text for dashboard" },
            history_available: { type: Type.BOOLEAN }
          },
          required: ["hazard_level", "hazard_type", "haptic_pattern", "auto_notify", "history_available"]
        }
      }]
    };

    try {
      const promise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {
            setIsLive(true);
            // Start sending video frames
            const intervalId = setInterval(() => {
              if (!videoRef.current || !canvasRef.current) return;
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              
              canvas.width = videoRef.current.videoWidth || 640;
              canvas.height = videoRef.current.videoHeight || 480;
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              
              const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
              
              promise.then((session: any) => {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'image/jpeg' }
                });
              });
            }, 2000); // Send frame every 2 seconds
            
            // Store interval to clear later
            (promise as any)._intervalId = intervalId;
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const binaryString = atob(base64Audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Decode PCM 16-bit 24kHz
              const audioBuffer = audioContextRef.current.createBuffer(1, bytes.length / 2, 24000);
              const channelData = audioBuffer.getChannelData(0);
              const dataView = new DataView(bytes.buffer);
              for (let i = 0; i < bytes.length / 2; i++) {
                channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
              }
              
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current.destination);
              
              const playTime = Math.max(audioContextRef.current.currentTime, nextPlayTimeRef.current);
              source.start(playTime);
              nextPlayTimeRef.current = playTime + audioBuffer.duration;
            }
            
            // Handle interruption
            if (message.serverContent?.interrupted) {
              nextPlayTimeRef.current = audioContextRef.current?.currentTime || 0;
            }
            
            // Handle tool calls
            const toolCall = message.toolCall;
            if (toolCall) {
              const calls = toolCall.functionCalls;
              if (calls) {
                for (const call of calls) {
                  if (call.name === 'reportHazard') {
                    const args = call.args as unknown as HazardData;
                    setCurrentHazard(args);
                    onHazardReported(args);
                    
                    let severity: 'awareness' | 'critical' | 'safe' = 'safe';
                    let msg = args.auto_notify;

                    if (args.hazard_level >= 4) {
                      severity = 'critical';
                      msg = "Stop ahead, be aware";
                      if ('vibrate' in navigator && hapticSettings.enabled) navigator.vibrate([1000]);
                      playAlertSound('critical');
                      const utterance = new SpeechSynthesisUtterance(msg);
                      window.speechSynthesis.speak(utterance);
                    } else if (args.hazard_level > 0) {
                      severity = 'awareness';
                      msg = "Proceed with caution";
                      if ('vibrate' in navigator && hapticSettings.enabled) navigator.vibrate([100, 100, 100, 100, 100, 100, 100]);
                      playAlertSound('awareness');
                      const utterance = new SpeechSynthesisUtterance(msg);
                      window.speechSynthesis.speak(utterance);
                    }
                    
                    setHazardAlert({ severity, message: msg, type: args.hazard_type, id: Date.now() });
                    
                    // Send tool response
                    promise.then((session: any) => {
                      session.sendToolResponse({
                        functionResponses: [{
                          id: call.id,
                          name: call.name,
                          response: { result: "Hazard reported successfully." }
                        }]
                      });
                    });
                  }
                }
              }
            }
          },
          onerror: (err) => console.error("Live API Error:", err),
          onclose: () => {
            setIsLive(false);
            if ((promise as any)._intervalId) {
              clearInterval((promise as any)._intervalId);
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are the "SentinelDrive" AI Co-pilot. Process live video/GPS to act as a safety sentry and historian.
1. SAFETY: If hazard_level > 3, suppress history. Alert immediately.
2. HISTORIAN: Only trigger when speed is steady and hazard is 0.
3. ZEN: Reward smooth driving ("Safe maneuver detected").
ALWAYS call the reportHazard tool to provide the structured data, and use your voice to provide the concise verbal alert or historical fact.`,
          tools: [reportHazardTool]
        }
      });
      
      setSessionPromise(promise);
    } catch (err) {
      console.error("Failed to connect Live API:", err);
    }
  };

  const disconnectLiveAPI = () => {
    if (sessionPromise) {
      sessionPromise.then((session: any) => {
        session.close();
        if ((sessionPromise as any)._intervalId) {
          clearInterval((sessionPromise as any)._intervalId);
        }
      });
      setSessionPromise(null);
    }
    setIsLive(false);
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      disconnectLiveAPI();
    };
  }, []);

  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({ advanced: [{ zoom: newZoom }] } as any);
      } catch (err) {
        console.error("Failed to apply zoom:", err);
      }
    }
  };

  const handleFocusChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFocus = parseFloat(e.target.value);
    setFocus(newFocus);
    setFocusMode('manual');
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance: newFocus }] } as any);
      } catch (err) {
        console.error("Failed to apply focus:", err);
      }
    }
  };

  const toggleFocusMode = async () => {
    const newMode = focusMode === 'continuous' ? 'manual' : 'continuous';
    setFocusMode(newMode);
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({ advanced: [{ focusMode: newMode }] } as any);
      } catch (err) {
        console.error("Failed to apply focus mode:", err);
      }
    }
  };

  return (
    <div className={cn("relative overflow-hidden bg-black", className)}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover"
      />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Overlay UI */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
          <div className={cn(
            "px-3 py-1.5 rounded-full text-xs font-mono font-medium flex items-center gap-2 backdrop-blur-md",
            isLive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/10 text-white/70 border border-white/10"
          )}>
            <div className={cn("w-2 h-2 rounded-full", isLive ? "bg-emerald-400 animate-pulse" : "bg-white/40")} />
            {isLive ? "SENTINEL ACTIVE" : "SENTINEL STANDBY"}
          </div>
          
          {currentHazard && currentHazard.hazard_level > 0 && (
            <div className={cn(
              "px-3 py-1.5 rounded-full text-xs font-mono font-medium flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2",
              currentHazard.hazard_level > 3 ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            )}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {currentHazard.hazard_type.toUpperCase()}
            </div>
          )}
          
          {capabilities && (capabilities.zoom || capabilities.focusDistance) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowHapticSettings(!showHapticSettings); setShowControls(false); }}
                className={cn(
                  "p-2 rounded-full backdrop-blur-md transition-all border",
                  showHapticSettings ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-white/10 text-white/70 border-white/10 hover:bg-white/20"
                )}
              >
                <Vibrate className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowControls(!showControls); setShowHapticSettings(false); }}
                className={cn(
                  "p-2 rounded-full backdrop-blur-md transition-all border",
                  showControls ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-white/10 text-white/70 border-white/10 hover:bg-white/20"
                )}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Haptic Settings Panel */}
        {showHapticSettings && (
          <div className="absolute top-16 right-4 w-72 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 z-50">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-medium text-sm">
                <Vibrate className="w-4 h-4 text-indigo-400" />
                Haptic Feedback
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={hapticSettings.enabled}
                  onChange={(e) => setHapticSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                />
                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>

            <div className={cn("space-y-4", !hapticSettings.enabled && "opacity-50 pointer-events-none")}>
              <div className="space-y-2">
                <div className="text-xs text-zinc-400 flex justify-between">
                  <span>Low Hazard (Level 1-2)</span>
                </div>
                <select 
                  value={hapticSettings.lowHazard}
                  onChange={(e) => setHapticSettings(prev => ({ ...prev, lowHazard: e.target.value }))}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="none">None</option>
                  <option value="short">Short Pulse</option>
                  <option value="double">Double Pulse</option>
                  <option value="long">Long Pulse</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-zinc-400 flex justify-between">
                  <span>Medium Hazard (Level 3)</span>
                </div>
                <select 
                  value={hapticSettings.medHazard}
                  onChange={(e) => setHapticSettings(prev => ({ ...prev, medHazard: e.target.value }))}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="none">None</option>
                  <option value="short">Short Pulse</option>
                  <option value="double">Double Pulse</option>
                  <option value="long">Long Pulse</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-zinc-400 flex justify-between">
                  <span>High Hazard (Level 4-5)</span>
                </div>
                <select 
                  value={hapticSettings.highHazard}
                  onChange={(e) => setHapticSettings(prev => ({ ...prev, highHazard: e.target.value }))}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-red-500"
                >
                  <option value="none">None</option>
                  <option value="short">Short Pulse</option>
                  <option value="double">Double Pulse</option>
                  <option value="long">Long Pulse</option>
                </select>
              </div>
              
              <button 
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                }}
                className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-zinc-300 transition-colors flex items-center justify-center gap-2"
              >
                <Settings2 className="w-3 h-3" />
                Test Pattern
              </button>
            </div>
          </div>
        )}

        {/* Camera Controls Panel */}
        {showControls && capabilities && (
          <div className="absolute top-16 right-4 w-64 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
            {capabilities.zoom && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Zoom</span>
                  <span className="font-mono">{zoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={capabilities.zoom.min || 1}
                  max={capabilities.zoom.max || 5}
                  step={capabilities.zoom.step || 0.1}
                  value={zoom}
                  onChange={handleZoomChange}
                  className="w-full accent-indigo-500"
                />
              </div>
            )}
            
            {capabilities.focusDistance && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Focus className="w-3 h-3" /> Focus
                  </span>
                  <button 
                    onClick={toggleFocusMode}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider",
                      focusMode === 'continuous' ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"
                    )}
                  >
                    {focusMode === 'continuous' ? 'Auto' : 'Manual'}
                  </button>
                </div>
                <input
                  type="range"
                  min={capabilities.focusDistance.min || 0}
                  max={capabilities.focusDistance.max || 10}
                  step={capabilities.focusDistance.step || 0.1}
                  value={focus}
                  onChange={handleFocusChange}
                  disabled={focusMode === 'continuous'}
                  className="w-full accent-indigo-500 disabled:opacity-50"
                />
              </div>
            )}
          </div>
        )}

        {/* Hazard Screen Border Overlay */}
        {hazardAlert && hazardAlert.severity !== 'safe' && (
          <div 
            key={hazardAlert.id}
            className={cn(
              "absolute inset-0 pointer-events-none z-40",
              hazardAlert.severity === 'critical' 
                ? "border-[16px] border-red-600 bg-red-600/10 shadow-[inset_0_0_100px_rgba(220,38,38,0.8)] animate-[blink-1_1s_ease-in-out_1_forwards]" 
                : "border-[16px] border-yellow-500 bg-yellow-500/10 shadow-[inset_0_0_100px_rgba(234,179,8,0.8)] animate-[blink-4_0.5s_ease-in-out_4]"
            )} 
          />
        )}

        {/* Status Bar / Hazard Indicator */}
        <div className="absolute bottom-72 left-0 right-0 p-6 pointer-events-none z-50 flex justify-center">
          <div className={cn(
            "flex items-center justify-between pointer-events-auto w-full max-w-3xl rounded-2xl p-4 backdrop-blur-xl border shadow-2xl transition-all duration-500",
            hazardAlert?.severity === 'critical' ? "bg-red-950/90 border-red-500/50" : 
            hazardAlert?.severity === 'awareness' ? "bg-yellow-950/90 border-yellow-500/50" : 
            "bg-zinc-950/80 border-white/10"
          )}>
            <div className="flex items-center gap-6">
              <button
                onClick={isLive ? disconnectLiveAPI : connectLiveAPI}
                className={cn(
                  "p-4 rounded-full transition-all shadow-lg shrink-0",
                  isLive ? "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20" : "bg-white text-black hover:bg-zinc-200"
                )}
              >
                {isLive ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              <div className="flex flex-col">
                {hazardAlert && hazardAlert.severity !== 'safe' ? (
                  <>
                    <div className={cn(
                      "text-2xl font-bold uppercase tracking-wider flex items-center gap-3",
                      hazardAlert.severity === 'critical' ? "text-red-400" : "text-yellow-400"
                    )}>
                      {getHazardIcon(hazardAlert.type)}
                      {hazardAlert.type.replace('_', ' ')}
                    </div>
                    <div className="text-lg font-medium text-white/90 mt-1">
                      {hazardAlert.message}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-medium text-white drop-shadow-md">
                      {isLive ? "Monitoring road conditions..." : "System Standby"}
                    </div>
                    {currentHazard && currentHazard.hazard_level === 0 && (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium mt-1">
                        <ShieldCheck className="w-4 h-4" />
                        SAFE MANEUVER DETECTED
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowManualReport(true)}
              className="px-4 py-3 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2 border border-white/10 shadow-lg"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Report</span>
            </button>
          </div>
        </div>

        {/* Manual Report Modal */}
        {showManualReport && (
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
                    onClick={() => setShowManualReport(false)}
                    className="mt-6 w-full py-3 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-semibold text-white mb-2">Confirm Report</h3>
                  <p className="text-zinc-400 mb-6">
                    Are you sure you want to report <span className="text-white font-medium capitalize">{selectedHazardType.replace('_', ' ')}</span> to the community?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedHazardType(null)}
                      className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        onHazardReported({
                          hazard_level: 3,
                          hazard_type: selectedHazardType,
                          haptic_pattern: 'short',
                          auto_notify: `Manual report: ${selectedHazardType.replace('_', ' ')}`,
                          history_available: true,
                          manual: true
                        });
                        setShowManualReport(false);
                        setSelectedHazardType(null);
                        
                        if ('vibrate' in navigator && hapticSettings.enabled) navigator.vibrate(50);
                      }}
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

        <style>{`
          @keyframes blink-4 {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          @keyframes blink-1 {
            0% { opacity: 0; }
            50% { opacity: 1; }
            100% { opacity: 1; }
          }
        `}</style>
      </div>
  );
}
