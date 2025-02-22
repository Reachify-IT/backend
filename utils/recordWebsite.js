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
    const scrollStep = window.innerHeight / 1.3; // Faster scrolling
    let currentPosition = 0;

    while (currentPosition < totalHeight) {
      window.scrollBy(0, scrollStep);
      await new Promise((resolve) => setTimeout(resolve, 150)); // Shorter delay
      currentPosition += scrollStep;
    }

    // Pause briefly at bottom
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Scroll back up
    while (currentPosition > 0) {
      window.scrollBy(0, -scrollStep);
      await new Promise((resolve) => setTimeout(resolve, 150));
      currentPosition -= scrollStep;
    }
  });

  // Reduce pause time at top
  await new Promise((resolve) => setTimeout(resolve, 800));
};

/**
 * Record Website and Save Video
 * @param {string} webUrl - The website URL to record
 * @param {string} outputDir - Directory to save the video
 * @returns {Promise<string|null>} - Path to the recorded video or `null` if failed
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
    args: ["--disable-gpu", "--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // ✅ Set timeouts to prevent crashes
  await page.setDefaultNavigationTimeout(0); // Remove Puppeteer's default timeout
  await page.setDefaultTimeout(0); // Remove other timeouts

  try {
    console.log(`🌍 Navigating to ${webUrl}...`);
    
    // ✅ Custom timeout to avoid infinite waiting
    const timeoutLimit = 45000; // 45 seconds max
    const pageLoadPromise = page.goto(webUrl, { waitUntil: "load" });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("⏳ Website took too long to load")), timeoutLimit)
    );

    await Promise.race([pageLoadPromise, timeoutPromise]);

    const outputPath = path.join(outputDir, `web_${Date.now()}.mp4`);
    const recorder = new PuppeteerScreenRecorder(page, {
      followNewTab: true,
      fps: 30,
      videoFrame: {
        width: 1280,
        height: 720,
      },
      autopadDuration: 2, // Reduce extra padding duration
    });

    console.log(`🎥 Recording started: ${webUrl}`);
    await recorder.start(outputPath);

    // Smoothly scroll the entire website
    await smoothScroll(page);

    // Stop recording and close browser
    await recorder.stop();
    await browser.close();

    console.log(`✅ Recording saved: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`❌ Failed to record ${webUrl}:`, error.message);
    await browser.close();
    return null;
  }
};

module.exports = recordWebsite;
