// Yelp Visualization Scripts!

// Initialize map centered on Santa Barbara
const map = L.map('map').setView([34.4208, -119.6982], 12);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

let businessData = [];
let myCurrentLocation = [34.4208, -119.6982];
let userInputRadius = 500; // Default radius

// Fetch and store JSON data
fetch('../data/processed/ca_restaurants.json')
    .then(response => response.json())
    .then(data => {
        businessData = data;
        map_plotting();
    })

console.log(businessData.length);

let currentLocationMarker;

function map_plotting() {
    // Remove previous marker and circle for current location only
    if (window.currentCircle) {
        map.removeLayer(window.currentCircle);
    }
    if (window.currentLocationMarker) {
        map.removeLayer(window.currentLocationMarker);
    }

    // Only plot business markers once
    if (!window.businessMarkers) {
        window.businessMarkers = [];
        businessData.forEach(business => {
            if (business.latitude && business.longitude) {
                const marker = L.circleMarker([business.latitude, business.longitude], {
                    radius: 8,
                    color: 'gray',
                    fillColor: 'gray',
                    fillOpacity: 0.7
                })
                .addTo(map)
                .bindPopup(`<b>${business.name}</b><br>Rating: ${business.stars}`);
                window.businessMarkers.push(marker);
            }
        });
    }

    // Draw a circular range around the current location
    window.currentCircle = L.circle(myCurrentLocation, {
        radius: userInputRadius,
        color: 'blue',
        fillColor: '#30f',
        fillOpacity: 0.2
    }).addTo(map);

    // Plot my current location with a draggable Leaflet marker
    window.currentLocationMarker = L.marker(myCurrentLocation, {
        draggable: true,
        title: 'Drag me to change location'
    })
    .addTo(map)
    .bindPopup('Drag me to change current location')
    .openPopup();

    window.currentLocationMarker.on('dragend', function(e) {
        const newPos = e.target.getLatLng();
        myCurrentLocation = [newPos.lat, newPos.lng];
        map_plotting(); // Re-plot everything with new location
    });

    // Update circle based on new user input radius

    if (window.currentCircle) {
        map.removeLayer(window.currentCircle);
    }
    window.currentCircle = L.circle(myCurrentLocation, {
        radius: userInputRadius,
        color: 'blue',
        fillColor: '#30f',
        fillOpacity: 0.2
    }).addTo(map);
}


// Listen for changes to the radius slider
const radiusRange = document.getElementById('radiusRange');
const radiusValue = document.getElementById('radiusValue');
if (radiusRange && radiusValue) {
    radiusRange.addEventListener('input', function() {
        userInputRadius = parseInt(radiusRange.value);
        radiusValue.textContent = userInputRadius;
        console.log("hi");
        map_plotting(); // replot
    });
}


// Filter within the range, and it's not working ;0;
// Function to filter data points within xRadius of myCurrentLocation
function filterWithinRadius(radius) {
    const filteredRestaurants = [];
    businessData.forEach(business => {
        if (business.latitude && business.longitude) {
            const distance = getDistanceFromLatLonInMeters(
                myCurrentLocation[0], myCurrentLocation[1],
                parseFloat(business.latitude), parseFloat(business.longitude)
            );
            if (distance <= radius) {
                filteredRestaurants.push(business);
            }
        }
    });
    return filteredRestaurants;
}

console.log(filterWithinRadius(500));

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
}
