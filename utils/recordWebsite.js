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
    let currentPosition = 0;
    let scrollStep = window.innerHeight * 0.3; // Start with a smaller step
    let scrollingDown = true;

    const getRandomDelay = () => Math.random() * 600 + 400; // Random delay between 400-1000ms
    const getScrollStep = () => Math.random() * window.innerHeight * 0.3 + window.innerHeight * 0.2; // Vary scroll step size

    // Smooth scrolling function
    const smoothMove = async (direction) => {
      while (scrollingDown ? currentPosition < totalHeight : currentPosition > 0) {
        window.scrollBy(0, direction * scrollStep);
        currentPosition += direction * scrollStep;

        // Simulate human reading behavior
        if (Math.random() > 0.7) {
          await new Promise((resolve) => setTimeout(resolve, getRandomDelay()));
        }

        scrollStep = getScrollStep(); // Adjust step size dynamically
        await new Promise((resolve) => setTimeout(resolve, getRandomDelay() / 2));
      }
    };

    // Scroll down
    await smoothMove(1);

    // Pause at the bottom
    await new Promise((resolve) => setTimeout(resolve, getRandomDelay() * 2));

    // Scroll back up
    scrollingDown = false;
    await smoothMove(-1);
  });

  // Pause at the top before ending
  await new Promise((resolve) => setTimeout(resolve, 1500));
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
    headless: true,
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