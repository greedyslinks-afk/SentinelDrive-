import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { Camera, Mic, MicOff, AlertTriangle, ShieldCheck, Activity, SlidersHorizontal, Focus, Vibrate, Settings2, Construction, Car, Package, AlertCircle, XOctagon, User, MoveHorizontal, SwitchCamera, Maximize2, Minimize2, Radar, Octagon, Train, Siren, GraduationCap, ArrowUp, Cone, Circle, Badge, ArrowRight, CarFront } from 'lucide-react';
import { cn } from '../lib/utils';
import { DriverPreferences, defaultPreferences } from './DriverProfile';

interface HazardData {
  hazard_level: number;
  hazard_type: string;
  haptic_pattern: string;
  auto_notify: string;
  history_available: boolean;
  manual?: boolean;
  lat?: number;
  lng?: number;
  bounding_box?: number[];
}

interface PredictionData {
  id: number;
  hazard_type: string;
  probability: number;
  time_to_hazard: number;
  reason: string;
  bounding_box?: number[];
}

interface SentinelCameraProps {
  onHazardReported: (hazard: HazardData) => void;
  hazards?: any[];
  currentLocation?: { lat: number, lng: number } | null;
  className?: string;
  driverPreferences?: DriverPreferences;
  onUpdatePreferences?: (prefs: DriverPreferences) => void;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}

export function SentinelCamera({ onHazardReported, hazards, currentLocation, className, driverPreferences, onUpdatePreferences }: SentinelCameraProps) {
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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isExpanded, setIsExpanded] = useState(false);
  const predictiveSensitivity = driverPreferences?.predictiveAlertSensitivity ?? 5;
  
  const [proximityAlert, setProximityAlert] = useState<{ message: string, id: number, type: string, distance: number } | null>(null);
  const [alertDistance, setAlertDistance] = useState(500); // meters
  const [showProximitySettings, setShowProximitySettings] = useState(false);
  const [enabledAlertTypes, setEnabledAlertTypes] = useState<string[]>([
    'pothole', 'object', 'road_work', 'road_closure', 'traffic', 'accident', 'pedestrian', 'animal', 'debris', 'lane_marker'
  ]);
  const alertedHazardsRef = useRef<Set<string>>(new Set());
  
  const [hazardAlert, setHazardAlert] = useState<{
    severity: 'awareness' | 'critical' | 'safe';
    message: string;
    type: string;
    id: number;
  } | null>(null);
  
  const [activeBoundingBox, setActiveBoundingBox] = useState<{
    box: number[];
    level: number;
    type: string;
  } | null>(null);
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [trafficSignal, setTrafficSignal] = useState<{ type: string, state: string, id: number } | null>(null);
  const [laneStatus, setLaneStatus] = useState<{
    left_marker?: number[];
    right_marker?: number[];
    deviation: 'none' | 'left' | 'right';
    id: number;
  } | null>(null);

  const playTrafficSound = (state: 'red' | 'yellow' | 'green' | 'stop_sign') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, startTime + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      if (state === 'green') {
        playBeep(800, now, 0.15); // 1 beep
      } else if (state === 'yellow') {
        playBeep(600, now, 0.15);
        playBeep(600, now + 0.25, 0.15); // 2 beeps
      } else if (state === 'red') {
        playBeep(400, now, 0.15);
        playBeep(400, now + 0.25, 0.15);
        playBeep(400, now + 0.5, 0.15); // 3 beeps
      } else if (state === 'stop_sign') {
        playBeep(300, now, 0.15);
        playBeep(300, now + 0.25, 0.15);
        playBeep(300, now + 0.5, 0.15); // 3 beeps
      }
    } catch (e) { console.error(e); }
  };

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
      case 'debris': return <Package className="w-8 h-8" />;
      case 'lane_marker': return <MoveHorizontal className="w-8 h-8" />;
      case 'lane_drift': return <MoveHorizontal className="w-8 h-8" />;
      case 'driver_fatigue': return <User className="w-8 h-8" />;
      case 'pedestrian': return <User className="w-8 h-8" />;
      case 'animal': return <AlertTriangle className="w-8 h-8" />;
      case 'stop_sign': return <Octagon className="w-8 h-8" />;
      case 'railroad_crossing': return <Train className="w-8 h-8" />;
      case 'brake_lights': return <CarFront className="w-8 h-8" />;
      case 'emergency_lights': return <Siren className="w-8 h-8" />;
      case 'school_zone': return <GraduationCap className="w-8 h-8" />;
      case 'construction_zone': return <Construction className="w-8 h-8" />;
      case 'school_crosswalk': return <User className="w-8 h-8" />;
      case 'traffic_ahead': return <Car className="w-8 h-8" />;
      case 'speed_bump': return <ArrowUp className="w-8 h-8" />;
      case 'traffic_cone': return <Cone className="w-8 h-8" />;
      case 'traffic_signal': return <Circle className="w-8 h-8" />;
      case 'traffic_police': return <Badge className="w-8 h-8" />;
      case 'detour_sign': return <ArrowRight className="w-8 h-8" />;
      default: return <AlertTriangle className="w-8 h-8" />;
    }
  };
  
  // Haptic Settings
  const hapticSettings = driverPreferences?.hapticSettings ?? defaultPreferences.hapticSettings;

  const updateHapticSettings = (newSettings: Partial<typeof hapticSettings>) => {
    if (onUpdatePreferences && driverPreferences) {
      onUpdatePreferences({
        ...driverPreferences,
        hapticSettings: {
          ...hapticSettings,
          ...newSettings
        }
      });
    }
  };

  const triggerHaptic = (patternName: string) => {
    if (!('vibrate' in navigator) || !hapticSettings.enabled || patternName === 'none') return;
    switch (patternName) {
      case 'short':
        navigator.vibrate([100]);
        break;
      case 'double':
        navigator.vibrate([100, 100, 100]);
        break;
      case 'long':
        navigator.vibrate([500]);
        break;
      default:
        break;
    }
  };

  const startCamera = async () => {
    try {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode,
          frameRate: { ideal: 15, max: 30 }
        }, 
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
        const settings = track.getSettings() as any;
        if (settings.zoom) setZoom(settings.zoom);
        if (settings.focusDistance) setFocus(settings.focusDistance);
        if (settings.focusMode) setFocusMode(settings.focusMode);
      }
      
      return stream;
    } catch (err) {
      console.error("Error accessing camera/mic:", err);
      alert("Camera or Microphone permission denied. Please enable them in your browser settings to use the Sentinel Live API.");
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
            hazard_type: { type: Type.STRING, description: "none/pothole/object/road_work/road_closure/traffic/accident/lane_drift/driver_fatigue/pedestrian/animal/traffic_cone/debris/lane_marker/stop_sign/railroad_crossing/brake_lights/emergency_lights/school_zone/construction_zone/school_crosswalk/traffic_ahead/speed_bump/traffic_signal/traffic_police/detour_sign" },
            haptic_pattern: { type: Type.STRING, description: "short/double/long/none" },
            auto_notify: { type: Type.STRING, description: "Short text for dashboard" },
            history_available: { type: Type.BOOLEAN },
            bounding_box: { 
              type: Type.ARRAY, 
              items: { type: Type.INTEGER },
              description: "Optional. If hazard is visible in the video, provide its [ymin, xmin, ymax, xmax] coordinates normalized to 0-1000."
            }
          },
          required: ["hazard_level", "hazard_type", "haptic_pattern", "auto_notify", "history_available"]
        }
      }]
    };

    const predictHazardTool = {
      functionDeclarations: [{
        name: "predictHazard",
        description: "Predict a potential hazard that might occur in the next 5-10 seconds based on current context.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            hazard_type: { type: Type.STRING, description: "Type of predicted hazard (e.g., pedestrian_crossing, sudden_braking, lane_intrusion, stop_sign, railroad_crossing, brake_lights, emergency_lights, school_zone, construction_zone, school_crosswalk, traffic_ahead, speed_bump, traffic_cone, traffic_signal, traffic_police, detour_sign)" },
            probability: { type: Type.INTEGER, description: "Probability of occurrence (0-100)" },
            time_to_hazard: { type: Type.INTEGER, description: "Estimated time until hazard in seconds (e.g., 5)" },
            reason: { type: Type.STRING, description: "Brief reason for prediction" },
            bounding_box: { 
              type: Type.ARRAY, 
              items: { type: Type.INTEGER },
              description: "Optional. [ymin, xmin, ymax, xmax] normalized to 0-1000 of the object causing the prediction."
            }
          },
          required: ["hazard_type", "probability", "time_to_hazard", "reason"]
        }
      }]
    };

    const reportTrafficSignalTool = {
      functionDeclarations: [{
        name: "reportTrafficSignal",
        description: "Report the status of a traffic light or stop sign in the vehicle's path.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            signal_type: { type: Type.STRING, description: "'traffic_light' or 'stop_sign'" },
            state: { type: Type.STRING, description: "'red', 'yellow', 'green', or 'none' (for stop signs)" }
          },
          required: ["signal_type", "state"]
        }
      }]
    };

    const reportLaneStatusTool = {
      functionDeclarations: [{
        name: "reportLaneStatus",
        description: "Report the current lane markers and any deviation from the lane.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            left_marker: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Optional. [ymin, xmin, ymax, xmax] normalized to 0-1000 of the left lane marker."
            },
            right_marker: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Optional. [ymin, xmin, ymax, xmax] normalized to 0-1000 of the right lane marker."
            },
            deviation: {
              type: Type.STRING,
              description: "'none', 'left', or 'right' indicating if the vehicle is drifting out of the lane."
            }
          },
          required: ["deviation"]
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
            }, 1000); // Send frame every 1 second for better real-time responsiveness
            
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
                      triggerHaptic(hapticSettings.highHazard);
                      playAlertSound('critical');
                      const utterance = new SpeechSynthesisUtterance(msg);
                      window.speechSynthesis.speak(utterance);
                    } else if (args.hazard_level === 3) {
                      severity = 'awareness';
                      msg = "Proceed with caution";
                      triggerHaptic(hapticSettings.medHazard);
                      playAlertSound('awareness');
                      const utterance = new SpeechSynthesisUtterance(msg);
                      window.speechSynthesis.speak(utterance);
                    } else if (args.hazard_level > 0) {
                      severity = 'awareness';
                      msg = "Proceed with caution";
                      triggerHaptic(hapticSettings.lowHazard);
                      playAlertSound('awareness');
                      const utterance = new SpeechSynthesisUtterance(msg);
                      window.speechSynthesis.speak(utterance);
                    }
                    
                    const alertId = Date.now();
                    setHazardAlert({ severity, message: msg, type: args.hazard_type, id: alertId });
                    
                    if (severity !== 'safe') {
                      setTimeout(() => {
                        setHazardAlert(prev => {
                          if (prev?.id === alertId) {
                            return { severity: 'safe', message: 'System Standby', type: 'none', id: Date.now() };
                          }
                          return prev;
                        });
                      }, 5000);
                    }
                    
                    if (args.bounding_box && args.bounding_box.length === 4) {
                      setActiveBoundingBox({
                        box: args.bounding_box,
                        level: args.hazard_level,
                        type: args.hazard_type
                      });
                      setTimeout(() => {
                        setActiveBoundingBox(prev => {
                          // Only clear if it's the exact same array reference
                          if (prev?.box === args.bounding_box) return null;
                          return prev;
                        });
                      }, 5000);
                    } else {
                      setActiveBoundingBox(null);
                    }
                    
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
                  } else if (call.name === 'predictHazard') {
                    const args = call.args as unknown as Omit<PredictionData, 'id'>;
                    const predId = Date.now();
                    setPredictions(prev => [...prev, { ...args, id: predId }]);

                    // Remove prediction after time_to_hazard + 2 seconds
                    setTimeout(() => {
                      setPredictions(prev => prev.filter(p => p.id !== predId));
                    }, (args.time_to_hazard + 2) * 1000);

                    promise.then((session: any) => {
                      session.sendToolResponse({
                        functionResponses: [{
                          id: call.id,
                          name: call.name,
                          response: { result: "Prediction logged and displayed." }
                        }]
                      });
                    });
                  } else if (call.name === 'reportTrafficSignal') {
                    const args = call.args as any;
                    setTrafficSignal({ type: args.signal_type, state: args.state, id: Date.now() });
                    
                    if (args.signal_type === 'stop_sign' || args.state === 'red' || args.state === 'yellow') {
                      playTrafficSound(args.signal_type === 'stop_sign' ? 'stop_sign' : args.state);
                    }
                    
                    setTimeout(() => {
                      setTrafficSignal(null);
                    }, 5000);

                    promise.then((session: any) => {
                      session.sendToolResponse({
                        functionResponses: [{
                          id: call.id,
                          name: call.name,
                          response: { result: "Traffic signal reported and displayed." }
                        }]
                      });
                    });
                  } else if (call.name === 'reportLaneStatus') {
                    const args = call.args as any;
                    setLaneStatus({
                      left_marker: args.left_marker,
                      right_marker: args.right_marker,
                      deviation: args.deviation,
                      id: Date.now()
                    });
                    
                    if (args.deviation !== 'none') {
                      playAlertSound('awareness');
                      if ('vibrate' in navigator && hapticSettings.enabled) navigator.vibrate([200, 100, 200]);
                    }

                    setTimeout(() => {
                      setLaneStatus(prev => {
                        if (prev?.id === args.id) return null;
                        return prev;
                      });
                    }, 3000);

                    promise.then((session: any) => {
                      session.sendToolResponse({
                        functionResponses: [{
                          id: call.id,
                          name: call.name,
                          response: { result: "Lane status reported." }
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
4. GRANULAR ANALYSIS: Actively monitor the video feed for subtle hazards including lane drifts, signs of driver fatigue (if facing driver), pedestrians, animals, debris, potholes, and lane markers.
5. PREDICTIVE ANALYSIS: Anticipate potential hazards ${
  driverPreferences?.preferredSpeed === 'cautious' ? `${predictiveSensitivity + 3}-${predictiveSensitivity + 7}` : 
  driverPreferences?.preferredSpeed === 'brisk' ? `${Math.max(1, predictiveSensitivity - 2)}-${predictiveSensitivity + 2}` : `${predictiveSensitivity}-${predictiveSensitivity + 5}`
} seconds before they occur. If you see a pedestrian nearing the road, a car swerving, or traffic slowing down ahead, call the predictHazard tool to warn the driver early.
6. TRAFFIC SIGNALS & OBJECTS: Actively look for and alert the user (via reportHazard or reportTrafficSignal) when these objects appear in view: stop signs, railroad crossings, brake lights, emergency vehicle lights, school zones, construction zones, school crosswalks, traffic ahead, speed bumps, traffic cones, traffic signals, traffic police, and detour signs.
7. LANE KEEPING: Actively monitor lane markers. Call the reportLaneStatus tool frequently to report the coordinates of the left and right lane markers and any deviation ('none', 'left', or 'right').
8. ENVIRONMENT AWARENESS: Distinguish between street and highway driving based on visual cues (number of lanes, speed limits, presence of intersections/pedestrians). Adjust your hazard sensitivity accordingly (e.g., higher speeds on highways require earlier warnings for traffic ahead).
9. LOCAL LAWS: Apply your knowledge of the state's driving laws in the USA based on the user's location. ${currentLocation ? `The user is currently near coordinates ${currentLocation.lat}, ${currentLocation.lng}. Infer the US state and apply its specific traffic laws (e.g., right-on-red rules, school zone speed limits, move-over laws for emergency vehicles).` : `Apply general US driving laws and infer the state from visual cues if possible.`}
10. HANDS-FREE OPERATION: Manual reporting is disabled for legal and safety reasons. You are solely responsible for identifying hazards, marking their location, and posting them to the community hazards tracker via the reportHazard tool. Do not ask the user to touch the screen.
ALWAYS call the reportHazard, predictHazard, reportTrafficSignal, or reportLaneStatus tools to provide structured data, and use your voice to provide concise verbal alerts.
${driverPreferences?.name ? `\nPersonalize your responses occasionally by addressing the driver as ${driverPreferences.name}.` : ''}`,
          tools: [reportHazardTool, predictHazardTool, reportTrafficSignalTool, reportLaneStatusTool]
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

  useEffect(() => {
    if (!currentLocation || !hazards || hazards.length === 0) return;

    const nearbyHazards = hazards.filter(h => {
      if (!h.lat || !h.lng || alertedHazardsRef.current.has(h.id)) return false;
      if (!enabledAlertTypes.includes(h.hazard_type)) return false;
      
      // Ignore hazards reported less than 30 seconds ago (assume they are local to user)
      const isRecent = (new Date().getTime() - new Date(h.timestamp).getTime()) < 30000;
      if (isRecent) {
        alertedHazardsRef.current.add(h.id);
        return false;
      }

      const dist = getDistance(currentLocation.lat, currentLocation.lng, h.lat, h.lng);
      return dist <= alertDistance;
    });

    if (nearbyHazards.length > 0) {
      const hazard = nearbyHazards[0];
      alertedHazardsRef.current.add(hazard.id);
      
      // Trigger distinct alert
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        [0, 0.2].forEach(delay => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 600;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0, ctx.currentTime + delay);
          gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + delay + 0.05);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.3);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.3);
        });
      } catch (e) {}

      if ('vibrate' in navigator && hapticSettings.enabled) {
        navigator.vibrate([200, 100, 200]);
      }

      const distStr = Math.round(getDistance(currentLocation.lat, currentLocation.lng, hazard.lat, hazard.lng));

      setProximityAlert({
        message: `Approaching reported ${hazard.hazard_type.replace('_', ' ')}`,
        distance: distStr,
        type: hazard.hazard_type,
        id: Date.now()
      });

      setTimeout(() => setProximityAlert(null), 8000);
    }
  }, [currentLocation, hazards, alertDistance, hapticSettings.enabled]);

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

  const toggleCamera = async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    if (isLive) {
      // If live, we need to restart the camera stream without disconnecting the AI session
      // But the easiest way is to just restart the camera and update the video ref
      try {
        if (videoRef.current?.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: newMode,
            frameRate: { ideal: 15, max: 30 }
          }, 
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
          const settings = track.getSettings() as any;
          if (settings.zoom) setZoom(settings.zoom);
          if (settings.focusDistance) setFocus(settings.focusDistance);
          if (settings.focusMode) setFocusMode(settings.focusMode);
        }
      } catch (err) {
        console.error("Error switching camera:", err);
      }
    }
  };

  return (
    <div className={cn(
      "relative overflow-hidden bg-black transition-all duration-500 ease-in-out",
      isExpanded ? "fixed inset-0 z-[100]" : "absolute inset-0 z-0",
      className
    )}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className={cn("w-full h-full object-cover", facingMode === 'user' && "scale-x-[-1]", !isLive && "opacity-0")}
      />
      
      {!isLive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500">
          <Camera className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium opacity-50">Camera Standby</p>
          <p className="text-sm opacity-40 mt-2 max-w-xs text-center">Tap the microphone icon to activate Sentinel Live monitoring</p>
        </div>
      )}
      
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
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-full backdrop-blur-md transition-all border bg-white/10 text-white/70 border-white/10 hover:bg-white/20"
              title={isExpanded ? "Minimize" : "Maximize"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleCamera}
              className="p-2 rounded-full backdrop-blur-md transition-all border bg-white/10 text-white/70 border-white/10 hover:bg-white/20"
              title="Switch Camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
            {capabilities && (capabilities.zoom || capabilities.focusDistance) && (
              <>
                <button
                  onClick={() => { setShowProximitySettings(!showProximitySettings); setShowHapticSettings(false); setShowControls(false); }}
                  className={cn(
                    "p-2 rounded-full backdrop-blur-md transition-all border",
                    showProximitySettings ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-white/10 text-white/70 border-white/10 hover:bg-white/20"
                  )}
                  title="Proximity Alerts"
                >
                  <Radar className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setShowHapticSettings(!showHapticSettings); setShowProximitySettings(false); setShowControls(false); }}
                  className={cn(
                    "p-2 rounded-full backdrop-blur-md transition-all border",
                    showHapticSettings ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-white/10 text-white/70 border-white/10 hover:bg-white/20"
                  )}
                >
                  <Vibrate className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setShowControls(!showControls); setShowHapticSettings(false); setShowProximitySettings(false); }}
                  className={cn(
                    "p-2 rounded-full backdrop-blur-md transition-all border",
                    showControls ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-white/10 text-white/70 border-white/10 hover:bg-white/20"
                  )}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Proximity Settings Panel */}
        {showProximitySettings && (
          <div className="absolute top-16 right-4 w-72 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 z-50">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-medium text-sm">
                <Radar className="w-4 h-4 text-indigo-400" />
                Proximity Alerts
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Alert Distance</span>
                  <span className="font-mono">{alertDistance}m</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={alertDistance}
                  onChange={(e) => setAlertDistance(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              
              <div className="pt-3 border-t border-white/10">
                <div className="text-xs text-zinc-400 mb-3">Alert Types</div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {[
                    { id: 'pothole', label: 'Pothole' },
                    { id: 'object', label: 'Object on Road' },
                    { id: 'road_work', label: 'Road Work' },
                    { id: 'road_closure', label: 'Road Closure' },
                    { id: 'traffic', label: 'Traffic' },
                    { id: 'accident', label: 'Accident' },
                    { id: 'pedestrian', label: 'Pedestrian' },
                    { id: 'animal', label: 'Animal' },
                    { id: 'debris', label: 'Debris' },
                    { id: 'lane_marker', label: 'Lane Marker' }
                  ].map(type => (
                    <label key={type.id} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">{type.label}</span>
                      <div className="relative inline-flex items-center">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={enabledAlertTypes.includes(type.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEnabledAlertTypes(prev => [...prev, type.id]);
                            } else {
                              setEnabledAlertTypes(prev => prev.filter(t => t !== type.id));
                            }
                          }}
                        />
                        <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
                  onChange={(e) => updateHapticSettings({ enabled: e.target.checked })}
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
                  onChange={(e) => updateHapticSettings({ lowHazard: e.target.value })}
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
                  onChange={(e) => updateHapticSettings({ medHazard: e.target.value })}
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
                  onChange={(e) => updateHapticSettings({ highHazard: e.target.value })}
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
            
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <Radar className="w-3 h-3" /> Predictive Alert Timing
                </span>
                <span className="font-mono">{predictiveSensitivity}s</span>
              </div>
              <input
                type="range"
                min="3"
                max="15"
                step="1"
                value={predictiveSensitivity}
                onChange={(e) => {
                  if (onUpdatePreferences && driverPreferences) {
                    onUpdatePreferences({ ...driverPreferences, predictiveAlertSensitivity: parseInt(e.target.value) });
                  }
                }}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>3s (Late)</span>
                <span>15s (Early)</span>
              </div>
            </div>
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

        {/* Critical Hazard Full-Screen Alert Overlay */}
        {hazardAlert?.severity === 'critical' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-300">
            <div className="bg-red-600/90 backdrop-blur-md border border-red-400 p-8 rounded-3xl shadow-[0_0_100px_rgba(220,38,38,0.8)] flex flex-col items-center text-center max-w-lg mx-4 animate-pulse">
              <AlertTriangle className="w-24 h-24 text-white mb-4" />
              <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2">
                {hazardAlert.type.replace('_', ' ')}
              </h2>
              <p className="text-xl text-red-100 font-medium">
                {hazardAlert.message}
              </p>
            </div>
          </div>
        )}

        {/* Hazard Bounding Box Overlay */}
        {activeBoundingBox && (
          <div
            className={cn(
              "absolute z-40 transition-all duration-300 pointer-events-none overflow-hidden",
              activeBoundingBox.level >= 4 
                ? "border-4 border-red-500 bg-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.8)] animate-pulse" 
                : activeBoundingBox.level === 3 
                  ? "border-4 border-orange-500 bg-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.6)]"
                  : "border-2 border-yellow-500 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.4)]"
            )}
            style={{
              top: `${(activeBoundingBox.box[0] / 1000) * 100}%`,
              left: `${(activeBoundingBox.box[1] / 1000) * 100}%`,
              height: `${((activeBoundingBox.box[2] - activeBoundingBox.box[0]) / 1000) * 100}%`,
              width: `${((activeBoundingBox.box[3] - activeBoundingBox.box[1]) / 1000) * 100}%`,
            }}
          >
            {/* Scanning line effect */}
            <div className={cn(
              "absolute left-0 right-0 h-1 opacity-50 animate-[scan_2s_ease-in-out_infinite]",
              activeBoundingBox.level >= 4 ? "bg-red-400 shadow-[0_0_15px_rgba(239,68,68,1)]" 
                : activeBoundingBox.level === 3 ? "bg-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.8)]"
                : "bg-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.8)]"
            )} />

            <div className={cn(
              "absolute -top-7 left-0 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap flex items-center gap-1",
              activeBoundingBox.level >= 4 ? "bg-red-600 text-sm scale-110 origin-bottom-left" 
                : activeBoundingBox.level === 3 ? "bg-orange-600"
                : "bg-yellow-600"
            )}>
              {activeBoundingBox.level >= 4 && <AlertTriangle className="w-4 h-4 animate-bounce" />}
              {activeBoundingBox.type.replace('_', ' ').toUpperCase()}
              <span className="opacity-75 ml-1">LVL {activeBoundingBox.level}</span>
            </div>
            
            {/* Corner brackets for tech feel */}
            <div className={cn("absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 -translate-x-1 -translate-y-1", activeBoundingBox.level >= 4 ? "border-red-400" : "border-white/50")} />
            <div className={cn("absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 translate-x-1 -translate-y-1", activeBoundingBox.level >= 4 ? "border-red-400" : "border-white/50")} />
            <div className={cn("absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 -translate-x-1 translate-y-1", activeBoundingBox.level >= 4 ? "border-red-400" : "border-white/50")} />
            <div className={cn("absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 translate-x-1 translate-y-1", activeBoundingBox.level >= 4 ? "border-red-400" : "border-white/50")} />
          </div>
        )}

        {/* Lane Markers Overlay */}
        {laneStatus && (
          <>
            {/* Left Marker */}
            {laneStatus.left_marker && laneStatus.left_marker.length === 4 && (
              <div
                className={cn(
                  "absolute z-30 border-l-4 transition-all duration-300 pointer-events-none",
                  laneStatus.deviation === 'left' ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse" : "border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                )}
                style={{
                  top: `${(laneStatus.left_marker[0] / 1000) * 100}%`,
                  left: `${(laneStatus.left_marker[1] / 1000) * 100}%`,
                  height: `${((laneStatus.left_marker[2] - laneStatus.left_marker[0]) / 1000) * 100}%`,
                  width: `${((laneStatus.left_marker[3] - laneStatus.left_marker[1]) / 1000) * 100}%`,
                }}
              />
            )}
            
            {/* Right Marker */}
            {laneStatus.right_marker && laneStatus.right_marker.length === 4 && (
              <div
                className={cn(
                  "absolute z-30 border-r-4 transition-all duration-300 pointer-events-none",
                  laneStatus.deviation === 'right' ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse" : "border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                )}
                style={{
                  top: `${(laneStatus.right_marker[0] / 1000) * 100}%`,
                  left: `${(laneStatus.right_marker[1] / 1000) * 100}%`,
                  height: `${((laneStatus.right_marker[2] - laneStatus.right_marker[0]) / 1000) * 100}%`,
                  width: `${((laneStatus.right_marker[3] - laneStatus.right_marker[1]) / 1000) * 100}%`,
                }}
              />
            )}

            {/* Deviation Warning */}
            {laneStatus.deviation !== 'none' && (
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in duration-300">
                <div className="bg-red-600/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl font-bold text-xl shadow-[0_0_30px_rgba(239,68,68,0.6)] flex items-center gap-3 border border-red-400/50">
                  <MoveHorizontal className="w-8 h-8 animate-pulse" />
                  LANE DEVIATION {laneStatus.deviation.toUpperCase()}
                </div>
              </div>
            )}
          </>
        )}

        {/* Predictive Hazard Bounding Boxes */}
        {predictions.filter(p => p.bounding_box && p.bounding_box.length === 4).map(pred => (
          <div
            key={`pred-box-${pred.id}`}
            className={cn(
              "absolute z-30 border-2 border-dashed transition-all duration-300 pointer-events-none overflow-hidden",
              pred.probability >= 80 
                ? "border-orange-500 bg-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.4)] animate-pulse" 
                : "border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            )}
            style={{
              top: `${(pred.bounding_box![0] / 1000) * 100}%`,
              left: `${(pred.bounding_box![1] / 1000) * 100}%`,
              height: `${((pred.bounding_box![2] - pred.bounding_box![0]) / 1000) * 100}%`,
              width: `${((pred.bounding_box![3] - pred.bounding_box![1]) / 1000) * 100}%`,
            }}
          >
            <div className={cn(
              "absolute top-0 left-0 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br whitespace-nowrap flex items-center gap-1",
              pred.probability >= 80 ? "bg-orange-600" : "bg-indigo-600"
            )}>
              <Radar className="w-3 h-3" />
              PREDICTING: {pred.hazard_type.replace('_', ' ').toUpperCase()} ({pred.probability}%) IN {pred.time_to_hazard}s
            </div>
          </div>
        ))}

        {/* Predictive Hazard List (No Bounding Box) */}
        <div className="absolute top-32 left-4 z-30 flex flex-col gap-2 pointer-events-none">
          {predictions.filter(p => !p.bounding_box || p.bounding_box.length !== 4).map(pred => (
            <div key={`pred-list-${pred.id}`} className={cn(
              "backdrop-blur-md rounded-lg p-3 shadow-lg max-w-xs animate-in slide-in-from-left-4 border",
              pred.probability >= 80 ? "bg-orange-900/80 border-orange-500/50" : "bg-indigo-900/80 border-indigo-500/50"
            )}>
              <div className={cn(
                "flex items-center gap-2 text-xs font-bold mb-1",
                pred.probability >= 80 ? "text-orange-300" : "text-indigo-300"
              )}>
                <Radar className="w-4 h-4 animate-pulse" />
                PREDICTION: {pred.time_to_hazard}s AHEAD
              </div>
              <div className="text-white text-sm font-medium">{pred.reason}</div>
              <div className="w-full bg-black/50 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className={cn("h-full", pred.probability >= 80 ? "bg-orange-500" : "bg-indigo-500")} style={{ width: `${pred.probability}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Proximity Alert Overlay */}
        {proximityAlert && (
          <div 
            key={`prox-${proximityAlert.id}`}
            className="absolute inset-0 pointer-events-none z-40 border-[8px] border-blue-500 bg-blue-500/10 shadow-[inset_0_0_80px_rgba(59,130,246,0.6)] animate-[blink-4_1s_ease-in-out_3]" 
          />
        )}

        {/* Proximity Alert Banner */}
        {proximityAlert && (
          <div className="absolute top-20 left-0 right-0 flex justify-center z-50 pointer-events-none animate-in fade-in slide-in-from-top-4">
            <div className="bg-blue-900/90 border border-blue-500/50 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-3 shadow-2xl shadow-blue-500/20">
              <Radar className="w-5 h-5 text-blue-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-blue-100 font-bold uppercase tracking-wider text-sm">{proximityAlert.message}</span>
                <span className="text-blue-300 text-xs font-medium">{proximityAlert.distance} meters ahead</span>
              </div>
            </div>
          </div>
        )}

        {/* Traffic Signal Overlay */}
        {trafficSignal && (
          <div className="absolute top-36 right-4 z-50 pointer-events-none animate-in fade-in slide-in-from-right-4">
            <div className="bg-zinc-900/90 border border-white/10 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center gap-3 shadow-2xl">
              {trafficSignal.type === 'stop_sign' ? (
                <div className="w-16 h-16 bg-red-600 flex items-center justify-center text-white font-bold text-xl border-4 border-white shadow-[0_0_15px_rgba(220,38,38,0.6)]" style={{ clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' }}>
                  STOP
                </div>
              ) : (
                <div className="w-12 h-32 bg-zinc-800 rounded-xl border-2 border-zinc-700 flex flex-col items-center justify-between py-2 shadow-lg">
                  <div className={cn("w-8 h-8 rounded-full transition-all duration-300", trafficSignal.state === 'red' ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]" : "bg-red-950/50")} />
                  <div className={cn("w-8 h-8 rounded-full transition-all duration-300", trafficSignal.state === 'yellow' ? "bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)]" : "bg-yellow-950/50")} />
                  <div className={cn("w-8 h-8 rounded-full transition-all duration-300", trafficSignal.state === 'green' ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]" : "bg-emerald-950/50")} />
                </div>
              )}
              <div className="text-white text-xs font-bold uppercase tracking-wider">
                {trafficSignal.type === 'stop_sign' ? 'STOP SIGN AHEAD' : `${trafficSignal.state} LIGHT`}
              </div>
            </div>
          </div>
        )}

        {/* Status Bar / Hazard Indicator */}
        <div className={cn(
          "absolute left-0 right-0 p-6 pointer-events-none z-50 flex justify-center transition-all duration-500",
          isExpanded ? "bottom-6" : "bottom-72"
        )}>
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
          </div>
        </div>

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
