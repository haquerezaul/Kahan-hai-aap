const express= require('express');
const app= express();
const http= require('http');
const path= require('path');

const socketio= require('socket.io');
const server=http.createServer(app);
const io= socketio(server);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
io.on('connection', (socket) => {
    socket.on('send-location', function(data) {
        io.emit('receive-location', {
            id: socket.id,
            latitude: data.latitude,
            longitude: data.longitude
        });
    })
    console.log('Connected');
    socket.on('disconnect', function()  {
        io.emit('user-disconnected',socket.id);
    }); 
  
    });




app.get('/', (req, res) => {
    res.render("index");
}
);
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});