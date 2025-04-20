const socket = io();

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            socket.emit('send-location', {
                id: socket.id,
                latitude,
                longitude
            });
        },
        (error) => {
            console.error(error);
        }
    );

    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            socket.emit('send-location', {
                id: socket.id,
                latitude,
                longitude
            });
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

const map = L.map('map').setView([20, 78], 5); // initial view over India
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: "OpenStreetMap"
}).addTo(map);

const markers = {};
const centeredUsers = {};
socket.on('receive-location', (data) => {
    const { id, latitude, longitude } = data;

    if (!markers[id]) {
        markers[id] = L.marker([latitude, longitude]).addTo(map);
    } else {
        markers[id].setLatLng([latitude, longitude]);
    }

    if (id === socket.id && !centeredUsers[id]) {
        map.setView([latitude, longitude], 16);
        centeredUsers[id] = true;
    }
});
socket.on('user-disconnected', (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
        delete centeredUsers[id];
    }
});