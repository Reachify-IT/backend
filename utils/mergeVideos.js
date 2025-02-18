const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegStatic);

const mergeVideos = (webPath, camPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(webPath) // Main video
      .input(camPath) // Overlay video (Camera feed)
      .complexFilter([
        "[1:v]scale=iw/4:ih/4[overlay]; [0:v][overlay]overlay=W-w-10:H-h-10"
      ])      
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
};

module.exports = mergeVideos;
