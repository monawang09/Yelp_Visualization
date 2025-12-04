// Yelp Visualization Scripts!

// Initialize map centered on San Francisco
const map = L.map('map').setView([34.4208, -119.6982], 12);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

let businessData = [];

// Fetch and store JSON data
fetch('../data/processed/ca_restaurants.json')
    .then(response => response.json())
    .then(data => {
        businessData = data;
        map_plotting();
    })

console.log(businessData.length);

function map_plotting() {
    businessData.forEach(business => {
        if (business.latitude && business.longitude) {
            L.marker([business.latitude, business.longitude])
                .addTo(map)
                .bindPopup(`<b>${business.name}</b><br>Rating: ${business.stars}`);
        }
    });
}
