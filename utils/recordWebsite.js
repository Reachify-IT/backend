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
    const scrollStep = window.innerHeight / 2; // Slower scrolling for smoothness
    let currentPosition = 0;

    // Smoothly scroll from top to bottom
    while (currentPosition < totalHeight) {
      window.scrollBy(0, scrollStep);
      await new Promise((resolve) => setTimeout(resolve, 200)); // Faster delay
      currentPosition += scrollStep;
    }

    // Pause at bottom
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Reduce pause

    // Smoothly scroll back from bottom to top
    while (currentPosition > 0) {
      window.scrollBy(0, -scrollStep);
      await new Promise((resolve) => setTimeout(resolve, 200));
      currentPosition -= scrollStep;
    }
  });

  // Reduce pause time at top
  await new Promise((resolve) => setTimeout(resolve, 1000));
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

  // ✅ Remove timeout limit
  await page.setDefaultNavigationTimeout(0);
  await page.setDefaultTimeout(0);

  try {
    console.log(`🌍 Navigating to ${webUrl}...`);
    await page.goto(webUrl, { waitUntil: "load" }); // 🛑 Wait until full load

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