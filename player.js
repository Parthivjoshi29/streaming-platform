// Global variables
let currentEpisodeIndex = 0;
let episodes = [];

// DOM elements
const videoFrame = document.getElementById('video-frame');
const currentEpisodeSpan = document.getElementById('current-episode');
const searchButton = document.getElementById('searchButton');
const animeSearchInput = document.getElementById('animeSearch');
const searchResultsDiv = document.getElementById('searchResults');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');

// Event listeners
searchButton.addEventListener('click', searchAnime);
prevButton.addEventListener('click', previousEpisode);
nextButton.addEventListener('click', nextEpisode);

// Load episode function
function loadEpisode(index) {
    if (index >= 0 && index < episodes.length) {
        currentEpisodeIndex = index;
        const episode = episodes[currentEpisodeIndex];
        videoFrame.src = episode.videoUrl; // This URL now includes autoPlay parameter
        currentEpisodeSpan.textContent = episode.number;
    }
}

// Navigation functions
function previousEpisode() {
    loadEpisode(currentEpisodeIndex - 1);
}

function nextEpisode() {
    loadEpisode(currentEpisodeIndex + 1);
}

// Toast notification function
function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Search anime function
async function searchAnime() {
    try {
        const animeName = animeSearchInput.value.trim();
        if (!animeName) {
            showToast('Please enter an anime name');
            return;
        }
        
        // Show loading state
        searchButton.disabled = true;
        searchButton.textContent = 'Searching...';
        
        // Call the search endpoint
        const response = await fetch('/search-anime', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: animeName })
        });
        
        if (!response.ok) {
            throw new Error('Failed to search anime');
        }
        
        const results = await response.json();
        displaySearchResults(results);
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Error searching anime. Please try again.');
    } finally {
        searchButton.disabled = false;
        searchButton.textContent = 'Search';
    }
}

// Display search results
function displaySearchResults(results) {
    searchResultsDiv.innerHTML = '';
    searchResultsDiv.style.display = 'block';
    
    if (results.length === 0) {
        searchResultsDiv.innerHTML = '<p>No results found. Try a different search term.</p>';
        return;
    }
    
    results.forEach(anime => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.textContent = anime.title;
        resultItem.onclick = () => loadAnime(anime.id, anime.title);
        searchResultsDiv.appendChild(resultItem);
    });
}

// Load anime function
async function loadAnime(animeId, animeTitle) {
    try {
        searchResultsDiv.style.display = 'none';
        
        const episodeInfo = document.getElementById('episode-info');
        episodeInfo.textContent = `Loading episodes for ${animeTitle}...`;
        
        // First, just get the episode titles (fetchVideos = false)
        const response = await fetch('/load-anime', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                id: animeId, 
                title: animeTitle,
                fetchVideos: false 
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to load anime');
        }
        
        // Wait for the scraping to complete
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to process episodes');
        }
        
        // Add delay to ensure file is written
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Read the output file
        const episodesResponse = await fetch('episodes.json');
        if (!episodesResponse.ok) {
            throw new Error('Failed to load episodes data');
        }
        
        const data = await episodesResponse.json();
        if (!data.episodes || data.episodes.length === 0) {
            throw new Error('No episodes found');
        }
        
        episodes = data.episodes;
        
        // Display episode list instead of immediately loading the first episode
        displayEpisodeList(episodes, animeTitle, animeId);
        
        // Display episode info with total count if available
        const totalEpisodes = episodes[0].totalEpisodes || 'unknown';
        episodeInfo.textContent = `${animeTitle} - Total Episodes: ${totalEpisodes}`;
        
    } catch (error) {
        console.error('Error:', error);
        showToast(error.message || 'Error loading episodes. Please try again.');
        
        const episodeInfo = document.getElementById('episode-info');
        episodeInfo.textContent = 'Current Episode: -';
    }
}

// New function to display episode list
// Update the displayEpisodeList function to store episode links

function displayEpisodeList(episodes, animeTitle, animeId) {
    // Create a container for episodes if it doesn't exist
    let episodeListDiv = document.getElementById('episode-list');
    if (!episodeListDiv) {
        episodeListDiv = document.createElement('div');
        episodeListDiv.id = 'episode-list';
        episodeListDiv.className = 'episode-list';
        // Insert after search results
        searchResultsDiv.parentNode.insertBefore(episodeListDiv, searchResultsDiv.nextSibling);
    }
    
    // Clear previous episodes
    episodeListDiv.innerHTML = '';
    
    // Add title
    const titleElement = document.createElement('h3');
    titleElement.textContent = `${animeTitle} Episodes`;
    episodeListDiv.appendChild(titleElement);
    
    // Create a grid container for episodes
    const gridContainer = document.createElement('div');
    gridContainer.className = 'episode-grid';
    episodeListDiv.appendChild(gridContainer);
    
    // Add each episode as a clickable button
    episodes.forEach((episode, index) => {
        const episodeButton = document.createElement('button');
        episodeButton.className = 'episode-button';
        episodeButton.textContent = `Episode ${episode.number.split('\n')[0]}`;
        episodeButton.onclick = () => {
            // Store the anime ID in localStorage for the episode player
            localStorage.setItem('currentAnimeId', animeId);
            
            // Store any episodeId if available
            if (episode.episodeId) {
                localStorage.setItem('currentEpisodeId', episode.episodeId);
            }
            
            // Open the episode player page with the selected episode
            window.location.href = `episode-player.html?episode=${index}&title=${encodeURIComponent(animeTitle)}`;
        };
        gridContainer.appendChild(episodeButton);
    });
    
    // Show the episode list
    episodeListDiv.style.display = 'block';
}

// Update the loadAnime function to pass the animeId to displayEpisodeList
async function loadAnime(animeId, animeTitle) {
    try {
        searchResultsDiv.style.display = 'none';
        
        const episodeInfo = document.getElementById('episode-info');
        episodeInfo.textContent = `Loading episodes for ${animeTitle}...`;
        
        // First, just get the episode titles (fetchVideos = false)
        const response = await fetch('/load-anime', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                id: animeId, 
                title: animeTitle,
                fetchVideos: false 
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to load anime');
        }
        
        // Wait for the scraping to complete
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to process episodes');
        }
        
        // Add delay to ensure file is written
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Read the output file
        const episodesResponse = await fetch('episodes.json');
        if (!episodesResponse.ok) {
            throw new Error('Failed to load episodes data');
        }
        
        const data = await episodesResponse.json();
        if (!data.episodes || data.episodes.length === 0) {
            throw new Error('No episodes found');
        }
        
        episodes = data.episodes;
        
        // Store the current anime ID
        localStorage.setItem('currentAnimeId', animeId);
        
        // Display episode list instead of immediately loading the first episode
        displayEpisodeList(episodes, animeTitle, animeId);
        
        // Display episode info with total count if available
        const totalEpisodes = episodes[0].totalEpisodes || 'unknown';
        episodeInfo.textContent = `${animeTitle} - Total Episodes: ${totalEpisodes}`;
        
    } catch (error) {
        console.error('Error:', error);
        showToast(error.message || 'Error loading episodes. Please try again.');
        
        const episodeInfo = document.getElementById('episode-info');
        episodeInfo.textContent = 'Current Episode: -';
    }
}

// Add a new function to load video sources
async function loadVideoSources(animeId, animeTitle) {
    try {
        showToast('Loading video sources. This may take a while...', 'info');
        
        const response = await fetch('/load-anime', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                id: animeId, 
                title: animeTitle,
                fetchVideos: true 
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to load video sources');
        }
        
        const result = await response.json();
        if (result.success) {
            showToast('Video sources loaded successfully', 'success');
            
            // Reload episodes data
            const episodesResponse = await fetch('episodes.json');
            if (episodesResponse.ok) {
                const data = await episodesResponse.json();
                episodes = data.episodes;
            }
        } else {
            throw new Error(result.message || 'Failed to load video sources');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast(error.message || 'Error loading video sources', 'error');
    }
}