const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const server = http.createServer(app);
const io = socketio(server);

const users = {}; // Store user info
const rooms = {}; // Store room keys

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// When a user connects
io.on('connection', (socket) => {
    console.log('User connected');

    // Handle joining a specific room
    socket.on('join-room', (data) => {
        const { username, roomKey } = data;
        users[socket.id] = { username, roomKey };
        socket.join(roomKey);
        console.log(`${username} joined room: ${roomKey}`);
        socket.to(roomKey).emit('user-joined', { id: socket.id, username });
    });

    // Handle location data
    socket.on('send-location', (data) => {
        const { roomKey, username, latitude, longitude } = data;
        io.to(roomKey).emit('receive-location', { id: socket.id, username, latitude, longitude });
    });
    // ✅ Handle meet planning and broadcast to both users
    socket.on('plan-meet', ({ username, roomKey, meetDateTime }) => {
        io.to(roomKey).emit('meet-planned', { username, meetDateTime });
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.to(user.roomKey).emit('user-disconnected', socket.id);
            delete users[socket.id];
        }
    });
    socket.on('arrived-safely', ({ username, roomKey }) => {
        socket.to(roomKey).emit('arrived-safely', { username });
    });

    console.log('Connected');
});

// Render index page
app.get('/', (req, res) => {
    res.render('index', { roomKey: '' }); // ✅ Default empty roomKey
  });

// Handle room joining (URL: /join?room=uniqueRoomKey)
app.get('/join', (req, res) => {
    const { room } = req.query;
    if (room) {
        res.render('index', { roomKey: room }); // Pass roomKey to client
    } else {
        res.redirect('/');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});