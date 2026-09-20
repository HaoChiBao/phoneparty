"use client";

import { ContactShadows, PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import * as THREE from "three";
import { HostCanvas } from "@/games/shared/HostCanvas";
import { MatteMaterial } from "@/games/shared/MatteMaterial";
import { ShadowLight } from "@/games/shared/ShadowLight";
import type { Player } from "@/lib/protocol";
import type { GameSceneProps } from "@/games/types";
import { cameraPose } from "./camera";
import { BALL, CUP, TABLE, launchPoint, type CupSlot, type TeamId } from "./layout";
import { parseFlick, sampleFromThrow, throwNudge, throwTarget, type ThrowReadout } from "./throwMath";
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
import { ThrowBear } from "./ThrowBear";
import { TurnHud } from "./TurnHud";
import { createBall, stepBall, velocityToHit, type BallSim } from "./physics";
import { DEFAULT_TUNE, type ThrowTune } from "./tune";
import { actionOn, PONG_SYNC, viewFromMatch } from "./view";

type PendingShot = {
  from: THREE.Vector3;
  vel: THREE.Vector3;
};

const REMATCH_MS = 7000;
// Keep the made cup readable, but do not make the next player wait through a
// long celebration after the ball has already settled.
const REVEAL_MS = 180;

const TABLE_GREEN = "#2db85a";
const TABLE_APRON = "#1a7a44";
const CUP_ORANGE = "#EBA02A";
const CUP_WHITE = "#ffffff";
const GLOW = "#FFE27A";

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
      <mesh castShadow receiveShadow position={[0, topY, 0]}>
        <boxGeometry args={[TABLE.length + 0.05, TABLE.thickness, TABLE.width + 0.05]} />
        <MatteMaterial color={TABLE_APRON} />
      </mesh>
      <mesh receiveShadow position={[0, surfaceY, 0]}>
        <boxGeometry args={[TABLE.length, 0.006, TABLE.width]} />
        <MatteMaterial color={TABLE_GREEN} />
      </mesh>
      <mesh position={[0, lineY, playW / 2 - line / 2]}>
        <boxGeometry args={[playL, 0.003, line]} />
        <MatteMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, lineY, -playW / 2 + line / 2]}>
        <boxGeometry args={[playL, 0.003, line]} />
        <MatteMaterial color="#ffffff" />
      </mesh>
      <mesh position={[playL / 2 - line / 2, lineY, 0]}>
        <boxGeometry args={[line, 0.003, playW]} />
        <MatteMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-playL / 2 + line / 2, lineY, 0]}>
        <boxGeometry args={[line, 0.003, playW]} />
        <MatteMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, lineY, 0]}>
        <boxGeometry args={[playL, 0.003, thin]} />
        <MatteMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, netY - 0.006, 0]}>
        <boxGeometry args={[0.01, netH - 0.012, playW - 0.03]} />
        <MatteMaterial color="#3a3a3a" transparent opacity={0.55} />
      </mesh>
      {[-0.045, -0.02, 0.005, 0.03, 0.055].map((y) => (
        <mesh key={y} position={[0, TABLE.height + netH / 2 + y, 0]}>
          <boxGeometry args={[0.012, 0.004, playW - 0.03]} />
          <MatteMaterial color="#f2f2f2" />
        </mesh>
      ))}
      <mesh castShadow position={[0, TABLE.height + netH - 0.005, 0]}>
        <boxGeometry args={[0.016, 0.014, playW - 0.012]} />
        <MatteMaterial color="#ffffff" />
      </mesh>
      {([-playW / 2 + 0.01, playW / 2 - 0.01] as const).map((z) => (
        <mesh key={z} castShadow position={[0, netY, z]}>
          <cylinderGeometry args={[0.012, 0.012, netH + 0.02, 12]} />
          <MatteMaterial color="#e0e0e0" />
        </mesh>
      ))}
      {legs.map(([x, z]) => (
        <mesh
          key={`${x}:${z}`}
          castShadow
          position={[x, TABLE.height / 2 - TABLE.thickness / 2, z]}
        >
          <boxGeometry args={[leg, TABLE.height - TABLE.thickness, leg]} />
          <MatteMaterial color="#3a3a3a" />
        </mesh>
      ))}
    </group>
  );
}

function CupMesh({ cup, glowing }: { cup: CupSlot; glowing: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const beams = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!glowing || !cup.live) return;
    const pulse = 0.7 + Math.sin(clock.elapsedTime * 11) * 0.3;
    if (light.current) light.current.intensity = 2.8 + pulse * 2.4;
    if (beams.current) beams.current.position.y = pulse * 0.03;
  });
  if (!cup.live) return null;
  const h = CUP.height;
  const innerRim = CUP.rimRadius - 0.0026;
  const innerBase = CUP.baseRadius - 0.0022;
  return (
    <group position={[cup.x, TABLE.height + h / 2, cup.z]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[CUP.rimRadius, CUP.baseRadius, h, 28, 1, true]} />
        <meshStandardMaterial
          color={CUP_ORANGE}
          roughness={0.36}
          emissive={glowing ? GLOW : "#000000"}
          emissiveIntensity={glowing ? 1.6 : 0}
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[innerRim, innerBase, h - 0.004, 28, 1, true]} />
        <meshStandardMaterial
          color={CUP_WHITE}
          side={THREE.BackSide}
          roughness={0.18}
          emissive={glowing ? GLOW : "#000000"}
          emissiveIntensity={glowing ? 2.1 : 0}
        />
      </mesh>
      <mesh castShadow position={[0, -h / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CUP.baseRadius, 24]} />
        <meshStandardMaterial
          color={CUP_ORANGE}
          roughness={0.36}
          emissive={glowing ? GLOW : "#000000"}
          emissiveIntensity={glowing ? 1.2 : 0}
        />
      </mesh>
      <mesh position={[0, -h / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[innerBase, 24]} />
        <meshStandardMaterial
          color={CUP_WHITE}
          roughness={0.18}
          emissive={glowing ? GLOW : "#000000"}
          emissiveIntensity={glowing ? 2.4 : 0}
        />
      </mesh>
      <mesh position={[0, h / 2 - 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[innerRim - 0.001, CUP.rimRadius + 0.003, 28]} />
        <meshStandardMaterial
          color={CUP_WHITE}
          roughness={0.2}
          emissive={glowing ? GLOW : "#000000"}
          emissiveIntensity={glowing ? 1.8 : 0}
        />
      </mesh>
      {glowing ? (
        <>
          <pointLight ref={light} color={GLOW} intensity={5.4} distance={3.4} position={[0, 0.18, 0]} />
          <pointLight color="#fff4b8" intensity={2.2} distance={1.6} position={[0, 0.55, 0]} />
          <spotLight
            color={GLOW}
            intensity={6.5}
            distance={3.2}
            angle={0.55}
            penumbra={0.45}
            position={[0, 0.02, 0]}
          >
            <object3D attach="target" position={[0, 1.4, 0]} />
          </spotLight>
          <group ref={beams} position={[0, h / 2, 0]}>
            <mesh>
              <cylinderGeometry args={[0.012, 0.068, 0.92, 14, 1, true]} />
              <meshBasicMaterial color={GLOW} transparent opacity={0.48} side={THREE.DoubleSide} />
            </mesh>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <mesh key={i} rotation={[0.28, (i / 8) * Math.PI * 2, 0]} position={[0, 0.34, 0]}>
                <coneGeometry args={[0.018, 0.78, 8, 1, true]} />
                <meshBasicMaterial color="#fff4b0" transparent opacity={0.38} side={THREE.DoubleSide} />
              </mesh>
            ))}
            {[0.16, 0.38, 0.6, 0.82].map((y) => (
              <mesh key={y} position={[0.01, y, 0.01]}>
                <sphereGeometry args={[0.014, 10, 10]} />
                <meshBasicMaterial color="#fff8d2" />
              </mesh>
            ))}
          </group>
        </>
      ) : null}
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
    <mesh ref={mesh} castShadow visible={false}>
      <sphereGeometry args={[BALL.radius, 24, 24]} />
      <MatteMaterial color="#ffffff" />
    </mesh>
  );
}

function applyLanding(
  match: Match,
  controllers: Player[],
  tester: boolean,
  sunkId: string | null,
  bounced: boolean,
): Match {
  if (tester) {
    return sunkId
      ? applyTestSink(match, sunkId, bounced)
      : { ...match, phase: "aim" as const, message: "Test. Throw anytime." };
  }
  return sunkId ? applySink(match, controllers, sunkId, bounced) : applyMiss(match, controllers);
}

function GameLoop({
  matchRef,
  ballRef,
  controllersRef,
  testRef,
  lastRef,
  setMatch,
  setLastThrow,
  setGlowCup,
}: {
  matchRef: MutableRefObject<Match>;
  ballRef: MutableRefObject<BallSim | null>;
  controllersRef: MutableRefObject<Player[]>;
  testRef: MutableRefObject<boolean>;
  lastRef: MutableRefObject<LastThrowInfo | null>;
  setMatch: Dispatch<SetStateAction<Match>>;
  setLastThrow: (next: LastThrowInfo) => void;
  setGlowCup: (id: string | null) => void;
}) {
  const pending = useRef<{ sunkId: string | null; bounced: boolean } | null>(null);
  const revealAt = useRef(0);
  const acc = useRef(0);
  const tracked = useRef<BallSim | null>(null);
  useFrame((_, dt) => {
    if (pending.current) {
      if (matchRef.current.phase !== "flight") {
        pending.current = null;
        setGlowCup(null);
        return;
      }
      if (Date.now() < revealAt.current) return;
      const landed = pending.current;
      pending.current = null;
      setGlowCup(null);
      ballRef.current = null;
      acc.current = 0;
      // Resolve against React's latest match. A room/player update can render
      // during the reveal, and applying to the captured match could otherwise
      // replace a just-removed cup with an older rack.
      setMatch((current) =>
        applyLanding(
          current,
          controllersRef.current,
          testRef.current,
          landed.sunkId,
          landed.bounced,
        ),
      );
      return;
    }
    const ball = ballRef.current;
    if (!ball || ball.settled) return;
    if (tracked.current !== ball) {
      tracked.current = ball;
      acc.current = 0;
    }
    acc.current += Math.min(Math.max(dt, 0), 0.05);
    // The cup mouth is 7cm across. At 1/60 a 5m/s throw moves 8cm per step, so
    // the ball could be outside the opening on one sample and past it on the
    // next — measured at 17% of genuine sinks missed, plus 3% credited to the
    // wrong cup. Substepping takes that to 2% and 0%.
    const step = 1 / 480;
    let guard = 0;
    while (acc.current >= step && !ball.settled && guard < 48) {
      stepBall(ball, matchRef.current.cups, step);
      acc.current -= step;
      guard += 1;
    }
    if (!ball.settled) return;
    acc.current = 0;
    const result = ball.sunkId
      ? ball.bounced
        ? "bounce"
        : "sink"
      : ball.bounced
        ? "bounce"
        : "miss";
    const prev = lastRef.current;
    if (prev && prev.result === "air") {
      setLastThrow({ ...prev, result, cupId: ball.sunkId ?? undefined });
    }
    pending.current = { sunkId: ball.sunkId, bounced: ball.bounced };
    revealAt.current = Date.now() + REVEAL_MS;
    setGlowCup(ball.sunkId);
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

  return <PerspectiveCamera makeDefault position={[0, 2.45, 1.55]} fov={42} />;
}

function rosterKey(controllers: Player[]) {
  return controllers.map((player) => `${player.id}:${player.name}`).join("|");
}

export function BeerPongScene({
  controllers,
  gyroByPlayer,
  calibByPlayer,
  actionsByPlayer,
  sendAction,
}: GameSceneProps) {
  const [match, setMatch] = useState<Match>(() => emptyMatch());
  const [testing, setTesting] = useState(false);
  const [tune, setTune] = useState<ThrowTune>(DEFAULT_TUNE);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [aimSnap, setAimSnap] = useState<ThrowReadout | null>(null);
  const [lastThrow, setLastThrow] = useState<LastThrowInfo | null>(null);
  const [glowCup, setGlowCup] = useState<string | null>(null);
  const [bearClip, setBearClip] = useState<"idle" | "play" | "hold">("idle");
  const [bearPlayId, setBearPlayId] = useState(0);
  const matchRef = useRef(match);
  matchRef.current = match;
  const ballRef = useRef<BallSim | null>(null);
  const pendingShot = useRef<PendingShot | null>(null);
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
    setMatch((current) =>
      testRef.current
        ? syncTestPlayers(current, controllersRef.current)
        : syncPlayers(current, controllersRef.current),
    );
  }, [playersKey, testing]);

  useEffect(() => {
    if (testing || match.phase !== "over" || !match.endedAt) return;
    const wait = Math.max(400, REMATCH_MS - (Date.now() - match.endedAt));
    const timer = window.setTimeout(() => {
      setMatch((current) => rematch(current, controllersRef.current));
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
        pendingShot.current = null;
        ballRef.current = null;
        setGlowCup(null);
        setBearClip("idle");
        setMatch((current) => refillCups(current));
        continue;
      }
      if (action.type !== "throw") continue;
      const current = matchRef.current;
      const tester = testRef.current;
      if (!tester && current.phase !== "aim") continue;
      if (pendingShot.current || ballRef.current) continue;
      const shooter = tester ? playerId : currentId(current);
      if (!shooter || shooter !== playerId) continue;
      const calib = calibByPlayer[shooter];
      if (!calib) continue;
      const team = current.teamOf[shooter] ?? "a";
      const flick = parseFlick(action.data);
      const pose = sampleFromThrow(action.data, gyroByPlayer[shooter]);
      if (!pose && !tester) continue;
      const feel = tuneRef.current;
      const nudge = throwNudge(
        pose,
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
      const playerName =
        controllersRef.current.find((player) => player.id === shooter)?.name ?? "Player";
      pendingShot.current = {
        from: from.clone(),
        vel: vel.clone(),
      };
      setLastThrow({
        name: playerName,
        speed: vel.length(),
        arcDeg: (feel.arc * 180) / Math.PI,
        power: feel.power,
        targetX: target.x,
        targetZ: target.z,
        result: "air",
      });
      setMatch((latest) =>
        latest.phase === "aim" && (tester || currentId(latest) === shooter)
          ? beginFlight(latest)
          : latest,
      );
      setBearClip("play");
      setBearPlayId((id) => id + 1);
    }
  }, [actionsByPlayer, calibByPlayer, from, gyroByPlayer]);

  function releaseShot() {
    const shot = pendingShot.current;
    pendingShot.current = null;
    setBearClip("hold");
    if (!shot) return;
    ballRef.current = createBall(shot.from, shot.vel);
  }

  const snapshot = viewFromMatch(match, controllers, {
    testing,
    lastResult: lastThrow?.result ?? null,
  });
  const snapshotKey = JSON.stringify(snapshot);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  useEffect(() => {
    sendAction?.(PONG_SYNC, snapshotRef.current);
  }, [sendAction, snapshotKey]);

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
  const shownClip = match.phase === "flight" ? bearClip : "idle";
  const showBear =
    Boolean(viewTeam) && viewPhase !== "waiting" && viewPhase !== "over";

  return (
    <>
      <HostCanvas>
        <color attach="background" args={["#ffffff"]} />
        <TurnCamera team={viewTeam} phase={viewPhase} />
        <ambientLight intensity={0.95} />
        <ShadowLight position={[2.2, 5.4, 3.2]} intensity={1.15} coverage={6} />
        <directionalLight position={[-2.4, 3.8, -2.6]} intensity={0.45} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[14, 12]} />
          <MatteMaterial color="#ffffff" />
        </mesh>
        <ContactShadows
          position={[0, 0.015, 0]}
          opacity={0.3}
          scale={10}
          blur={2.4}
          far={1.4}
          color="#1a1a1a"
        />
        <Table />
        <ContactShadows
          position={[0, TABLE.height + 0.008, 0]}
          opacity={0.42}
          scale={3.4}
          blur={1.25}
          far={0.9}
          color="#102010"
        />
        {match.cups.map((cup) => (
          <CupMesh key={cup.id} cup={cup} glowing={cup.id === glowCup} />
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
          setGlowCup={setGlowCup}
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
          pendingShot.current = null;
          ballRef.current = null;
          setGlowCup(null);
          setBearClip("idle");
          setMatch((current) => refillCups(current));
        }}
        lastThrow={lastThrow}
      />
      {viewTeam ? (
        <ThrowBear
          team={viewTeam}
          clip={shownClip}
          playId={bearPlayId}
          visible={showBear}
          onReleased={releaseShot}
        />
      ) : null}
      <TurnHud
        match={match}
        controllers={controllers}
        testing={testing}
        shooterCalibrated={Boolean(shooter && calibByPlayer[shooter])}
        lastThrow={lastThrow}
      />
    </>
  );
}
