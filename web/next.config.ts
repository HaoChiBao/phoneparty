import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Next dev blocks cross-origin requests to /_next/* by default, so opening the
// host page on a LAN IP (which the phone QR needs) serves HTML but no chunks:
// the page never hydrates and nothing is clickable. Allow this machine's own
// private addresses, recomputed on each dev start so a new network still works.
function lanOrigins() {
  const addresses = new Set<string>();
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      addresses.add(entry.address);
    }
  }
  return [...addresses];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanOrigins(),
};

export default nextConfig;
