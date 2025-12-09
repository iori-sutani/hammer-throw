import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { FaceMesh, type Results } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

const FaceTracker: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');

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

        // 口の開き具合
        const mouthOpen = calculateDistance(topLip, bottomLip) / faceHeight;

        // 目の開き具合（左右平均）
        const leftEyeOpen = calculateDistance(leftEyeTop, leftEyeBottom) / faceHeight;
        const rightEyeOpen = calculateDistance(rightEyeTop, rightEyeBottom) / faceHeight;
        const eyeOpen = (leftEyeOpen + rightEyeOpen) / 2;

        // ログ出力（数値を見やすく整形）
        const info = `
Mouth Open: ${mouthOpen.toFixed(4)}
Eye Open:   ${eyeOpen.toFixed(4)}
        `.trim();
        
        setDebugInfo(info);
        // console.log(info); // コンソールがうるさくなるので一旦コメントアウト
      } else {
        setDebugInfo('Face not detected');
      }
    });

    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current?.video) {
            await faceMesh.send({ image: webcamRef.current.video });
          }
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }
  }, []);

  return (
    <div className="absolute top-0 left-0 bg-black/80 text-white p-4 rounded m-4 z-50 font-mono text-sm pointer-events-auto">
      <h3 className="font-bold mb-2">Face Tracker Debug</h3>
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