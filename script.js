// Yelp Visualization Scripts!

// Initialize map centered on Santa Barbara
const map = L.map('map').setView([34.4208, -119.6982], 12);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

let businessData = [];
let filteredData = [];
let businessDataInRange = [];
let myCurrentLocation = [34.4208, -119.6982];
let userInputRadius = 4000; // Initial radius so the circle border is visible but not full screen
let currentLocationMarker;

let minRadius = 100;
let maxRadius = 4000;

// Fetch and store JSON data
fetch('../data/processed/ca_restaurants.json')
    .then(response => response.json())
    .then(data => {
        businessData = data;
        maxRadius = getInitialRadius();
        userInputRadius = maxRadius;
        document.getElementById('radiusRange').max = radiusToSlider(maxRadius);
        document.getElementById('radiusRange').value = radiusToSlider(userInputRadius);
        document.getElementById('radiusValue').textContent = userInputRadius;

        setupRadiusListener();
        map_plotting();
        map_plotting(); //make sure everything is plotted correctly
    })

// slider value (0–100) -> log-scaled radius (100–4000)
function sliderToRadius(v) {
  const t = v / 100; // 0–1
  const ratio = maxRadius / minRadius;
  const r = minRadius * Math.pow(ratio, t); // exponential interpolation
  return Math.round(r); // optional: round to integer
}

// radius -> slider value (if you ever need to set it from code)
function radiusToSlider(r) {
  const ratio = maxRadius / minRadius;
  const t = Math.log(r / minRadius) / Math.log(ratio); // 0–1
  return Math.round(t * 100);
}



// Listen for changes to the isOpenCheckbox
const isOpenCheckbox = document.getElementById('isOpenCheckbox');
if (isOpenCheckbox) {
    isOpenCheckbox.addEventListener('change', function() {
        map_plotting();
    });
}

function map_plotting() {
    UpdateDataInRange(); 
    // Remove previous marker and circle for current location only
    if (window.currentCircle) {
        map.removeLayer(window.currentCircle);
    }
    if (window.currentLocationMarker) {
        map.removeLayer(window.currentLocationMarker);
    }

    // Draw a circular range around the current location (default pane, thick stroke)
    window.currentCircle = L.circle(myCurrentLocation, {
        radius: userInputRadius,
        color: 'blue',
        weight: 3, // thicker border for visibility
        fillColor: '#30f',
        fillOpacity: 0.05 // more transparent for better marker contrast
    }).addTo(map);

    // Remove and replot business markers every time for correct z-order
    if (window.businessMarkers) {
        window.businessMarkers.forEach(marker => map.removeLayer(marker));
    }
    window.businessMarkers = [];

    // Filter data by isOpen if checked
    filteredData = businessData.filter(business => {
        if (!(business.latitude && business.longitude)) return false;
        if (isOpenCheckbox && isOpenCheckbox.checked) {
            return String(business.is_open) === '1';
        }
        return true;
    });

    filteredData.forEach(business => {
           // Scale radius based on review_count (e.g., 3-15 pixels)
        const reviewCount = business.review_count || 0;
        const markerRadius = Math.min(3 + reviewCount / 50, 15); // scale and cap at 15

        const marker = L.circleMarker([business.latitude, business.longitude], {
            radius: markerRadius,
            color: 'transparent',
            fillColor: 'gray',
            fillOpacity: 0.3 // fixed opacity
        })
        .addTo(map);
        window.businessMarkers.push(marker);
    });

    businessDataInRange.forEach(business => {
        // Map star rating (1-5) to color hue (red=0° to green=120°)
        const stars = business.stars || 1; // default to 1 if missing
        // Map star rating (1-5) to afmhot colormap: 1→black, 5→white/yellow
        const t = (stars - 1) / 4; // normalize to 0-1
        const r = Math.round(255 * Math.pow(t, 0.5)); // black to red/white
        const g = Math.round(255 * Math.pow(t, 1.5)); // slower increase
        const b = 0; // no blue component
        const color = `rgb(${r}, ${g}, ${b})`;
        // Scale radius based on review_count (e.g., 3-15 pixels)
        const reviewCount = business.review_count || 0;
        const markerRadius = Math.min(3 + reviewCount / 50, 15); // scale and cap at 15
        
        const marker = L.circleMarker([business.latitude, business.longitude], {
            radius: markerRadius,
            color: 'transparent',
            fillColor: color,
            fillOpacity: 0.7
        })
        .addTo(map);
        window.businessMarkers.push(marker);
    });

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
        fillOpacity: 0.1
    }).addTo(map);

    filteredData.forEach(business => {
        const marker = L.circleMarker([business.latitude, business.longitude], {
            radius: 8,
            // color: 'gray',
            // fillColor: 'gray',
            color: 'transparent', 
            fillColor: 'transparent',
            fillOpacity: 0 
        })
        .addTo(map)
        .bindPopup(`<b>${business.name}</b><br>Rating: ${business.stars}`);
        window.businessMarkers.push(marker);
    });
}

function setupRadiusListener() {
  const radiusRange = document.getElementById('radiusRange');
  const radiusValue = document.getElementById('radiusValue');

  if (!radiusRange || !radiusValue) return;

  radiusRange.addEventListener('input', function() {
    userInputRadius = parseInt(sliderToRadius(radiusRange.value), 10);
    radiusValue.textContent = userInputRadius;

    map_plotting(); // replot with same global businessData
  });
}


// Filter within the range, and it's not working ;0;
// Function to filter data points within xRadius of myCurrentLocation
function UpdateDataInRange() { 
    businessDataInRange = [];
    filteredData.forEach(business => {
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

// Set initial radius to a visible but not full-screen circle
function getInitialRadius() {
    const bounds = map.getBounds();
    const center = map.getCenter();
    // Get distances to each edge (N, S, E, W)
    const north = getDistanceFromLatLonInMeters(center.lat, center.lng, bounds.getNorth(), center.lng);
    const south = getDistanceFromLatLonInMeters(center.lat, center.lng, bounds.getSouth(), center.lng);
    const east = getDistanceFromLatLonInMeters(center.lat, center.lng, center.lat, bounds.getEast());
    const west = getDistanceFromLatLonInMeters(center.lat, center.lng, center.lat, bounds.getWest());
    const maxDist = Math.max(north, south, east, west);
    return Math.round(maxDist * 0.6); 
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
    const width = 600;
    const height = 400;
    const margin = {top: 20, right: 30, bottom: 30, left: 40};

    // Create SVG container
    const svg = d3.select("#density")
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
        .attr("y", 10)                   // a bit left of the y axis
        .text("Number of restaurants");
}
