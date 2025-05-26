const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const url = require('url');
// Import the search and scrape functions
const { searchAnime } = require('./search');
const { scrapeAnimeEpisodes } = require('./script');

// MIME types for serving files
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
};

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle POST requests
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      // Search anime endpoint
      if (req.url === '/search-anime') {
        try {
          const requestData = JSON.parse(body);
          const query = requestData.query || '';
          
          // Call the search function from the imported module
          searchAnime(query)
            .then(searchResults => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(searchResults));
            })
            .catch(error => {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: error.message }));
            });
        } catch (error) {
          res.writeHead(500);
          res.end(error.toString());
        }
      }
      // Load anime endpoint
      else if (req.url === '/load-anime') {
        try {
          const requestData = JSON.parse(body);
          const animeId = requestData.id || '';
          const fetchVideos = requestData.fetchVideos || false;
          
          // Call the scraping function with the fetchVideos parameter
          scrapeAnimeEpisodes(animeId, fetchVideos)
            .then(success => {
              if (success && fs.existsSync('episodes.json')) {
                const episodesData = JSON.parse(fs.readFileSync('episodes.json', 'utf8'));
                if (episodesData.episodes && episodesData.episodes.length > 0) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: true,
                    message: 'Episodes loaded successfully'
                  }));
                  return;
                }
              }
              
              // If we get here, something went wrong
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                message: 'Failed to load episodes'
              }));
            })
            .catch(error => {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                message: error.toString()
              }));
            });
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            message: error.toString()
          }));
        }
      }
      // New endpoint to load a specific episode
      else if (req.url === '/load-episode') {
        try {
          const requestData = JSON.parse(body);
          const animeId = requestData.animeId || '';
          const episodeLink = requestData.episodeLink || '';
          const episodeNumber = requestData.episodeNumber || '';
          
          if (!animeId || !episodeLink) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              message: 'Missing required parameters'
            }));
            return;
          }
          
          // Import the function to get a single episode
          const { getEpisodeVideoSource } = require('./script');
          
          getEpisodeVideoSource(animeId, episodeLink, episodeNumber)
            .then(videoData => {
              if (videoData && videoData.videoUrl) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  videoUrl: videoData.videoUrl
                }));
              } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  message: 'Video source not found'
                }));
              }
            })
            .catch(error => {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                message: error.toString()
              }));
            });
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            message: error.toString()
          }));
        }
      }
      else {
        res.writeHead(404);
        res.end();
      }
    });
  }
  // Handle GET requests (serve static files)
  else if (req.method === 'GET') {
    // Parse URL
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    
    // Normalize pathname to serve index.html for root
    if (pathname === '/') {
      pathname = '/index.html';
    }
    
    // Get the file path
    const filePath = path.join(__dirname, pathname);
    const extname = path.extname(filePath);
    
    // Default content type
    let contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // Read the file
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          // File not found
          res.writeHead(404);
          res.end('File not found');
        } else {
          // Server error
          res.writeHead(500);
          res.end('Server Error: ' + error.code);
        }
      } else {
        // Success
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }
});

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});