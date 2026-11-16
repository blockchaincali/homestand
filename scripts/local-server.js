// In-browser stand-in for server.js, used by the GitHub Pages build.
// It speaks the same JSON messages as the WebSocket room server, but only
// supports solo matches against the AI.
(function () {
  'use strict';
  var Game = window.HomestandEngine.Game;
  var STEP = 0.05;
  var room = null;
  var socket = null;
  var uid = function () {
    var b = new Uint8Array(9);
    crypto.getRandomValues(b);
    return Array.from(b, function (n) { return n.toString(16).padStart(2, '0'); }).join('');
  };
  var newCode = function () {
    var b = new Uint8Array(4);
    crypto.getRandomValues(b);
    return Array.from(b, function (n) { return 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]; }).join('');
  };
  var send = function (data) { if (socket) socket._emit(data); };
  var human = function () { return room && room.game.participants.find(function (p) { return !p.bot; }); };
  var broadcastState = function () {
    var p = human();
    if (!p) return;
    var snap = room.game.snapshot();
    send(Object.assign({ type: 'state', me: p.id, team: p.team, host: true }, snap));
  };

  function create(msg) {
    if (msg.mode === 'pvp') {
      return send({ type: 'notice', message: 'Live 1v1 rooms need the online server. Play vs AI in the browser edition.' });
    }
    var code = newCode();
    var difficulty = ['recruit', 'standard', 'veteran'].indexOf(msg.difficulty) >= 0 ? msg.difficulty : 'recruit';
    var game = new Game({ mode: 'solo', roomCode: code, difficulty: difficulty });
    room = { code: code, game: game };
    var id = uid();
    var name = String(msg.name || 'Commander').trim().slice(0, 18) || 'Commander';
    game.addParticipant(id, name, 0, false);
    game.addParticipant(uid(), 'CRIMSON BOT', 1, true);
    send({ type: 'joined', code: code, id: id, team: 0, existing: false });
    game.start();
    broadcastState();
  }

  function join(msg) {
    var p = human();
    if (room && String(msg.code || '').toUpperCase() === room.code && p && p.id === msg.id) {
      send({ type: 'joined', code: room.code, id: p.id, team: p.team, existing: true });
      return broadcastState();
    }
    send({ type: 'error', message: 'Room expired or not found. Multiplayer rooms need the online server.' });
  }

  function action(msg) {
    var player = human();
    if (!room || !player) return;
    var game = room.game;
    var outcome;
    switch (msg.type) {
      case 'start': outcome = game.start() ? { ok: true } : { ok: false, reason: 'Unable to start' }; break;
      case 'build': outcome = game.spawn(player.team, String(msg.unitType || '')); break;
      case 'command': outcome = game.command(player.team, msg.unitIds, msg.action, msg.x, msg.y, msg.targetId); break;
      case 'ability': outcome = game.orbital(player.team, msg.x, msg.y); break;
      case 'surrender': if (game.phase === 'playing') game.end(1 - player.team, 'SURRENDER'); outcome = { ok: true }; break;
      case 'leave': room = null; return;
      default: return;
    }
    if (!outcome.ok) send({ type: 'notice', message: outcome.reason || 'Not available' });
    else if (msg.type === 'build') send({ type: 'notice', message: 'Unit deployed: ' + String(msg.unitType).toUpperCase() });
    broadcastState();
  }

  function LocalSocket() {
    var self = this;
    self.readyState = 0;
    socket = self;
    setTimeout(function () { self.readyState = 1; if (self.onopen) self.onopen({}); }, 0);
  }
  LocalSocket.CONNECTING = 0;
  LocalSocket.OPEN = 1;
  LocalSocket.CLOSING = 2;
  LocalSocket.CLOSED = 3;
  LocalSocket.prototype.send = function (raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'create') return create(msg);
    if (msg.type === 'join') return join(msg);
    action(msg);
  };
  LocalSocket.prototype.close = function () { this.readyState = 3; };
  LocalSocket.prototype._emit = function (data) {
    var self = this;
    if (self.readyState !== 1) return;
    var payload = JSON.stringify(data);
    setTimeout(function () { if (self.onmessage) self.onmessage({ data: payload }); }, 0);
  };
  window.WebSocket = LocalSocket;

  var accumulator = 0, last = performance.now(), broadcastClock = 0;
  setInterval(function () {
    var now = performance.now();
    accumulator = Math.min(0.25, accumulator + (now - last) / 1000);
    last = now;
    if (!room || room.game.phase !== 'playing') { accumulator = 0; return; }
    while (accumulator >= STEP && room.game.phase === 'playing') { room.game.step(STEP); accumulator -= STEP; broadcastClock += STEP; }
    // Send the final state as soon as a match ends, so the result screen shows.
    if (room.game.phase !== 'playing' || broadcastClock >= 0.12) { broadcastClock = 0; broadcastState(); }
  }, 50);
})();
