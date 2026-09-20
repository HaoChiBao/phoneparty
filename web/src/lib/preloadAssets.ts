const VIDEO = /\.(mp4|webm|mov)(\?|$)/i;
const ASSET_MS = 8000;

function preloadOne(src: string) {
  if (VIDEO.test(src)) {
    return new Promise<void>((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      const done = () => {
        window.clearTimeout(timer);
        video.removeEventListener("canplaythrough", done);
        video.removeEventListener("error", done);
        resolve();
      };
      const timer = window.setTimeout(done, ASSET_MS);
      video.addEventListener("canplaythrough", done);
      video.addEventListener("error", done);
      video.src = src;
      video.load();
    });
  }

  return new Promise<void>((resolve) => {
    const image = new Image();
    const done = () => {
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve();
    };
    const timer = window.setTimeout(done, ASSET_MS);
    image.onload = done;
    image.onerror = done;
    image.src = src;
  });
}

export async function preloadAssets(
  srcs: string[],
  onProgress?: (percent: number) => void,
) {
  const list = [...new Set(srcs)];
  if (list.length === 0) {
    onProgress?.(100);
    return;
  }

  let done = 0;
  await Promise.all(
    list.map(async (src) => {
      await preloadOne(src);
      done += 1;
      onProgress?.(Math.round((done / list.length) * 100));
    }),
  );
}
