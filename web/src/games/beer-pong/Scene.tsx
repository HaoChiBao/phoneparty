"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import * as THREE from "three";
import { HostCanvas } from "@/games/shared/HostCanvas";
import type { Player } from "@/lib/protocol";
import type { GameSceneProps } from "@/games/types";
import { cameraPose } from "./camera";
import { BALL, CUP, TABLE, launchPoint, type CupSlot, type TeamId } from "./layout";
import { parseFlick, throwNudge, throwTarget, type ThrowReadout } from "./throwMath";
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
  type Match,
  type Phase,
} from "./rules";
import { TestPanel, type LastThrowInfo } from "./TestPanel";
import { TurnHud } from "./TurnHud";
import { createBall, stepBall, velocityToHit, type BallSim } from "./physics";
import { DEFAULT_TUNE, type ThrowTune } from "./tune";

const REMATCH_MS = 7000;

const TABLE_GREEN = "#178A3A";
const TABLE_APRON = "#0C4A28";
const SOLO_RED = "#E03C31";
const SOLO_WHITE = "#F7F7F5";

function Table() {
  const topY = TABLE.height - TABLE.thickness / 2;
  const surfaceY = topY + TABLE.thickness / 2 + 0.003;
  const lineY = surfaceY + 0.004;
  const line = 0.018;
  const thin = 0.01;
  const playL = TABLE.length;
  const playW = TABLE.width;
  const netH = 0.152;
  const netY = TABLE.height + netH / 2;
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
        <boxGeometry args={[TABLE.length + 0.05, TABLE.thickness, TABLE.width + 0.05]} />
        <meshStandardMaterial color={TABLE_APRON} roughness={0.65} />
      </mesh>
      <mesh position={[0, surfaceY, 0]} receiveShadow>
        <boxGeometry args={[TABLE.length, 0.006, TABLE.width]} />
        <meshStandardMaterial color={TABLE_GREEN} roughness={0.52} />
      </mesh>
      <mesh position={[0, lineY, playW / 2 - line / 2]}>
        <boxGeometry args={[playL, 0.003, line]} />
        <meshStandardMaterial color="#ffffff" roughness={0.28} />
      </mesh>
      <mesh position={[0, lineY, -playW / 2 + line / 2]}>
        <boxGeometry args={[playL, 0.003, line]} />
        <meshStandardMaterial color="#ffffff" roughness={0.28} />
      </mesh>
      <mesh position={[playL / 2 - line / 2, lineY, 0]}>
        <boxGeometry args={[line, 0.003, playW]} />
        <meshStandardMaterial color="#ffffff" roughness={0.28} />
      </mesh>
      <mesh position={[-playL / 2 + line / 2, lineY, 0]}>
        <boxGeometry args={[line, 0.003, playW]} />
        <meshStandardMaterial color="#ffffff" roughness={0.28} />
      </mesh>
      <mesh position={[0, lineY, 0]}>
        <boxGeometry args={[playL, 0.003, thin]} />
        <meshStandardMaterial color="#ffffff" roughness={0.28} />
      </mesh>
      <mesh position={[0, netY - 0.006, 0]}>
        <boxGeometry args={[0.01, netH - 0.012, playW - 0.03]} />
        <meshStandardMaterial color="#1d1d1d" transparent opacity={0.55} roughness={0.85} />
      </mesh>
      {[-0.045, -0.02, 0.005, 0.03, 0.055].map((y) => (
        <mesh key={y} position={[0, TABLE.height + netH / 2 + y, 0]}>
          <boxGeometry args={[0.012, 0.004, playW - 0.03]} />
          <meshStandardMaterial color="#ececec" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, TABLE.height + netH - 0.005, 0]}>
        <boxGeometry args={[0.016, 0.014, playW - 0.012]} />
        <meshStandardMaterial color="#ffffff" roughness={0.28} />
      </mesh>
      {([-playW / 2 + 0.01, playW / 2 - 0.01] as const).map((z) => (
        <mesh key={z} position={[0, netY, z]}>
          <cylinderGeometry args={[0.012, 0.012, netH + 0.02, 12]} />
          <meshStandardMaterial color="#d0d0d0" metalness={0.4} roughness={0.35} />
        </mesh>
      ))}
      {legs.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, TABLE.height / 2 - TABLE.thickness / 2, z]}>
          <boxGeometry args={[leg, TABLE.height - TABLE.thickness, leg]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function cupRadiusAt(t: number) {
  return CUP.baseRadius + (CUP.rimRadius - CUP.baseRadius) * t;
}

function CupMesh({ cup }: { cup: CupSlot }) {
  if (!cup.live) return null;
  const h = CUP.height;
  const innerRim = CUP.rimRadius - 0.0026;
  const innerBase = CUP.baseRadius - 0.0022;
  return (
    <group position={[cup.x, TABLE.height + h / 2, cup.z]}>
      <mesh>
        <cylinderGeometry args={[CUP.rimRadius, CUP.baseRadius, h, 28, 1, true]} />
        <meshStandardMaterial color={SOLO_RED} roughness={0.36} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[innerRim, innerBase, h - 0.004, 28, 1, true]} />
        <meshStandardMaterial color={SOLO_WHITE} side={THREE.BackSide} roughness={0.18} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CUP.baseRadius, 24]} />
        <meshStandardMaterial color={SOLO_RED} roughness={0.36} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[innerBase, 24]} />
        <meshStandardMaterial color={SOLO_WHITE} roughness={0.18} />
      </mesh>
      <mesh position={[0, h / 2 - 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[innerRim - 0.001, CUP.rimRadius + 0.003, 28]} />
        <meshStandardMaterial color={SOLO_WHITE} roughness={0.2} />
      </mesh>
      {[0.78, 0.64].map((t) => {
        const r = cupRadiusAt(t);
        return (
          <mesh key={t} position={[0, -h / 2 + h * t, 0]}>
            <cylinderGeometry args={[r + 0.0009, r + 0.0007, 0.007, 28, 1, true]} />
            <meshStandardMaterial color={SOLO_WHITE} roughness={0.22} />
          </mesh>
        );
      })}
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

function TurnCamera({ team, phase }: { team: TeamId | null; phase: Phase }) {
  const look = useRef(new THREE.Vector3(0, 0.7, 0));
  const destPos = useRef(new THREE.Vector3(0, 2.25, 3.7));
  const destLook = useRef(new THREE.Vector3(0, 0.7, 0));
  const pose = cameraPose(team, phase);
  destPos.current.set(...pose.position);
  destLook.current.set(...pose.lookAt);

  useFrame(({ camera }, dt) => {
    const t = 1 - Math.exp(-Math.min(dt, 0.08) * 3.1);
    camera.position.lerp(destPos.current, t);
    look.current.lerp(destLook.current, t);
    camera.lookAt(look.current);
  });

  return <PerspectiveCamera makeDefault position={[0, 2.25, 3.7]} fov={46} />;
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
  const [aimSnap, setAimSnap] = useState<ThrowReadout | null>(null);
  const [lastThrow, setLastThrow] = useState<LastThrowInfo | null>(null);
  const matchRef = useRef(match);
  matchRef.current = match;
  const ballRef = useRef<BallSim | null>(null);
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
      if (!id) {
        setAimSnap(null);
        return;
      }
      const calib = calibByPlayer[id];
      const sample = gyroByPlayer[id];
      if (!calib || !sample) {
        setAimSnap(null);
        return;
      }
      const team = matchRef.current.teamOf[id] ?? "a";
      setAimSnap(
        throwNudge(sample, calib, team, matchRef.current.cups, {
          power: 1,
          peak: 0,
          ax: 0,
          ay: 0,
          az: 0,
        }, tuneRef.current),
      );
    }, 80);
    return () => window.clearInterval(timer);
  }, [testing, focusId, calibByPlayer, gyroByPlayer]);

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
      const calib = calibByPlayer[shooter];
      if (!calib) continue;
      const team = current.teamOf[shooter] ?? "a";
      const flick = parseFlick(action.data);
      const feel = tuneRef.current;
      const nudge = throwNudge(
        gyroByPlayer[shooter],
        calib,
        team,
        current.cups,
        flick,
        feel,
      );
      const target = throwTarget(nudge);
      const start = launchPoint(team, 0);
      from.set(start.x, start.y, start.z);
      const vel = velocityToHit(from, target, {
        arc: feel.arc,
        power: feel.power,
      });
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
  }, [actionsByPlayer, calibByPlayer, from, gyroByPlayer]);

  const shooter = currentId(match);
  const shooterTeam = shooter ? (match.teamOf[shooter] ?? null) : null;
  const movingId = controllers.reduce<string | null>((best, player) => {
    const sample = gyroByPlayer[player.id];
    if (!sample) return best;
    const bestTs = best ? (gyroByPlayer[best]?.timestamp ?? -1) : -1;
    return sample.timestamp > bestTs ? player.id : best;
  }, null);
  const watchId = focusId ?? movingId ?? shooter ?? controllers[0]?.id ?? null;
  const viewTeam = testing
    ? (watchId ? match.teamOf[watchId] : null) ?? shooterTeam ?? (controllers[0] ? "a" : null)
    : shooterTeam;
  const viewPhase = testing && controllers.length > 0 ? "aim" : match.phase;

  return (
    <>
      <HostCanvas>
        <color attach="background" args={["#ffffff"]} />
        <TurnCamera team={viewTeam} phase={viewPhase} />
        <ambientLight intensity={0.95} />
        <directionalLight position={[2.2, 5.4, 3.2]} intensity={1.15} />
        <directionalLight position={[-2.4, 3.8, -2.6]} intensity={0.45} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[14, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <Table />
        {match.cups.map((cup) => (
          <CupMesh key={cup.id} cup={cup} />
        ))}
        <BallMesh ballRef={ballRef} />
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
      <TurnHud
        match={match}
        controllers={controllers}
        testing={testing}
        shooterCalibrated={Boolean(shooter && calibByPlayer[shooter])}
      />
    </>
  );
}
