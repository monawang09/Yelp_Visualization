// Yelp Visualization Scripts!

// Initialize map centered on San Francisco
const map = L.map('map').setView([37.7749, -122.4194], 13);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// Add a sample marker
L.marker([37.7749, -122.4194]).addTo(map)
    .bindPopup('San Francisco');
