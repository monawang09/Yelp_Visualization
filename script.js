// Yelp Visualization Scripts!

// Initialize map centered on Santa Barbara
const map = L.map('map').setView([34.4208, -119.6982], 12);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

let businessData = [];
let businessDataInRange = [];
let myCurrentLocation = [34.4208, -119.6982];
let userInputRadius = 500; // Default radius

// Fetch and store JSON data
fetch('../data/processed/ca_restaurants.json')
    .then(response => response.json())
    .then(data => {
        businessData = data;
        setupRadiusListener();

        map_plotting();
    })


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
    UpdateDataInRange(); 
}

function setupRadiusListener() {
  const radiusRange = document.getElementById('radiusRange');
  const radiusValue = document.getElementById('radiusValue');

  if (!radiusRange || !radiusValue) return;

  radiusRange.addEventListener('input', function() {
    userInputRadius = parseInt(radiusRange.value, 10);
    radiusValue.textContent = userInputRadius;

    map_plotting(); // replot with same global businessData
  });
}


// Filter within the range, and it's not working ;0;
// Function to filter data points within xRadius of myCurrentLocation
function UpdateDataInRange() { 
    businessDataInRange = [];
    businessData.forEach(business => {
        if (business.latitude && business.longitude) {
            const distance = getDistanceFromLatLonInMeters(
                myCurrentLocation[0], myCurrentLocation[1],
                parseFloat(business.latitude), parseFloat(business.longitude)
            );
            if (distance <= userInputRadius) {
                businessDataInRange.push(business);
            }
        }
    });
    console.log("Businesses in range:", businessDataInRange.length);
    plot_reviewdensity();
}

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

function plot_reviewdensity() {
    // remove the previous chart (only the ones with this class)
    d3.selectAll("svg.review-density").remove();

    rawData = businessDataInRange.map(d => +d.review_count);

    const cutoff = 700;
    const bin_width = 100;

    // Clamp values above 1000 into the 1000+ bin
    data = rawData.map(d => Math.min(d, cutoff+bin_width));

    // Set up dimensions and margins
    const width = 800;
    const height = 400;
    const margin = {top: 20, right: 30, bottom: 30, left: 40};

    // Create SVG container
    const svg = d3.select("body")
        .append("svg")
        .attr("class", "review-density")
        .attr("width", width)
        .attr("height", height);

    // X scale only goes up to 1000
    x = d3.scaleLinear()
        .domain([0, cutoff+bin_width]).nice()
        .range([margin.left, width - margin.right]);

    // Histogram on the *clamped* data
    bins = d3.bin()
        .domain(x.domain())
        .thresholds(cutoff/bin_width+1)(data);

    // Y scale
    y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)]).nice()
        .range([height - margin.bottom, margin.top]);

    // Draw bars
    svg.append("g")
        .attr("fill", "steelblue")
        .selectAll("rect")
        .data(bins)
        .join("rect")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => y(0) - y(d.length));

    // X axis: show "1000+" at the end
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(
        d3.axisBottom(x)
            .ticks(10)
            .tickFormat(d => d === cutoff+bin_width ? cutoff.toString()+"+" : d)
        );

    // Y axis
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

    // X axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("x", (width) / 2)
        .attr("y", height)           // a bit below the x axis
        .text("Review count");

    // Y axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", - (height / 2))
        .attr("y", 15)                   // a bit left of the y axis
        .text("Number of restaurants");
}
