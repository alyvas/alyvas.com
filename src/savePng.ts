/** Renders a canvas to a PNG and hands it to the browser as a download. */
export const savePng = (canvas: HTMLCanvasElement, name: string) =>
  new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      // Revoking straight away can cancel the download in some browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      resolve();
    }, 'image/png');
  });
