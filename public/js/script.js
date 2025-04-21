window.addEventListener('DOMContentLoaded', () => {
    const markers = {};
    const socket = io();

    // Get room key from URL (partner provides this)
    const urlParams = new URLSearchParams(window.location.search);
    let roomKey = urlParams.get('room');
    if (!roomKey) {
        // Generate random room key if none exists
        roomKey = Math.random().toString(36).substring(2, 10); // generate random key
        const newUrl = `${window.location.origin}/join?room=${roomKey}`;
        alert(`Room created! Share this link with your partner:\n\n${newUrl}`);
        window.history.replaceState({}, '', `/join?room=${roomKey}`);
    }

    // Get username input
    const username = prompt("Enter your name:") || "Anonymous";

    // Emit the join event with roomKey and username
    socket.emit('join-room', { username, roomKey, id: socket.id });
    console.log("Room Key: ", roomKey);  // Debug line to check if roomKey is being extracted properly

    const fullLink = `${window.location.origin}/join?room=${roomKey}`;

    // Generate and display QR code
    const qrCanvas = document.createElement('canvas');
    qrCanvas.className = 'qr-code';
    document.body.appendChild(qrCanvas);

    QRCode.toCanvas(qrCanvas, fullLink, function (error) {
        if (error) console.error(error);
        else console.log('QR Code generated!');
    });

    // Create input field for copyable link
    const linkInput = document.createElement('input');
    linkInput.type = 'text';
    linkInput.value = fullLink; // full room link
    linkInput.className = 'room-link-input';
    linkInput.setAttribute('readonly', true);
    document.body.appendChild(linkInput);

    // Create a copy button
    const copyButton = document.createElement('button');
    copyButton.innerText = 'Copy Link';
    copyButton.className = 'copy-button';
    document.body.appendChild(copyButton);

    // Copy functionality
    copyButton.addEventListener('click', () => {
        linkInput.select();
        document.execCommand('copy');
        alert('Link copied to clipboard!');
    });

    // Create room display element for showing room link
    const roomDisplay = document.createElement('div');
    roomDisplay.textContent = `Room Link: ${fullLink}`;
    roomDisplay.className = 'room-link-display';
    document.body.appendChild(roomDisplay);

    // --- Destination Search Feature ---
    let destination = null;

    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = "Enter destination...";
    searchInput.className = 'destination-input';
    document.body.appendChild(searchInput);

    // Create "Set Destination" button
    const setDestButton = document.createElement('button');
    setDestButton.innerText = "📍 I'm going to...";
    setDestButton.className = 'destination-button';
    document.body.appendChild(setDestButton);

    // Destination marker
    let destMarker = null;

    // Handle destination search
    setDestButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (!query) {
            alert("Please enter a destination");
            return;
        }

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    destination = [lat, lon];

                    if (destMarker) {
                        map.removeLayer(destMarker);
                    }

                    destMarker = L.marker(destination).addTo(map).bindPopup("Destination").openPopup();
                    map.setView(destination, 14);
                } else {
                    alert("Location not found");
                }
            });
    });

    // Create Plan a Meet button
    const planMeetButton = document.createElement('button');
    planMeetButton.innerText = 'Plan a Meet';
    planMeetButton.className = 'plan-meet-button';
    document.body.appendChild(planMeetButton);

    let meetTimestamp = null;
    let bufferTimestamp = null;

    // Set the countdown timer
    function setMeetCountdown(parsedDate) {
        meetTimestamp = parsedDate.getTime();
        bufferTimestamp = meetTimestamp + (4 * 60 * 60 * 1000); 

        // Start countdown
        updateCountdown();
        socket.emit('plan-meet', {
            username,
            roomKey,
            meetDateTime: new Date(meetTimestamp).toISOString()
        });
        setInterval(updateCountdown, 1000);
    }

    function updateCountdown() {
        if (!meetTimestamp) return;
        const now = Date.now();
        const diff = meetTimestamp - now;

        if (diff <= 0) {
            checkLocationAndDate();
        } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const seconds = Math.floor((diff / 1000) % 60);

            planMeetButton.textContent = `Meet in: ${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
    }

    // Handle partner location and check if both match
    function checkLocationAndDate() {
        const now = Date.now();
        if (isLocationMatched() && (now >= meetTimestamp && now <= bufferTimestamp)) {
            planMeetButton.textContent = "Meet Time!";
        } else {
            planMeetButton.textContent = "You missed your date!";
        }
    }

    // Function to check if partner location matches (stub example)
    function isLocationMatched() {
        if (myLatitude === null || myLongitude === null || !partnerLocation) return false;
        const partnerDist = map.distance([myLatitude, myLongitude], partnerLocation);
        return partnerDist < 50;
    }

    // Handle "Plan a Meet" button click
    planMeetButton.addEventListener('click', () => {
        const meetDateTime = prompt("Enter meet date and time (YYYY-MM-DD HH:MM):");
        if (meetDateTime) {
            const parsedDate = new Date(meetDateTime);
            if (!isNaN(parsedDate.getTime())) {
                setMeetCountdown(parsedDate);
                socket.emit('plan-meet', {
                    username,
                    roomKey,
                    meetDateTime: parsedDate.toISOString()
                });
            } else {
                alert("Invalid date-time format!");
            }
        }
    });

    const map = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Create status bar for live distance
    const statusBar = document.createElement('div');
    statusBar.className = 'status-bar';
    statusBar.textContent = 'Waiting for partner...';
    document.body.appendChild(statusBar);

    let myLatitude = null;
    let myLongitude = null;
    let partnerLocation = null;

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                myLatitude = latitude;
                myLongitude = longitude;

                socket.emit('send-location', {
                    roomKey,
                    username,
                    latitude,
                    longitude
                });

                checkArrival(latitude, longitude); // Call checkArrival on each location update

                if (!window.mapCentered) {
                    map.setView([latitude, longitude], 16);
                    window.mapCentered = true;
                }
            },
            (error) => {
                console.error(error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000,
            }
        );
    }

    // Monitor distance to destination
    function checkArrival(latitude, longitude) {
        if (!destination) return;
        const dist = map.distance([latitude, longitude], destination);
        console.log("Distance to destination:", dist);
        if (dist < 50) {
            console.log("🚀 Emitting arrival!");
            socket.emit('arrived-safely', { username, roomKey });
            destination = null; // prevent repeat notification
        }
    }

    // Listen for user-joined event
    socket.on('user-joined', (data) => {
        console.log(`${data.username} joined the room`);

        // Update status bar only if the joining user is not the current user
        if (data.id && data.id !== socket.id) {
            statusBar.textContent = `💑 ${data.username} joined the room`;
        }
    });

    // Handle location updates from the partner
    socket.on('receive-location', (data) => {
        const { id, username, latitude, longitude } = data;
        console.log(`${username} is at ${latitude}, ${longitude}`);
        partnerLocation = [latitude, longitude];

        let overlap = false;
        for (const otherId in markers) {
            if (otherId !== id) {
                const otherLatLng = markers[otherId].getLatLng();
                const dist = map.distance([latitude, longitude], [otherLatLng.lat, otherLatLng.lng]);
                if (dist < 5) { // 5 meters threshold
                    overlap = true;
                    break;
                }
            }
        }

        const icon = L.divIcon({
            html: id === socket.id
                ? `<div class="pulse-heart" style="font-size: ${overlap ? '30px' : '20px'};">❤️</div>`
                : `<div style="font-size: ${overlap ? '30px' : '20px'};">💙</div>`,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        if (!markers[id]) {
            markers[id] = L.marker([latitude, longitude], { icon }).addTo(map);
            markers[id].bindTooltip(username, {
                permanent: true,
                direction: 'top',
                className: 'marker-name-tooltip'
            });
        } else {
            markers[id].setLatLng([latitude, longitude]);
        }

        // Calculate distance to partner and update status bar
        if (markers[socket.id] && markers[data.id] && socket.id !== data.id) {
            const myLatLng = markers[socket.id].getLatLng();
            const partnerLatLng = markers[data.id].getLatLng();
            const distance = map.distance(myLatLng, partnerLatLng);
            statusBar.textContent = `You & ${data.username} are ${Math.round(distance)} meters apart `;
        }
    });

    // Arrival notification
    socket.on('arrived-safely', ({ username }) => {
        console.log("🎉 Partner has arrived!", username);
        setTimeout(() => {
            const arrivalBox = document.createElement('div');
            arrivalBox.className = 'arrival-notification';
            arrivalBox.innerText = `🎉 ${username} has arrived at their destination!`;

            document.body.appendChild(arrivalBox);

            setTimeout(() => {
                arrivalBox.remove();
            }, 8000);
        }, 100); // Small delay to ensure DOM is ready
    });

    // Handle user disconnection
    socket.on('user-disconnected', (id) => {
        console.log('User disconnected: ', id);
        if (markers[id]) {
            const lastLatLng = markers[id].getLatLng();
            const lastSeen = Date.now();
            const timeAgo = (timestamp) => {
                const diff = Math.floor((Date.now() - timestamp) / 60000);
                if (diff < 1) return "just now";
                if (diff === 1) return "1 minute ago";
                return `${diff} minutes ago`;
            };

            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lastLatLng.lat}&lon=${lastLatLng.lng}`)
                .then(res => res.json())
                .then(data => {
                    const location = data.display_name || "Unknown place";
                    statusBar.textContent = `💤 Partner was last seen ${timeAgo(lastSeen)} near ${location}`;
                })
                .catch(err => {
                    console.error("Reverse geocoding failed:", err);
                    statusBar.textContent = `💤 Partner was last seen ${timeAgo(lastSeen)}`;
                });

            map.removeLayer(markers[id]);
            delete markers[id];
        }
    });

    socket.on('meet-planned', ({ username, meetDateTime }) => {
        const parsedDate = new Date(meetDateTime);
        if (!isNaN(parsedDate.getTime())) {
            meetTimestamp = parsedDate.getTime();
            bufferTimestamp = meetTimestamp + (4 * 60 * 60 * 1000); 
            updateCountdown();
        }
    });
});