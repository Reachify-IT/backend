const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegStatic);

const mergeVideos = (webPath, camPath, outputPath, cameraSettings) => {
  return new Promise((resolve, reject) => {
    const { position, size } = cameraSettings;

    // Define size scaling based on user preference
    let scaleFactor;
    switch (size) {
      case "small":
        scaleFactor = 0.10; // 1/4 of main video
        break;
      case "medium":
        scaleFactor = 0.20;
        break;
      case "large":
        scaleFactor = 0.25;
        break;
      default:
        scaleFactor = 0.07; // Default to small
    }

    // Define overlay position dynamically
    let overlayX, overlayY;
    switch (position) {
      case "top-left":
        overlayX = 10;
        overlayY = 10;
        break;
      case "top-right":
        overlayX = "W-w-10";
        overlayY = 10;
        break;
      case "bottom-left":
        overlayX = 10;
        overlayY = "H-h-10";
        break;
      case "bottom-right":
        overlayX = "W-w-10";
        overlayY = "H-h-10";
        break;
      case "center":
        overlayX = "(W-w)/2";
        overlayY = "(H-h)/2";
        break;
      default:
        overlayX = "W-w-10"; // Default to top-right
        overlayY = 10;
    }

    ffmpeg()
      .input(webPath) // Main video
      .input(camPath) // Overlay video (Camera feed)
      .complexFilter([
        `[1:v]scale=iw*${scaleFactor}:ih*${scaleFactor}[overlay]; [0:v][overlay]overlay=${overlayX}:${overlayY}`
      ])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
};

module.exports = mergeVideos;
