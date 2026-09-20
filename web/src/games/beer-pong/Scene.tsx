"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import * as THREE from "three";
import { HostCanvas } from "@/games/shared/HostCanvas";
import type { CalibratedPose, GameActionState, GyroSample, Player } from "@/lib/protocol";
import type { GameSceneProps } from "@/games/types";
import { computeAim, createAimScratch, snapshotAim, type AimSnapshot } from "./aimMath";
import { BALL, CUP, TABLE, launchPoint, liveCups, type CupSlot, type TeamId } from "./layout";
import {
  applyMiss,
  applySink,
  applyTestSink,
  beginFlight,
  currentId,
  emptyMatch,
  refillCups,
  rematch,
  syncPlayers,
  syncTestPlayers,
  teamName,
  type Match,
} from "./rules";
import { TestPanel, type LastThrowInfo } from "./TestPanel";
import { createBall, stepBall, targetFromAim, velocityToHit, type BallSim } from "./physics";
import { DEFAULT_TUNE, type ThrowTune } from "./tune";

const REMATCH_MS = 7000;

function teamColor(team: TeamId) {
  return team === "a" ? "#0057FF" : "#111111";
}

function Table() {
  const topY = TABLE.height - TABLE.thickness / 2;
  const leg = 0.045;
  const inset = 0.08;
  const hx = TABLE.length / 2 - inset;
  const hz = TABLE.width / 2 - inset;
  const legs: [number, number][] = [
    [-hx, -hz],
    [-hx, hz],
    [hx, -hz],
    [hx, hz],
  ];
  return (
    <group>
      <mesh position={[0, topY, 0]} receiveShadow>
        <boxGeometry args={[TABLE.length, TABLE.thickness, TABLE.width]} />
        <meshStandardMaterial color="#f3f4f7" />
      </mesh>
      <mesh position={[0, topY + TABLE.thickness / 2 + 0.002, 0]}>
        <boxGeometry args={[TABLE.length - 0.04, 0.004, TABLE.width - 0.04]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, TABLE.height / 2 - TABLE.thickness / 2, z]}>
          <boxGeometry args={[leg, TABLE.height - TABLE.thickness, leg]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      ))}
    </group>
  );
}

function CupMesh({ cup }: { cup: CupSlot }) {
  if (!cup.live) return null;
  const color = teamColor(cup.team);
  return (
    <group position={[cup.x, TABLE.height + CUP.height / 2, cup.z]}>
      <mesh>
        <cylinderGeometry args={[CUP.rimRadius, CUP.baseRadius, CUP.height, 20, 1, true]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.45} />
      </mesh>
      <mesh position={[0, -CUP.height / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CUP.baseRadius, 20]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, -CUP.height / 2 + 0.028, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CUP.baseRadius * 0.82, 16]} />
        <meshBasicMaterial color={cup.team === "a" ? "#0039B3" : "#2a2a2a"} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function BallMesh({ ballRef }: { ballRef: RefObject<BallSim | null> }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!mesh.current) return;
    const ball = ballRef.current;
    if (!ball) {
      mesh.current.visible = false;
      return;
    }
    mesh.current.visible = true;
    mesh.current.position.copy(ball.pos);
  });
  return (
    <mesh ref={mesh} visible={false}>
      <sphereGeometry args={[BALL.radius, 24, 24]} />
      <meshStandardMaterial color="#f6f6f6" roughness={0.35} />
    </mesh>
  );
}

function AimPointer({
  player,
  sample,
  calib,
  aims,
  readouts,
  tuneRef,
}: {
  player: Player;
  sample?: GyroSample;
  calib?: CalibratedPose;
  aims: MutableRefObject<Record<string, THREE.Vector3>>;
  readouts: MutableRefObject<Record<string, AimSnapshot>>;
  tuneRef: MutableRefObject<ThrowTune>;
}) {
  const group = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const spot = useRef<THREE.Mesh>(null);
  const firstPose = useRef<CalibratedPose | null>(null);
  const scratch = useMemo(() => createAimScratch(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const along = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(() => {
    if (!group.current || !sample) return;
    if (!firstPose.current) {
      firstPose.current = {
        alpha: sample.alpha,
        beta: sample.beta,
        gamma: sample.gamma,
        x: sample.x,
        y: sample.y,
        z: sample.z,
      };
    }
    const readout = computeAim(
      sample,
      calib ?? firstPose.current,
      tuneRef.current,
      scratch,
    );
    group.current.quaternion.copy(scratch.quaternion);
    group.current.position.copy(readout.origin);
    aims.current[player.id] = readout.hit.clone();
    readouts.current[player.id] = snapshotAim(readout);

    if (spot.current) {
      spot.current.position.set(readout.hit.x, TABLE.height + 0.008, readout.hit.z);
      spot.current.visible = true;
    }
    if (beam.current) {
      const length = Math.max(readout.origin.distanceTo(readout.hit), 0.05);
      mid.copy(readout.origin).add(readout.hit).multiplyScalar(0.5);
      along.copy(readout.hit).sub(readout.origin).normalize();
      beam.current.position.copy(mid);
      beam.current.quaternion.setFromUnitVectors(up, along);
      beam.current.scale.set(1, length, 1);
      beam.current.visible = true;
    }
  });

  return (
    <>
      <group ref={group} position={[0, 1.85, 2.7]} />
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.004, 0.004, 1, 8]} />
        <meshBasicMaterial color={player.color} transparent opacity={0.5} />
      </mesh>
      <mesh ref={spot} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.03, 0.05, 24]} />
        <meshBasicMaterial color={player.color} />
      </mesh>
    </>
  );
}

function GameLoop({
  matchRef,
  ballRef,
  controllersRef,
  testRef,
  lastRef,
  setMatch,
  setLastThrow,
}: {
  matchRef: MutableRefObject<Match>;
  ballRef: MutableRefObject<BallSim | null>;
  controllersRef: MutableRefObject<Player[]>;
  testRef: MutableRefObject<boolean>;
  lastRef: MutableRefObject<LastThrowInfo | null>;
  setMatch: (next: Match) => void;
  setLastThrow: (next: LastThrowInfo) => void;
}) {
  const resolving = useRef(false);
  useFrame((_, dt) => {
    const ball = ballRef.current;
    if (!ball || ball.settled || resolving.current) return;
    stepBall(ball, matchRef.current.cups, dt);
    if (!ball.settled) return;
    resolving.current = true;
    const match = matchRef.current;
    const controllers = controllersRef.current;
    const result = ball.sunkId ? (ball.bounced ? "bounce" : "sink") : "miss";
    const prev = lastRef.current;
    if (prev && prev.result === "air") {
      setLastThrow({ ...prev, result, cupId: ball.sunkId ?? undefined });
    }
    const next = testRef.current
      ? ball.sunkId
        ? applyTestSink(match, ball.sunkId, ball.bounced)
        : { ...match, phase: "aim" as const, message: "Test. Throw anytime." }
      : ball.sunkId
        ? applySink(match, controllers, ball.sunkId, ball.bounced)
        : applyMiss(match, controllers);
    ballRef.current = null;
    setMatch(next);
    resolving.current = false;
  });
  return null;
}

function LookAtTable() {
  useFrame(({ camera }) => {
    camera.lookAt(0, 0.7, 0);
  });
  return null;
}

function rosterKey(controllers: Player[]) {
  return controllers.map((player) => `${player.id}:${player.name}`).join("|");
}

function actionOn(data: unknown, fallback = true) {
  if (typeof data !== "object" || data === null) return fallback;
  if (!("on" in data)) return fallback;
  return Boolean((data as { on?: unknown }).on);
}

export function BeerPongScene({
  controllers,
  gyroByPlayer,
  calibByPlayer,
  actionsByPlayer,
}: GameSceneProps) {
  const [match, setMatch] = useState<Match>(() => emptyMatch());
  const [testing, setTesting] = useState(false);
  const [tune, setTune] = useState<ThrowTune>(DEFAULT_TUNE);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [aimSnap, setAimSnap] = useState<AimSnapshot | null>(null);
  const [lastThrow, setLastThrow] = useState<LastThrowInfo | null>(null);
  const matchRef = useRef(match);
  matchRef.current = match;
  const ballRef = useRef<BallSim | null>(null);
  const aims = useRef<Record<string, THREE.Vector3>>({});
  const readouts = useRef<Record<string, AimSnapshot>>({});
  const handled = useRef<Record<string, number>>({});
  const controllersRef = useRef(controllers);
  controllersRef.current = controllers;
  const testRef = useRef(testing);
  testRef.current = testing;
  const tuneRef = useRef(tune);
  tuneRef.current = tune;
  const lastRef = useRef(lastThrow);
  lastRef.current = lastThrow;
  const from = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);

  const playersKey = rosterKey(controllers);
  useEffect(() => {
    const next = testRef.current
      ? syncTestPlayers(matchRef.current, controllersRef.current)
      : syncPlayers(matchRef.current, controllersRef.current);
    setMatch(next);
  }, [playersKey, testing]);

  useEffect(() => {
    if (testing || match.phase !== "over" || !match.endedAt) return;
    const wait = Math.max(400, REMATCH_MS - (Date.now() - match.endedAt));
    const timer = window.setTimeout(() => {
      setMatch(rematch(matchRef.current, controllersRef.current));
    }, wait);
    return () => window.clearTimeout(timer);
  }, [match.phase, match.endedAt, testing]);

  useEffect(() => {
    if (!testing) return;
    const timer = window.setInterval(() => {
      const id = focusId ?? currentId(matchRef.current) ?? controllersRef.current[0]?.id;
      setAimSnap(id ? (readouts.current[id] ?? null) : null);
    }, 80);
    return () => window.clearInterval(timer);
  }, [testing, focusId]);

  useEffect(() => {
    for (const [playerId, action] of Object.entries(actionsByPlayer)) {
      if (!action) continue;
      const key = `${action.type}:${playerId}`;
      if ((handled.current[key] ?? 0) >= action.timestamp) continue;
      handled.current[key] = action.timestamp;
      if (action.type === "test") {
        setTesting(actionOn(action.data, true));
        continue;
      }
      if (action.type === "resetCups") {
        ballRef.current = null;
        setMatch(refillCups(matchRef.current));
        continue;
      }
      if (action.type !== "throw") continue;
      const current = matchRef.current;
      const tester = testRef.current;
      if (!tester && current.phase !== "aim") continue;
      const shooter = tester ? playerId : currentId(current);
      if (!shooter || shooter !== playerId) continue;
      const team = current.teamOf[shooter] ?? "a";
      const raw =
        aims.current[shooter] ?? new THREE.Vector3(team === "a" ? 0.9 : -0.9, TABLE.height, 0);
      aim.copy(raw);
      const target = targetFromAim(aim, current.cups);
      const start = launchPoint(team, aim.z);
      from.set(start.x, start.y, start.z);
      const feel = tuneRef.current;
      const vel = velocityToHit(from, target, { arc: feel.arc, power: feel.power });
      ballRef.current = createBall(from, vel);
      const playerName =
        controllersRef.current.find((player) => player.id === shooter)?.name ?? "Player";
      setLastThrow({
        name: playerName,
        speed: vel.length(),
        arcDeg: (feel.arc * 180) / Math.PI,
        power: feel.power,
        targetX: target.x,
        targetZ: target.z,
        result: "air",
      });
      setMatch(beginFlight(current));
    }
  }, [actionsByPlayer, aim, from]);

  const shooter = currentId(match);
  const movingId = controllers.reduce<string | null>((best, player) => {
    const sample = gyroByPlayer[player.id];
    if (!sample) return best;
    const bestTs = best ? (gyroByPlayer[best]?.timestamp ?? -1) : -1;
    return sample.timestamp > bestTs ? player.id : best;
  }, null);
  const watchId = focusId ?? movingId ?? shooter ?? controllers[0]?.id ?? null;
  const aLeft = liveCups(match.cups, "a").length;
  const bLeft = liveCups(match.cups, "b").length;
  const aimPlayers =
    testing && match.phase !== "over"
      ? controllers
      : shooter && match.phase === "aim"
        ? controllers.filter((player) => player.id === shooter)
        : [];

  return (
    <>
      <HostCanvas>
        <color attach="background" args={["#ffffff"]} />
        <PerspectiveCamera makeDefault position={[0, 2.35, 3.85]} fov={40} />
        <LookAtTable />
        <ambientLight intensity={0.9} />
        <directionalLight position={[2.2, 5.4, 3.2]} intensity={1.05} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[14, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <Table />
        {match.cups.map((cup) => (
          <CupMesh key={cup.id} cup={cup} />
        ))}
        <BallMesh ballRef={ballRef} />
        {aimPlayers.map((player) => (
          <AimPointer
            key={player.id}
            player={player}
            sample={gyroByPlayer[player.id]}
            calib={calibByPlayer[player.id]}
            aims={aims}
            readouts={readouts}
            tuneRef={tuneRef}
          />
        ))}
        <GameLoop
          matchRef={matchRef}
          ballRef={ballRef}
          controllersRef={controllersRef}
          testRef={testRef}
          lastRef={lastRef}
          setMatch={setMatch}
          setLastThrow={setLastThrow}
        />
      </HostCanvas>
      <TestPanel
        testing={testing}
        onToggle={() => setTesting((on) => !on)}
        controllers={controllers}
        focusId={watchId}
        onFocus={setFocusId}
        sample={watchId ? gyroByPlayer[watchId] : undefined}
        calib={watchId ? calibByPlayer[watchId] : undefined}
        aim={aimSnap}
        tune={tune}
        onTune={(field, value) => setTune((current) => ({ ...current, [field]: value }))}
        onResetTune={() => setTune(DEFAULT_TUNE)}
        onResetCups={() => {
          ballRef.current = null;
          setMatch(refillCups(matchRef.current));
        }}
        lastThrow={lastThrow}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-14 z-10 flex justify-center px-4">
        <div className="bg-white/90 px-4 py-2 text-center">
          <p className="text-sm font-medium">
            {teamName(match, controllers, "a") || "Blue"} {aLeft}
            <span className="mx-2 text-black/30">·</span>
            {bLeft} {teamName(match, controllers, "b") || "Black"}
          </p>
          <p className="mt-0.5 text-xs text-black/55">
            {match.phase === "flight" ? "Ball in the air" : match.message}
          </p>
        </div>
      </div>
    </>
  );
}
