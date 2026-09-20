"use client";

import { useEffect, useRef } from "react";
import type { TeamId } from "./layout";

/** Video time when the ball leaves the paw. */
export const THROW_AT = 0.27;
const CLIP_MS = 1300;

export function ThrowBear({
  team,
  clip,
  playId,
  visible,
  onReleased,
}: {
  team: TeamId;
  clip: "idle" | "play" | "hold";
  playId: number;
  visible: boolean;
  onReleased: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const released = useRef(false);
  const onReleasedRef = useRef(onReleased);
  onReleasedRef.current = onReleased;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const pinFirst = () => {
      if (clip !== "idle") return;
      video.pause();
      video.currentTime = 0;
    };
    video.addEventListener("loadeddata", pinFirst);
    pinFirst();
    return () => video.removeEventListener("loadeddata", pinFirst);
  }, [clip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (clip === "idle") {
      released.current = false;
      video.pause();
      video.currentTime = 0;
      return;
    }
    if (clip === "hold") {
      video.pause();
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - 0.05);
      }
      return;
    }
    if (clip !== "play") return;
    released.current = false;
    const release = () => {
      if (released.current) return;
      released.current = true;
      onReleasedRef.current();
    };
    const freezeLast = () => {
      release();
      video.pause();
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - 0.05);
      }
    };
    const onTime = () => {
      if (video.currentTime >= THROW_AT) release();
    };
    let throwAt = 0;
    const play = () => {
      const playing = video.play();
      if (playing) playing.catch(() => {});
      window.clearTimeout(throwAt);
      throwAt = window.setTimeout(release, THROW_AT * 1000);
    };
    const start = () => {
      if (video.currentTime > 0.01) {
        video.pause();
        video.currentTime = 0;
        video.addEventListener("seeked", play, { once: true });
        return;
      }
      play();
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", freezeLast);
    if (video.readyState >= 2) start();
    else video.addEventListener("loadeddata", start, { once: true });
    const fallback = window.setTimeout(freezeLast, CLIP_MS + 250);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", freezeLast);
      video.removeEventListener("loadeddata", start);
      video.removeEventListener("seeked", play);
      window.clearTimeout(throwAt);
      window.clearTimeout(fallback);
    };
  }, [clip, playId]);

  if (!visible) return null;

  const right = team === "b";
  return (
    <div
      className="pointer-events-none absolute bottom-0 z-[12] h-[min(46vh,420px)] w-max"
      style={{
        left: right ? "auto" : "1.5rem",
        right: right ? "1.5rem" : "auto",
        transform: right ? "scaleX(-1)" : undefined,
        transformOrigin: "bottom center",
      }}
    >
      <video
        ref={videoRef}
        className="h-full w-auto max-w-[min(42vw,420px)] object-contain object-bottom"
        muted
        playsInline
        preload="auto"
        poster="/beer-pong/bear-throw.png"
        disablePictureInPicture
      >
        <source src="/beer-pong/bear-throw.webm" type="video/webm" />
        <source src="/beer-pong/bear-throw.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
