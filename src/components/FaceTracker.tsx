import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { FaceMesh, type Results } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

type Props = {
  onScoreUpdate?: (score: number) => void;
  isActive: boolean;
};

const FaceTracker: React.FC<Props> = ({ onScoreUpdate, isActive }) => {
  const webcamRef = useRef<Webcam>(null);
  // const [debugInfo, setDebugInfo] = useState<string>('Initializing...'); // Removed in favor of metrics
  const [metrics, setMetrics] = useState({ mouth: 0, eye: 0, total: 0 });
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const isActiveRef = useRef(isActive);
  const frameCountRef = useRef(0);

  // Update ref when prop changes to use in closure
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Snapshot Logic
  useEffect(() => {
    if (!isActive && !snapshot) {
        // Capture snapshot when becoming inactive (Throwing)
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) setSnapshot(imageSrc);
        }
    } else if (isActive && snapshot) {
        // Reset snapshot when becoming active again (Reset)
        setSnapshot(null);
    }
  }, [isActive, snapshot]);

  // 距離計算用のヘルパー関数
  const calculateDistance = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true, // Disabled for better performance
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results: Results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // ランドマークのインデックス
        // 上唇: 13, 下唇: 14
        // 左目 上: 159, 下: 145
        // 右目 上: 386, 下: 374
        // 顔の高さ（正規化用）: 10 (生え際) - 152 (顎)

        const topLip = landmarks[13];
        const bottomLip = landmarks[14];
        const leftEyeTop = landmarks[159];
        const leftEyeBottom = landmarks[145];
        const rightEyeTop = landmarks[386];
        const rightEyeBottom = landmarks[374];
        const faceTop = landmarks[10];
        const faceBottom = landmarks[152];

        // 顔の大きさ（高さ）で正規化して、カメラとの距離による誤差を減らす
        const faceHeight = calculateDistance(faceTop, faceBottom);

        // 口の開き具合 (0.0 ~ 0.5 くらい)
        const mouthOpen = calculateDistance(topLip, bottomLip) / faceHeight;

        // 目の開き具合 (0.0 ~ 0.04 くらい)
        const leftEyeOpen = calculateDistance(leftEyeTop, leftEyeBottom) / faceHeight;
        const rightEyeOpen = calculateDistance(rightEyeTop, rightEyeBottom) / faceHeight;
        const eyeOpen = (leftEyeOpen + rightEyeOpen) / 2;

        // スコア計算 (0.0 ~ 1.0 に正規化)
        // 口: 0.05以上で開き始め、0.3でMAXとする
        const mouthScore = Math.min(Math.max((mouthOpen - 0.05) / 0.25, 0), 1);
        
        // 目: 0.05以上で開き始め、0.10でMAXとする (極限までカッ開く)
        // ユーザー希望: Start 0.05, Max 0.10
        const eyeScore = Math.min(Math.max((eyeOpen - 0.05) / 0.05, 0), 1);

        // 総合スコア (口重視)
        const totalScore = (mouthScore * 0.7) + (eyeScore * 0.3);

        if (onScoreUpdate) {
            onScoreUpdate(totalScore);
        }

        setMetrics({
            mouth: mouthScore * 100,
            eye: eyeScore * 100,
            total: totalScore * 100
        });

      } else {
        // setDebugInfo('Face not detected');
        setMetrics({ mouth: 0, eye: 0, total: 0 });
        if (onScoreUpdate) onScoreUpdate(0);
      }
    });

    let camera: Camera | null = null;

    if (webcamRef.current && webcamRef.current.video) {
      camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          // Frame skipping: Process every 2nd frame for better performance
          frameCountRef.current++;
          if (frameCountRef.current % 2 !== 0) {
            return;
          }

          // isActiveRef.current が true の時だけ処理する
          if (webcamRef.current?.video && isActiveRef.current) {
            await faceMesh.send({ image: webcamRef.current.video });
          }
        },
        width: 320,
        height: 240,
      });
      camera.start();
    }

    // Cleanup function to stop camera and free resources
    return () => {
      if (camera) {
        camera.stop();
      }
      faceMesh.close();
    };
  }, []);

  return (
    <div className={`absolute z-50 transition-all duration-700 ease-in-out ${
      isActive 
        ? 'top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 scale-125 opacity-100' 
        : 'top-4 left-4 translate-x-0 translate-y-0 scale-90 origin-top-left ' + (snapshot ? 'opacity-100' : 'opacity-40')
    }`}>
        {/* Cut-in Effect (High Score) */}
        {isActive && metrics.total > 70 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] pointer-events-none z-[60]">
                <div className="relative flex flex-col items-center justify-center">
                    <div className="absolute inset-0 bg-red-500/30 blur-2xl rounded-full mix-blend-screen animate-pulse"></div>
                    <h2 className="relative text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-red-500 italic tracking-tighter drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] rotate-[-5deg] animate-[bounce_0.2s_infinite]"
                        style={{ filter: 'drop-shadow(0 0 10px rgba(255,0,0,0.5))' }}>
                        OVERDRIVE!!
                    </h2>
                    <div className="absolute -inset-10 border-y-4 border-yellow-400/30 rotate-[-5deg] animate-ping"></div>
                </div>
            </div>
        )}

        {/* Main Container */}
        <div className="relative bg-slate-900/90 border-2 border-yellow-500/50 rounded-xl p-3 shadow-[0_0_20px_rgba(234,179,8,0.2)] backdrop-blur-sm w-[280px] overflow-hidden">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${isActive ? 'bg-green-500 text-green-500 animate-pulse' : 'bg-red-500 text-red-500'}`}></div>
                    <span className="text-xs font-black text-white tracking-widest italic">FACE SYSTEM</span>
                </div>
                <span className="text-[10px] text-yellow-500 font-mono opacity-70">{isActive ? 'REC ●' : 'LOCKED'}</span>
            </div>

            {/* Camera View */}
            <div className="relative rounded-lg overflow-hidden border border-white/20 mb-4 bg-black aspect-video group">
                <Webcam
                    ref={webcamRef}
                    className="w-full h-full object-cover opacity-80"
                    style={{ transform: "scaleX(-1)" }}
                    videoConstraints={{ width: 320, height: 240 }}
                    screenshotFormat="image/jpeg"
                />
                
                {/* Snapshot Overlay */}
                {snapshot && (
                    <div className="absolute inset-0 z-10">
                        <img 
                            src={snapshot} 
                            alt="Face Snapshot" 
                            className="w-full h-full object-cover"
                            style={{ transform: "scaleX(-1)" }} 
                        />
                        {/* Freeze Effect Overlay */}
                        <div className="absolute inset-0 bg-white/10 animate-pulse mix-blend-overlay"></div>
                        <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded animate-pulse shadow-lg shadow-red-600/50">
                            FREEZE FRAME
                        </div>
                    </div>
                )}

                {/* Overlay Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
                
                {/* Face Target Frame (Decorative) */}
                <div className="absolute inset-4 border border-cyan-500/30 rounded-lg opacity-50 pointer-events-none">
                    <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400"></div>
                    <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-400"></div>
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-400"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400"></div>
                </div>
                
                {/* Scanning Text */}
                {!snapshot && (
                    <div className="absolute top-2 right-2 text-[10px] text-cyan-400 font-mono animate-pulse bg-black/50 px-1 rounded">
                        SCANNING...
                    </div>
                )}
            </div>

            {/* Metrics */}
            <div className="space-y-4">
                {/* Total Power */}
                <div>
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-sm font-black text-white italic tracking-wider">TOTAL POWER</span>
                        <span className={`text-3xl font-black font-mono tracking-tighter ${metrics.total > 80 ? 'text-red-500 animate-pulse' : metrics.total > 50 ? 'text-yellow-400' : 'text-cyan-400'}`}>
                            {metrics.total.toFixed(0)}<span className="text-sm ml-1 opacity-70">%</span>
                        </span>
                    </div>
                    <div className="h-6 bg-black/50 rounded-sm overflow-hidden border border-white/10 relative">
                        {/* Background Grid for Bar */}
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:10px_100%]"></div>
                        
                        <div 
                            className={`h-full transition-all duration-100 ease-out shadow-[0_0_15px_currentColor] ${metrics.total > 80 ? 'bg-gradient-to-r from-orange-600 to-red-600 text-red-500' : 'bg-gradient-to-r from-cyan-600 to-blue-500 text-cyan-500'}`}
                            style={{ width: `${metrics.total}%` }}
                        ></div>
                    </div>
                </div>

                {/* Details (Small) */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Mouth */}
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="flex justify-between text-[10px] text-gray-400 uppercase mb-1 font-bold">
                            <span>Mouth</span>
                            <span>{metrics.mouth.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500 transition-all duration-100" style={{ width: `${metrics.mouth}%` }}></div>
                        </div>
                    </div>
                    {/* Eye */}
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="flex justify-between text-[10px] text-gray-400 uppercase mb-1 font-bold">
                            <span>Eyes</span>
                            <span>{metrics.eye.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-pink-500 transition-all duration-100" style={{ width: `${metrics.eye}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default FaceTracker;