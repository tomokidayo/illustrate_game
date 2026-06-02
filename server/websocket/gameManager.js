// TODO: implement game logic
function handle(wss, ws, msg) {
  console.log('WS message:', msg);
}

function handleDisconnect(wss, ws) {
  console.log('WS disconnected:', ws.user?.username);
}

module.exports = { handle, handleDisconnect };
