import React, { useState } from 'react';
import ShotPutScene from './components/ShotPutScene';
import FaceTracker from './components/FaceTracker';
// import { powerToDistance } from './lib/expressionScore';

const App: React.FC = () => {
  const [power, setPower] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [gameState, setGameState] = useState<'idle' | 'throwing' | 'result'>('idle');

  const throwBall = () => {
    setGameState('throwing');
    setDistance(null); // Reset distance display
    // Simulate power calculation delay or just throw
    // Hammer throw distances are much longer (World Record ~86m)
    const p = Math.random() * 15 + 10; // 10 .. 25
    setPower(p);
  };

  const handleLand = (d: number) => {
    setDistance(d);
    setGameState('result');
  };

  const reset = () => {
    setPower(null);
    setDistance(null);
    setGameState('idle');
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Face Tracker Debug View */}
      <FaceTracker />

      {/* 3D Scene Background */}
      <div className="absolute inset-0 z-0">
        <ShotPutScene power={power} onLand={handleLand} />
      </div>

      {/* HUD Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Header */}
        <header className="flex justify-between items-start">
          <div className="bg-black/50 backdrop-blur-md p-4 rounded-xl border border-white/20 text-white">
            <h1 className="text-2xl font-bold tracking-wider uppercase text-yellow-400">Hammer Throw Pro</h1>
            <p className="text-xs text-gray-300">Face Tracking: <span className="text-red-400">OFFLINE</span></p>
          </div>
          
          {/* Score / Distance Display */}
          {distance !== null && (
             <div className="bg-black/70 backdrop-blur-md p-6 rounded-xl border-2 border-yellow-500 text-center animate-bounce-in">
                <div className="text-sm text-gray-400 uppercase tracking-widest">Distance</div>
                <div className="text-5xl font-black text-white font-mono">
                  {distance.toFixed(2)}<span className="text-2xl text-yellow-500 ml-1">m</span>
                </div>
             </div>
          )}
        </header>

        {/* Controls (Bottom) */}
        <footer className="flex justify-center items-end pb-8 pointer-events-auto">
          {gameState === 'idle' && (
            <button 
              onClick={throwBall}
              className="group relative px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xl uppercase tracking-widest rounded-full shadow-lg shadow-yellow-500/50 transition-all transform hover:scale-105 active:scale-95"
            >
              <span className="relative z-10">Throw!</span>
              <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
            </button>
          )}

          {gameState === 'result' && (
            <button 
              onClick={reset}
              className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold text-lg uppercase tracking-wider rounded-full border border-gray-600 shadow-lg transition-all"
            >
              Try Again
            </button>
          )}
          
          {gameState === 'throwing' && (
             <div className="text-white text-xl font-bold animate-pulse bg-black/50 px-6 py-2 rounded-full">
               Throwing...
             </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default App;
