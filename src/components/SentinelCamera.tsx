import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { Camera, Mic, MicOff, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

interface HazardData {
  hazard_level: number;
  hazard_type: string;
  haptic_pattern: string;
  auto_notify: string;
  history_available: boolean;
}

interface SentinelCameraProps {
  onHazardReported: (hazard: HazardData) => void;
}

export function SentinelCamera({ onHazardReported }: SentinelCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLive, setIsLive] = useState(false);
  const [sessionPromise, setSessionPromise] = useState<any>(null);
  const [currentHazard, setCurrentHazard] = useState<HazardData | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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
            hazard_type: { type: Type.STRING, description: "none/braking/object/police/accident" },
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

  return (
    <div className="flex flex-col gap-4">
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-white/10 shadow-lg">
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
        </div>

        {/* Status Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={isLive ? disconnectLiveAPI : connectLiveAPI}
                className={cn(
                  "p-3 rounded-full transition-all",
                  isLive ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {isLive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <div className="text-sm font-medium text-white/90">
                {currentHazard?.auto_notify || "Monitoring road conditions..."}
              </div>
            </div>
            
            {currentHazard && currentHazard.hazard_level === 0 && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                <ShieldCheck className="w-4 h-4" />
                SAFE
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
