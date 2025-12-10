import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { setupLighting, setupEnvironment, createMannequin, createHammer } from '../utils/shotputBuilder';

type Props = { 
  power: number | null;
  onLand?: (distance: number) => void;
  onThrow?: () => void;
};

const ShotPutScene: React.FC<Props> = ({ power, onLand, onThrow }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const hammerRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const onLandRef = useRef(onLand);
  const onThrowRef = useRef(onThrow);
  const characterRef = useRef<{ group: THREE.Group, rightArmGroup: THREE.Group, leftArmGroup: THREE.Group } | null>(null);

  // Update ref when prop changes
  useEffect(() => {
    onLandRef.current = onLand;
    onThrowRef.current = onThrow;
  }, [onLand, onThrow]);
  
  // Physics state
  const physicsState = useRef({
    pos: new THREE.Vector3(0, 2, 0),
    vel: new THREE.Vector3(0, 0, 0),
    rotVel: new THREE.Vector3(0, 0, 0), // Rotation velocity for hammer in air
    isFlying: false,
    hasLanded: false,
    firstBounce: false,
    isAnimatingThrow: false,
    throwStartTime: 0,
    throwPower: 0,
    spinSpeed: 0
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new THREE.Fog(0x87ceeb, 20, 100);

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 500);
    camera.position.set(-8, 5, 12); // Slightly further back
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // --- Lighting & Environment ---
    setupLighting(scene);
    setupEnvironment(scene);

    // --- Character (Mannequin) ---
    const mannequin = createMannequin();
    mannequin.group.position.set(0, 0, 0);
    // Initial pose for Hammer Throw (Arms extended forward/down)
    mannequin.group.rotation.y = Math.PI / 2; 
    mannequin.rightArmGroup.rotation.z = Math.PI / 4;
    mannequin.rightArmGroup.rotation.x = -Math.PI / 4;
    mannequin.leftArmGroup.rotation.z = -Math.PI / 4;
    mannequin.leftArmGroup.rotation.x = -Math.PI / 4;
    
    scene.add(mannequin.group);
    characterRef.current = mannequin;


    // --- Hammer ---
    const hammer = createHammer();
    // Initial hammer position (hanging from hands roughly)
    hammer.position.set(0, 1.5, 0.8);
    scene.add(hammer);
    hammerRef.current = hammer;

    // --- Animation Loop ---
    const clock = new THREE.Clock();
    const gravity = 9.8;

    const animate = () => {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1); // Cap dt
      const now = clock.getElapsedTime();

      // Character Animation
      if (physicsState.current.isAnimatingThrow) {
         if (physicsState.current.throwStartTime === -1) {
             physicsState.current.throwStartTime = now;
         }
         const elapsed = now - physicsState.current.throwStartTime;
         const duration = 2.5; // Spin duration
         
         if (elapsed < duration) {
            // Spinning motion
            const spinProgress = elapsed / duration;
            // Accelerate spin
            const rotations = 3;
            const currentAngle = Math.PI / 2 - (spinProgress * spinProgress * rotations * Math.PI * 2);
            
            if (characterRef.current) {
               characterRef.current.group.rotation.y = currentAngle;
               
               // Arms extended and brought together
               characterRef.current.rightArmGroup.rotation.x = -Math.PI / 2.5;
               characterRef.current.leftArmGroup.rotation.x = -Math.PI / 2.5;
               // Rotate arms inward to meet in middle
               characterRef.current.rightArmGroup.rotation.z = 0.55; // ~32 deg inward
               characterRef.current.leftArmGroup.rotation.z = -0.55;

               // Hammer follows character
               if (hammerRef.current) {
                   // Calculate hand position (where arms meet)
                   // Shoulders at +/- 0.65. Arms 1.2 long.
                   // Hands meet at approx 1.02m forward from shoulder line.
                   // Shoulder line rotates with body.
                   const handRadius = 1.02; 
                   
                   // Hands position
                   const handX = Math.sin(currentAngle) * handRadius;
                   const handZ = Math.cos(currentAngle) * handRadius;
                   const handY = 2.0; // Approx height of hands

                   // Ball position (extended out by centrifugal force)
                   const wireLen = 1.2;
                   
                   // Direction from center to hands
                   const dirX = Math.sin(currentAngle);
                   const dirZ = Math.cos(currentAngle);
                   
                   // Ball is further out along this direction
                   const ballX = handX + dirX * wireLen;
                   const ballZ = handZ + dirZ * wireLen;
                   // Ball height - slightly lower than hands due to gravity/angle
                   const ballY = handY - 0.2; 

                   // Place Hammer at HANDS (Anchor)
                   hammerRef.current.position.set(handX, handY, handZ);
                   
                   // Rotate so Ball (local -Y) points to Ball Position
                   // Vector from Handle to Ball
                   const targetDir = new THREE.Vector3(ballX - handX, ballY - handY, ballZ - handZ).normalize();
                   // Local direction of Ball (Down)
                   const localDir = new THREE.Vector3(0, -1, 0);
                   
                   // Create quaternion to rotate localDir to targetDir
                   const q = new THREE.Quaternion();
                   q.setFromUnitVectors(localDir, targetDir);
                   hammerRef.current.rotation.setFromQuaternion(q);
               }
            }
         } else {
            // Release point
            if (!physicsState.current.isFlying && !physicsState.current.hasLanded) {
               physicsState.current.isAnimatingThrow = false;
               physicsState.current.isFlying = true;
               
               // Trigger Throw Sound
               if (onThrowRef.current) {
                   onThrowRef.current();
               }

               // Set initial velocity based on power
               const power = physicsState.current.throwPower;
               const angle = (40 * Math.PI) / 180;
               const vx = power * Math.cos(angle);
               const vy = power * Math.sin(angle);
               physicsState.current.vel.set(vx, vy, 0);
               
               // Add some rotation to the hammer itself
               physicsState.current.rotVel.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);

               // Set start pos (release point)
               if (hammerRef.current) {
                   // Calculate actual ball position in world space
                   const ballWorldPos = hammerRef.current.localToWorld(new THREE.Vector3(0, -1.2, 0));
                   physicsState.current.pos.copy(ballWorldPos);
               }
            }
         }
      } else if (!physicsState.current.isFlying && !physicsState.current.hasLanded) {
         // Idle animation
         if (characterRef.current) {
            characterRef.current.group.position.y = Math.sin(now * 2) * 0.05; // Breathing
            characterRef.current.group.rotation.y = Math.PI / 2; // Reset rotation
            
            // Arms relaxed
            characterRef.current.rightArmGroup.rotation.x = -Math.PI / 6;
            characterRef.current.leftArmGroup.rotation.x = -Math.PI / 6;
         }
         // Hammer hanging
         if (hammerRef.current) {
             // Hands at side/front approx (0, 1.5, 0.5) relative to char?
             // Let's put ball on ground or hanging low
             // Anchor at hands (approx 0, 1.5, 0.5)
             hammerRef.current.position.set(0, 1.5, 0.5); 
             hammerRef.current.rotation.set(0, 0, 0);
             // Let it hang down? Default is Handle at 0, Ball at -1.2.
             // So just rotation 0 is fine (hanging straight down).
             // Maybe slight tilt
             hammerRef.current.rotation.x = 0.1;
         }
      }


      if (physicsState.current.isFlying) {
        const state = physicsState.current;
        
        // Apply gravity
        state.vel.y -= gravity * dt;
        
        // Update position
        state.pos.add(state.vel.clone().multiplyScalar(dt));

        // Ground collision
        if (state.pos.y <= 0.25) { // Ball radius approx
          state.pos.y = 0.25;
          
          // Bounce
          state.vel.y *= -0.3; // Heavy damping for hammer
          state.vel.x *= 0.5; // Heavy friction
          state.rotVel.multiplyScalar(0.5); // Slow down rotation
          
          // Stop condition
          if (Math.abs(state.vel.y) < 0.1 && Math.abs(state.vel.x) < 0.1) {
             state.isFlying = false;
             state.hasLanded = true;
             state.pos.y = 0.25; // Ensure it sits on ground
             state.vel.set(0, 0, 0);
             state.rotVel.set(0, 0, 0);
             
             // Lay flat on ground
             if (hammerRef.current) {
                 // We need to position the GROUP so the BALL is at state.pos
                 // Ball is at (0, -1.2, 0) local.
                 // If we want Ball at P.
                 // Group must be at P + (0, 1.2, 0) rotated?
                 // Easier: Just rotate group so it lies flat, and position it so ball matches.
                 
                 hammerRef.current.rotation.set(Math.PI / 2, 0, 0); // Flat on ground (Handle flat)
                 // If Handle is flat at (0,0,0), Ball is at (0, -1.2, 0) rotated...
                 // Wait, if RotX = 90. Y becomes Z. Z becomes -Y.
                 // (0, -1.2, 0) becomes (0, 0, 1.2) or something.
                 // Let's just set position based on visual.
                 
                 // Actually, let's just move the group to the ball position, 
                 // and offset it by the wire length in the direction of the handle.
                 // For simplicity, just place the ball at the spot.
                 
                 // Re-calculate group position from ball position
                 // If lying flat along X axis?
                 hammerRef.current.position.copy(state.pos);
                 hammerRef.current.position.z -= 1.2; // Handle is 1.2m away
                 hammerRef.current.rotation.set(-Math.PI / 2, 0, 0);
             }

             // Notify parent of the FINAL distance (when stopped)
             if (onLandRef.current) {
                onLandRef.current(state.pos.x);
             }
          }
        }

        if (hammerRef.current) {
          // During flight, we want the BALL to be at state.pos
          // The group origin is the Handle.
          
          // 1. Determine Rotation (Spinning in air)
          hammerRef.current.rotation.x += state.rotVel.x * dt;
          hammerRef.current.rotation.y += state.rotVel.y * dt;
          hammerRef.current.rotation.z += state.rotVel.z * dt;
          
          // 2. Calculate Offset of Ball in current rotation
          // Ball is at (0, -1.2, 0) in local space
          const ballOffset = new THREE.Vector3(0, -1.2, 0);
          ballOffset.applyEuler(hammerRef.current.rotation);
          
          // 3. Set Group Position so that Ball is at state.pos
          // GroupPos + BallOffset = StatePos
          // GroupPos = StatePos - BallOffset
          hammerRef.current.position.copy(state.pos).sub(ballOffset);
        }

        // Camera follow logic
        if (cameraRef.current) {
            // Keep camera behind and slightly above ball, but smooth it
            const idealCamPos = new THREE.Vector3(state.pos.x - 10, Math.max(state.pos.y + 5, 4), state.pos.z + 8);
            cameraRef.current.position.lerp(idealCamPos, 0.1);
            cameraRef.current.lookAt(state.pos);
        }
      } else if (!physicsState.current.hasLanded) {
          // Idle state - rotate around start
          if (cameraRef.current) {
             // Gentle idle movement
             const time = Date.now() * 0.0005;
             cameraRef.current.position.x = Math.sin(time) * 12;
             cameraRef.current.position.z = Math.cos(time) * 12;
             cameraRef.current.position.y = 6;
             cameraRef.current.lookAt(0, 1, 0);
          }
      }

      renderer.render(scene, camera);
    };

    animate();

    // --- Resize Handler ---
    const handleResize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // --- Trigger Throw ---
  useEffect(() => {
    if (power !== null && power > 0) {
      // Start Throw Animation
      physicsState.current.isAnimatingThrow = true;
      physicsState.current.throwPower = power;
      physicsState.current.throwStartTime = -1; // Signal to reset in loop
      
      // Reset ball
      physicsState.current.pos.set(0, 2.5, 0);
      physicsState.current.hasLanded = false;
      physicsState.current.isFlying = false;
      physicsState.current.firstBounce = false;
      
    } else if (power === null) {
        // Reset
        physicsState.current.isFlying = false;
        physicsState.current.hasLanded = false;
        physicsState.current.isAnimatingThrow = false;
        physicsState.current.firstBounce = false;
        physicsState.current.pos.set(0, 2.5, 0);
        if (hammerRef.current) hammerRef.current.position.set(0, 2.5, 0);
    }
  }, [power]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ShotPutScene;
