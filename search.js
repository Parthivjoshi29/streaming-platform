const axios = require('axios');
const cheerio = require('cheerio');

async function searchAnime(query) {
  try {
    const url = `https://kaido.to/search?keyword=${query}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,/;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://kaido.to/'
    };
    
    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);
    
    const results = [];
    $('.flw-item').each((index, element) => {
      try {
        const linkElem = $(element).find('.film-name a');
        if (linkElem.length) {
          const link = linkElem.attr('href');
          const title = linkElem.text().trim();
          const animeId = link.split('/').pop();
          results.push({
            id: animeId,
            title: title
          });
        }
      } catch (e) {
        // Skip this item if there's an error
      }
    });
    
    return results;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return [];
  }
}

// Export the function if this file is required as a module
module.exports = { searchAnime };

// If this script is run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const query = args[0];
    searchAnime(query)
      .then(results => {
        results.forEach(result => {
          console.log(`${result.id}|${result.title}`);
        });
      })
      .catch(error => {
        console.error(error);
      });
  }
}