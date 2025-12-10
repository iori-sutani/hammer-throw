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
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const isActiveRef = useRef(isActive);

  // Update ref when prop changes to use in closure
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

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
      refineLandmarks: true,
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

        // ログ出力（数値を見やすく整形）
        const info = `
Mouth: ${mouthOpen.toFixed(3)} -> Score: ${(mouthScore * 100).toFixed(0)}%
Eye:   ${eyeOpen.toFixed(3)} -> Score: ${(eyeScore * 100).toFixed(0)}%
Total: ${(totalScore * 100).toFixed(0)}%
        `.trim();
        
        setDebugInfo(info);
      } else {
        setDebugInfo('Face not detected');
        if (onScoreUpdate) onScoreUpdate(0);
      }
    });

    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          // isActiveRef.current が true の時だけ処理する
          if (webcamRef.current?.video && isActiveRef.current) {
            await faceMesh.send({ image: webcamRef.current.video });
          }
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }
  }, []);

  // 非アクティブ時は表示を薄くするなどのUI調整
  return (
    <div className={`absolute top-0 left-0 bg-black/80 text-white p-4 rounded m-4 z-50 font-mono text-sm pointer-events-auto transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-30'}`}>
      <h3 className="font-bold mb-2">Face Tracker {isActive ? '(Active)' : '(Paused)'}</h3>
      <div className="mb-4">
        <Webcam
          ref={webcamRef}
          style={{ width: 200, height: 150, transform: "scaleX(-1)" }} // 鏡のように反転
        />
      </div>
      <pre className="whitespace-pre-wrap">{debugInfo}</pre>
    </div>
  );
};

export default FaceTracker;