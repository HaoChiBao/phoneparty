"use client";

import { useEffect, useRef } from "react";
import { AIM } from "./aim";

/** Video seconds spent drawing the bow. Release starts just after this. */
export const CHARGE_END = 2.55;

export type BowClip = "idle" | "charge" | "release" | "hold";

export function BowBear({
  clip,
  playId,
  onReleased,
}: {
  clip: BowClip;
  playId: number;
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
      video.playbackRate = 1;
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
      video.playbackRate = 1;
      video.currentTime = 0;
      return;
    }

    if (clip === "hold") {
      video.pause();
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - 0.04);
      }
      return;
    }

    if (clip === "charge") {
      released.current = false;
      const rate = CHARGE_END / AIM.holdSeconds;
      const pinDraw = () => {
        video.pause();
        video.currentTime = CHARGE_END;
      };
      const onTime = () => {
        if (video.currentTime >= CHARGE_END) pinDraw();
      };
      const play = () => {
        video.playbackRate = rate;
        const playing = video.play();
        if (playing) playing.catch(pinDraw);
      };
      const start = () => {
        video.pause();
        video.currentTime = 0;
        if (video.currentTime > 0.01) {
          video.addEventListener("seeked", play, { once: true });
          return;
        }
        play();
      };
      video.addEventListener("timeupdate", onTime);
      if (video.readyState >= 2) start();
      else video.addEventListener("loadeddata", start, { once: true });
      return () => {
        video.removeEventListener("timeupdate", onTime);
        video.removeEventListener("loadeddata", start);
        video.removeEventListener("seeked", play);
      };
    }

    const finish = () => {
      if (released.current) return;
      released.current = true;
      video.pause();
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - 0.04);
      }
      onReleasedRef.current();
    };
    const playRelease = () => {
      video.playbackRate = 1;
      const playing = video.play();
      if (playing) playing.catch(() => finish());
    };
    const startRelease = () => {
      if (video.currentTime < CHARGE_END - 0.05) {
        video.pause();
        video.currentTime = CHARGE_END;
        video.addEventListener("seeked", playRelease, { once: true });
        return;
      }
      playRelease();
    };
    video.addEventListener("ended", finish);
    if (video.readyState >= 2) startRelease();
    else video.addEventListener("loadeddata", startRelease, { once: true });
    const fallback = window.setTimeout(finish, 2200);
    return () => {
      video.removeEventListener("ended", finish);
      video.removeEventListener("loadeddata", startRelease);
      video.removeEventListener("seeked", playRelease);
      window.clearTimeout(fallback);
    };
  }, [clip, playId]);

  return (
    <div className="pointer-events-none absolute bottom-0 left-6 z-[12] h-[min(48vh,460px)] w-max">
      <video
        ref={videoRef}
        className="h-full w-auto max-w-[min(52vw,640px)] object-contain object-left-bottom"
        muted
        playsInline
        preload="auto"
        poster="/archery/bear-bow.png"
        disablePictureInPicture
      >
        <source src="/archery/bear-bow.webm" type="video/webm" />
      </video>
    </div>
  );
}
