const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function scrapeAnimeEpisodes(animeId, fetchVideoSources = false) {
  const episodesData = { episodes: [] };
  let browser = null;
  
  try {
    // Launch browser with additional options
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox']
    });
    
    // Create context with additional headers
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,/;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://kaido.to/'
      }
    });
    
    const page = await context.newPage();
    
    // Disable navigation timeout
    page.setDefaultNavigationTimeout(0);
    
    // Handle dialog events (alerts, confirms, etc.)
    page.on('dialog', dialog => dialog.accept());
    
    // Handle redirects and block ads
    await page.route('**/*', route => {
      const url = route.request().url();
      if (["ads", "analytics", "tracker", "home"].some(domain => url.includes(domain))) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    try {
      console.log(`Loading anime with ID: ${animeId}`);
      await page.goto(`https://kaido.to/watch/${animeId}`, { timeout: 60000 });
      await page.waitForSelector('.ss-list', { timeout: 60000 });
      
      // Get all episode information first to display total count
      const episodes = await page.$$('.ss-list a');
      console.log(`\nFound ${episodes.length} episodes`);
      
      // Store the total episode count
      const totalEpisodes = episodes.length;
      
      // First, collect all episode titles and links
      const episodeInfo = [];
      for (let i = 0; i < episodes.length; i++) {
        try {
          const ep = episodes[i];
          const epNum = await ep.innerText();
          const epLink = await ep.getAttribute('href');
          
          if (epLink) {
            // Extract the episode ID from the link
            // The link format should be like "/watch/animeId?ep=12345"
            let episodeId = '';
            if (epLink.includes('?ep=')) {
              episodeId = epLink.split('?ep=')[1];
            } else if (epLink.includes('&ep=')) {
              episodeId = epLink.split('&ep=')[1].split('&')[0];
            }
            
            episodeInfo.push({
              number: epNum,
              link: epLink,
              episodeId: episodeId,
              index: i
            });
            console.log(`Episode ${i+1}/${episodes.length}: ${epNum} (ID: ${episodeId})`);
          }
        } catch (e) {
          console.log(`Error getting episode info: ${e.message}`);
        }
      }
      
      // Save episode titles first
      for (const episode of episodeInfo) {
        episodesData.episodes.push({
          number: episode.number,
          videoUrl: "", // Empty for now
          episodeId: episode.episodeId, // Store the episode ID
          totalEpisodes: totalEpisodes
        });
      }
      
      // Save episodes data to JSON file with just titles
      fs.writeFileSync('episodes.json', JSON.stringify(episodesData, null, 2));
      console.log(`\nSuccessfully saved ${episodesData.episodes.length} episode titles`);
      
      // If fetchVideoSources is true, then process video sources
      if (fetchVideoSources && episodeInfo.length > 0) {
        console.log("\nNow fetching video sources...");
        
        // Process video sources for each episode
        for (let i = 0; i < episodeInfo.length; i++) {
          try {
            const episode = episodeInfo[i];
            const fullLink = `https://kaido.to${episode.link}`;
            console.log(`Processing video for Episode ${episode.number}... (${i+1}/${episodeInfo.length})`);
            
            // Create a new page for the episode
            const episodePage = await context.newPage();
            
            // Navigate with retry
            let success = false;
            for (let attempt = 0; attempt < 5; attempt++) {
              try {
                await episodePage.goto(fullLink, { timeout: 20000 });
                await episodePage.waitForSelector('iframe#iframe-embed', { timeout: 20000 });
                success = true;
                break;
              } catch (error) {
                console.log(`Retrying episode ${episode.number}...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
            
            if (success) {
              const videoSrc = await episodePage.locator('iframe#iframe-embed').getAttribute('src');
              
              if (videoSrc) {
                // Add autoplay parameter if not already present
                const autoplayUrl = videoSrc.includes('autoPlay=') ? 
                  videoSrc : 
                  videoSrc + (videoSrc.includes('?') ? '&autoPlay=1' : '?autoPlay=1');
                
                // Update the episode data with the video URL
                episodesData.episodes[i].videoUrl = autoplayUrl;
                console.log(`Successfully processed video for Episode ${episode.number}`);
              } else {
                console.log(`No video source found for episode ${episode.number}`);
              }
            }
            
            // Close the episode page
            await episodePage.close();
            
            // Update the JSON file after each episode to save progress
            fs.writeFileSync('episodes.json', JSON.stringify(episodesData, null, 2));
            
          } catch (e) {
            console.log(`Error processing episode video: ${e.message}`);
          }
        }
      }
      
      return true;
    } catch (e) {
      console.log(`Error during scraping: ${e.message}`);
      return false;
    }
  } catch (e) {
    console.log(`Critical error: ${e.message}`);
    return false;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore errors during browser closing
      }
    }
  }
  
  return true;
}

// Add this function to the script.js file, before the module.exports line

// Helper function to clean URLs
function cleanUrl(url) {
    // Remove ?ref=search parameter if present
    if (url.includes('?ref=search')) {
        url = url.replace('?ref=search', '');
    }
    return url;
}

// Use this function when constructing URLs in getEpisodeVideoSource
async function getEpisodeVideoSource(animeId, episodeLink, episodeNumber) {
  let browser = null;
  
  try {
    // Launch browser with additional options
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox']
    });
    
    // Create context with additional headers
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,/;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://kaido.to/'
      }
    });
    
    const page = await context.newPage();
    
    // Disable navigation timeout
    page.setDefaultNavigationTimeout(0);
    
    // Handle dialog events (alerts, confirms, etc.)
    page.on('dialog', dialog => dialog.accept());
    
    // Handle redirects and block ads
    await page.route('**/*', route => {
      const url = route.request().url();
      if (["ads", "analytics", "tracker", "home"].some(domain => url.includes(domain))) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    console.log(`Loading episode: ${episodeNumber} for anime: ${animeId}`);
    // Clean the URL to remove ?ref=search
    const cleanedLink = cleanUrl(episodeLink);
    const fullLink = `https://kaido.to${cleanedLink}`;
    console.log(`Navigating to: ${fullLink}`);
    
    // Navigate with retry
    let success = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await page.goto(fullLink, { timeout: 30000 });
        await page.waitForSelector('iframe#iframe-embed', { timeout: 30000 });
        success = true;
        break;
      } catch (error) {
        console.log(`Retrying episode ${episodeNumber}... (Attempt ${attempt + 1}/5)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!success) {
      throw new Error(`Failed to load episode ${episodeNumber} after multiple attempts`);
    }
    
    const videoSrc = await page.locator('iframe#iframe-embed').getAttribute('src');
    
    if (!videoSrc) {
      throw new Error(`No video source found for episode ${episodeNumber}`);
    }
    
    // Add autoplay parameter if not already present
    const autoplayUrl = videoSrc.includes('autoPlay=') ? 
      videoSrc : 
      videoSrc + (videoSrc.includes('?') ? '&autoPlay=1' : '?autoPlay=1');
    
    console.log(`Successfully processed video for Episode ${episodeNumber}`);
    
    // Update the episodes.json file if it exists
    try {
      if (fs.existsSync('episodes.json')) {
        const episodesData = JSON.parse(fs.readFileSync('episodes.json', 'utf8'));
        
        // Find the episode by number and update its videoUrl
        const episodeIndex = episodesData.episodes.findIndex(ep => ep.number === episodeNumber);
        if (episodeIndex !== -1) {
          episodesData.episodes[episodeIndex].videoUrl = autoplayUrl;
          fs.writeFileSync('episodes.json', JSON.stringify(episodesData, null, 2));
        }
      }
    } catch (error) {
      console.log(`Warning: Could not update episodes.json: ${error.message}`);
    }
    
    return { videoUrl: autoplayUrl };
  } catch (error) {
    console.error(`Error getting episode video source: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore errors during browser closing
      }
    }
  }
}

// Update the module.exports line to include the new function
module.exports = { scrapeAnimeEpisodes, getEpisodeVideoSource };
// If this script is run directly
if (require.main === module) {
  // Get anime ID from command line argument or use default
  const animeId = process.argv[2] || "bleach";
  // Get whether to fetch video sources from command line argument
  const fetchVideos = process.argv[3] === "true";
  
  scrapeAnimeEpisodes(animeId, fetchVideos)
    .then(success => {
      if (!success) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
