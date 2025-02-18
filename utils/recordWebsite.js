const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const { PuppeteerScreenRecorder } = require("puppeteer-screen-recorder");

/**
 * Smoothly Scrolls the Page from Top to Bottom and Back
 */
const smoothScroll = async (page) => {
  await page.evaluate(async () => {
    const totalHeight = document.body.scrollHeight;
    const scrollStep = window.innerHeight / 2; // Scroll half of viewport height per step
    let currentPosition = 0;

    while (currentPosition < totalHeight) {
      window.scrollBy(0, scrollStep);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Smooth delay
      currentPosition += scrollStep;
    }

    // Pause at bottom
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Scroll back up
    while (currentPosition > 0) {
      window.scrollBy(0, -scrollStep);
      await new Promise((resolve) => setTimeout(resolve, 500));
      currentPosition -= scrollStep;
    }
  });

  // Pause at top before stopping recording
  await new Promise((resolve) => setTimeout(resolve, 2000));
};

/**
 * Record Website and Save Video
 * @param {string} webUrl - The website URL to record
 * @param {string} outputDir - Directory to save the video
 * @returns {Promise<string>} - Path to the recorded video
 */
const recordWebsite = async (webUrl, outputDir) => {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Launch Puppeteer browser
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-fullscreen"],
  });

  const page = await browser.newPage();
  await page.goto(webUrl, { waitUntil: "networkidle2" });

  const outputPath = path.join(outputDir, `web_${Date.now()}.mp4`);
  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: true,
    fps: 30,
    videoFrame: {
      width: 1280,
      height: 720,
    },
    autopadDuration: 3,
  });

  console.log(`Recording website: ${webUrl}`);
  await recorder.start(outputPath);

  // Smoothly scroll the entire website
  await smoothScroll(page);

  // Stop recording and close browser
  await recorder.stop();
  await browser.close();

  console.log(`Recording saved: ${outputPath}`);
  return outputPath;
};

module.exports = recordWebsite;
