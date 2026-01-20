# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hammer Throw Pro is a browser-based 3D game where players use facial expressions (mouth opening, eye widening) captured via webcam to power a hammer throw. The game uses MediaPipe Face Mesh for real-time face tracking and Three.js for 3D rendering.

## Commands

```bash
npm run dev      # Start development server (Vite)
npm run build    # TypeScript check + production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Architecture

The codebase follows a decoupled Input → State → View architecture:

### Input Layer
- **FaceTracker** (`src/components/FaceTracker.tsx`): Uses MediaPipe Face Mesh to analyze 468 facial landmarks. Calculates normalized scores (0-1) for mouth openness and eye openness using landmark distances relative to face height. Outputs a combined `totalScore` (70% mouth, 30% eyes).

### State Management
- **App** (`src/App.tsx`): Central state manager with three game states: `idle`, `throwing`, `result`. Converts face score to throwing power (10-35 range) and coordinates between FaceTracker and ShotPutScene.

### View Layer
- **ShotPutScene** (`src/components/ShotPutScene.tsx`): Native Three.js implementation (not React Three Fiber) with manual animation loop. Handles 3D scene, physics simulation (gravity, bouncing), character animation (spinning throw), and camera following. Uses `useRef` for physics state to avoid re-renders during animation.
- **shotputBuilder** (`src/utils/shotputBuilder.ts`): Factory functions for Three.js objects (lighting, environment, mannequin character, hammer).

### Audio
- **useSoundEffects** (`src/hooks/useSoundEffects.ts`): Web Audio API hook managing three sound effects (charge, throw, land). Dynamically modulates playback rate and volume based on power level.

## Key Technical Details

- Camera processing only runs when `isActive` is true (idle state) to optimize performance
- Frame skipping: FaceTracker processes every 2nd frame
- Face score normalization: mouth (0.05-0.30 range), eyes (0.05-0.10 range)
- Physics uses projectile motion with 40-degree release angle
- Sound files expected at `/public/sounds/` (studiam.mp3, voice.mp3, land.mp3)
- TypeScript strict mode enabled with `noUnusedLocals` and `noUnusedParameters`
