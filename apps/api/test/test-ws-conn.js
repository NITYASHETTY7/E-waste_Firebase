const { io } = require('socket.io-client');

console.log('Connecting to ws://localhost:4000/auction...');
const socket = io('http://localhost:4000/auction', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connection established successfully!');
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message, err);
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ Connection timeout after 5 seconds');
  process.exit(1);
}, 5000);
