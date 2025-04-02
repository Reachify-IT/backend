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

    const smoothMove = async (direction) => {
      let pauseCounter = 0;
      let maxPauses = 3; // Max number of pauses
      let slowDownThreshold = totalHeight * 0.2; // Slow down in last 20% of the scroll
    
      while (scrollingDown ? currentPosition < totalHeight : currentPosition > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        let remainingDistance = scrollingDown ? totalHeight - currentPosition : currentPosition;
        let speedFactor = remainingDistance < slowDownThreshold ? 0.5 : 1; // Slow down near end
    
        window.scrollBy(0, direction * scrollStep * speedFactor);
        currentPosition += direction * scrollStep * speedFactor;
    
        // Simulate small natural pauses
        if (Math.random() > 0.6) {
          await new Promise((resolve) => setTimeout(resolve, getRandomDelay() * 1.5));
        }
    
        // Simulate a longer pause (like getting distracted)
        if (Math.random() > 0.9 && pauseCounter < maxPauses) {
          pauseCounter++;
          console.log("Pausing for a moment... 🧍‍♂️");
          await new Promise((resolve) => setTimeout(resolve, getRandomDelay() * 4));
        }
    
        // Adjust scroll step dynamically
        scrollStep = getScrollStep() * (0.8 + Math.random() * 0.4); // Random variation in step size
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