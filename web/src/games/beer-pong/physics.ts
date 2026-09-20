import * as THREE from "three";
import { BALL, CUP, GRAVITY, TABLE, type CupSlot } from "./layout";

export type BallSim = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  bounced: boolean;
  bounceCount: number;
  settled: boolean;
  sunkId: string | null;
  age: number;
};

export function createBall(from: THREE.Vector3, vel: THREE.Vector3): BallSim {
  return {
    pos: from.clone(),
    vel: vel.clone(),
    bounced: false,
    bounceCount: 0,
    settled: false,
    sunkId: null,
    age: 0,
  };
}

export function velocityToHit(
  from: THREE.Vector3,
  to: THREE.Vector3,
  options?: { arc?: number; power?: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const power = options?.power ?? 1;
  let angle = options?.arc ?? 0.64;
  for (let i = 0; i < 7; i++) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const denom = 2 * (dist * Math.tan(angle) - dy);
    if (denom > 0.04) {
      const speed = dist / (cos * Math.sqrt(denom / GRAVITY));
      if (Number.isFinite(speed) && speed > 0.4 && speed < 11) {
        return new THREE.Vector3(
          (dx / dist) * speed * cos * power,
          speed * sin * power,
          (dz / dist) * speed * cos * power,
        );
      }
    }
    angle += 0.1;
  }
  const t = 0.8;
  return new THREE.Vector3(
    (dx / t) * power,
    ((dy + 0.5 * GRAVITY * t * t) / t) * power,
    (dz / t) * power,
  );
}

function onTable(x: number, z: number) {
  const hx = TABLE.length / 2 + 0.02;
  const hz = TABLE.width / 2 + 0.02;
  return Math.abs(x) <= hx && Math.abs(z) <= hz;
}

function bounceFromCup(ball: BallSim, cup: CupSlot, dist: number) {
  const nx = dist > 1e-5 ? (ball.pos.x - cup.x) / dist : 1;
  const nz = dist > 1e-5 ? (ball.pos.z - cup.z) / dist : 0;
  const outer = CUP.rimRadius + BALL.radius;
  ball.pos.x = cup.x + nx * outer;
  ball.pos.z = cup.z + nz * outer;
  const vn = ball.vel.x * nx + ball.vel.z * nz;
  if (vn < 0) {
    ball.vel.x -= 1.55 * vn * nx;
    ball.vel.z -= 1.55 * vn * nz;
  }
  ball.vel.y *= 0.5;
  ball.vel.x *= 0.82;
  ball.vel.z *= 0.82;
}

export function stepBall(ball: BallSim, cups: CupSlot[], dt: number) {
  const step = Math.min(dt, 1 / 30);
  ball.age += step;
  ball.vel.y -= GRAVITY * step;
  ball.pos.addScaledVector(ball.vel, step);

  const rimY = TABLE.height + CUP.height;
  for (const cup of cups) {
    if (!cup.live) continue;
    const dist = Math.hypot(ball.pos.x - cup.x, ball.pos.z - cup.z);
    const overOpening = dist < CUP.innerRadius - 0.002;
    const inHeight = ball.pos.y < rimY + BALL.radius + 0.01 && ball.pos.y > TABLE.height + 0.02;
    if (overOpening && inHeight && ball.vel.y <= 0.55) {
      ball.sunkId = cup.id;
      ball.settled = true;
      ball.pos.set(cup.x, rimY - 0.04, cup.z);
      ball.vel.set(0, 0, 0);
      return ball;
    }
    const nearRim = ball.pos.y > rimY - 0.035 && ball.pos.y < rimY + BALL.radius + 0.012;
    const hitRim = dist >= CUP.innerRadius - 0.003 && dist < CUP.rimRadius + BALL.radius;
    const hitWall =
      ball.pos.y <= rimY - 0.012 &&
      ball.pos.y >= TABLE.height &&
      dist < CUP.rimRadius + BALL.radius;
    if ((nearRim && hitRim) || hitWall) {
      bounceFromCup(ball, cup, dist);
    }
  }

  const tableTop = TABLE.height + BALL.radius;
  if (onTable(ball.pos.x, ball.pos.z) && ball.pos.y < tableTop && ball.vel.y <= 0) {
    ball.pos.y = tableTop;
    ball.bounced = true;
    ball.bounceCount += 1;
    const incoming = Math.abs(ball.vel.y);
    const rest = ball.bounceCount === 1 ? 0.7 : 0.5;
    ball.vel.y = Math.max(incoming * rest, ball.bounceCount === 1 ? 1.15 : 0);
    if (ball.bounceCount >= 3 && incoming < 0.28) ball.vel.y = 0;
    ball.vel.x *= 0.84;
    ball.vel.z *= 0.84;
  }

  if (ball.pos.y < BALL.radius && ball.vel.y <= 0) {
    ball.pos.y = BALL.radius;
    ball.vel.y *= -0.22;
    ball.vel.x *= 0.6;
    ball.vel.z *= 0.6;
  }

  const speed = ball.vel.length();
  const grounded =
    (onTable(ball.pos.x, ball.pos.z) && ball.pos.y <= tableTop + 0.002) ||
    ball.pos.y <= BALL.radius + 0.002;
  if (ball.age > 0.85 && grounded && speed < 0.12 && (ball.bounceCount >= 2 || !ball.bounced)) {
    ball.settled = true;
    ball.vel.set(0, 0, 0);
  }
  if (ball.age > 3.6 || Math.abs(ball.pos.x) > 3.4 || Math.abs(ball.pos.z) > 2.2) {
    ball.settled = true;
  }
  return ball;
}

export function aimOnTable(origin: THREE.Vector3, direction: THREE.Vector3, out: THREE.Vector3) {
  if (direction.y < -0.02) {
    const t = (TABLE.height - origin.y) / direction.y;
    if (t > 0) {
      out.copy(origin).addScaledVector(direction, t);
      out.y = TABLE.height;
      return out;
    }
  }
  const t = 2.4;
  out.set(origin.x + direction.x * t, TABLE.height, origin.z + direction.z * t);
  return out;
}

export function targetFromAim(aim: THREE.Vector3, cups: CupSlot[]) {
  const target = aim.clone();
  target.y = TABLE.height + BALL.radius;
  for (const cup of cups) {
    if (!cup.live) continue;
    if (Math.hypot(aim.x - cup.x, aim.z - cup.z) <= CUP.rimRadius + 0.008) {
      target.set(cup.x, TABLE.height + CUP.height + 0.008, cup.z);
      return target;
    }
  }
  return target;
}
