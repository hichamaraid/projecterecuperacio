const path = require('path');
const jsdom = require('jsdom');
const express = require('express');
const { Pool } = require('pg');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io').listen(server);
const Datauri = require('datauri');
const querystring = require('querystring'); 
var bodyParser = require('body-parser')

const datauri = new Datauri();
const { JSDOM } = jsdom;

let port = process.env.PORT || 3000;
const CONNECTION_STRING = process.env.DATABASE_URL || '';
const IS_LOCAL = CONNECTION_STRING == '';

// VARIABLE JOC
const activeGameRooms = {};

let pool;

if(!IS_LOCAL) {
  // CONFIGURAR BASE DE DADES PGRES
  pool = new Pool({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
   
  });
} else {
}

initializeDatabase();

app.set('servidor', 'ejs');
app.use(express.static(__dirname + '/client'));
app.use(bodyParser.urlencoded({ extended: false }))

app.get('/', function (req, res) {  
  let requestedRoom = req.query.roomCode || '';

  if(!IS_LOCAL) {
    // ACTUALITZAR JOC A LA BASE DE DADES
    (async function() {
      let query = {
        text: "SELECT * FROM rooms WHERE room_code = $1",
        values: [requestedRoom]
      };
      const client = await pool.connect();
      await client.query(query, (err, result) => {
        if (err) {
            console.error(err);
            return;
        }
        if(result.rows.length == 0){
          activeGameRooms[requestedRoom] = null;
        }
        lobbyRouter(requestedRoom, req, res);
        client.release();
      });
    })
  } else {
    lobbyRouter(requestedRoom, req, res);
  }
});

// DIRECTORI DEL JOC
function lobbyRouter(requestedRoom, req, res) {
  if(!requestedRoom || requestedRoom == '') {
    renderHome(res).catch( e => { console.error(e) })
  } 
  
  else if (activeGameRooms[requestedRoom] && activeGameRooms[requestedRoom].numPlayers < activeGameRooms[requestedRoom].maxPlayers) {
    var nickname = req.query.nickname || '';
    if(nickname != '') {
      const query = querystring.stringify({
        "nickname": nickname
      });
      res.sendFile(__dirname + '/client/views/index.html', query);
    } 
    else
      res.sendFile(__dirname + '/client/views/index.html');
  } 
 
}

async function renderHome(res){
  let query = {
    text: "SELECT * FROM rooms",
    values: []
  };
  if(!IS_LOCAL) {
    const client = await pool.connect();
    await client.query(query).then((result) => {
      Object.keys(activeGameRooms).forEach(key => {
        delete activeGameRooms[key];
      });
      if (result.rows.length == 0) {
      }
      else{
        result.rows.forEach(row => {
          addToActiveGameRooms(row.room_code, row.num_players, row.max_players, row.room_name, row.room_owner, row.game_desc);
        });
      }
      res.render(__dirname + '/client/views/lobby.ejs', {activeGameRooms: activeGameRooms});
      client.release();
    })
    .catch(e => {
      console.error(e.stack);
      return;
    });
  }
  else{
    res.render(__dirname + '/client/views/lobby.ejs', {activeGameRooms: activeGameRooms});
  }
}

app.post('/cinquillojoc', function(req, res) {
  // CREAR NOU CODI DE SALA
  var newRoomId = uniqueId();
  // COMPROVA QUE NO HI HA DOS SALES IGUALS
  while(activeGameRooms[newRoomId])
    newRoomId = uniqueId();

  let nickname = req.body.nickname || '';
  let maxPlayers = req.body.maxPlayers;
  let roomName = req.body.roomName || nickname + "'s room";
  let roomDesc = req.body.gameDesc || '';

  createRoom(newRoomId, maxPlayers, roomName, nickname, roomDesc).catch( e => { console.error(e) });

  if(nickname != '')
  nickname = '&nickname=' + nickname;

  //ENVIAR INFORMACIO A LA DE JOC
  const query = querystring.stringify({
      "roomCode": newRoomId
  });
  res.redirect('/?' + query + nickname);
});

// INSERTAR SALES AL JOC
async function createRoom(roomCode, maxPlayers, roomName, roomOwner, gameDesc) {
  if(!IS_LOCAL) {
    const query = {
      text: 'INSERT INTO rooms (room_code, num_players, max_players, room_name, room_owner, game_desc) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      values: [roomCode, 0, maxPlayers, roomName, roomOwner, gameDesc]
    };
    const client = await pool.connect();
    await client
      .query(query)
      .then(res =>{
        const r = res.rows[0];
        addToActiveGameRooms(r.room_code, r.num_players, r.max_players, 
          r.room_name, r.room_owner, r.game_desc)
        setupAuthoritativePhaser(activeGameRooms[roomCode]);
      })
      .catch(e => console.error(e.stack));
    client.release();
  }
  else{
    addToActiveGameRooms(roomCode, 0, maxPlayers, roomName, roomOwner, gameDesc);
    setupAuthoritativePhaser(activeGameRooms[roomCode]);
  }
}

function addToActiveGameRooms(roomCode, numPlayers, maxPlayers, roomName, roomOwner, gameDesc){
  activeGameRooms[roomCode] = {
    roomCode: roomCode,
    numPlayers: numPlayers,
    maxPlayers: maxPlayers,
    roomName: roomName,
    roomOwner: roomOwner,
    gameDesc: gameDesc
  };
}



//INICIAR JOC
function setupAuthoritativePhaser(roomInfo) {
  if(roomInfo && roomInfo.roomCode) {
    // AFEGIR ELS NOM DE LES SALES AL SOCKET 
    let room_io = io.of('/' + roomInfo.roomCode);
    // EXECUTAR JSDOM PER EL MOTOR DEL JOC AL SERVIDOR
    JSDOM.fromFile(path.join(__dirname, 'servidor/javascript.html'), {
      // EXECUTAR FITXER JAVASCRIPT HTML
      runScripts: "dangerously",
      // CARREGA RECURSOS EXTERNS
      resources: "usable",
      // MOSTRA VISUAL JOC
      pretendToBeVisual: true
    }).then((dom) => {

      dom.window.URL.createObjectURL = (blob) => {
        if (blob){
          return datauri.format(blob.type, blob[Object.getOwnPropertySymbols(blob)[0]]._buffer).content;
        }
      };
      dom.window.URL.revokeObjectURL = (objectURL) => {};
      
      //PASSAR OBJECTES AUTH AL FITXER JOC.JS
      dom.window.io = room_io;        // PASAR NOM DE LA SALA AL SOCKET.IO
      dom.window.IS_LOCAL = IS_LOCAL; // EXECUTAR AL JOC LOCALMENT
      dom.window.pool = pool;         // PASAR AL JOC A LA BASE DE DADES
      dom.window.roomInfo = roomInfo; // PASAR LA INFORMACIO DE LA SALA AL SERVIDOR
      dom.window.numPlayers = 0;

     
    })
  }
}


const uniqueId = function () {
  return Math.random().toString(36).substr(4);
};

function initializeDatabase() {
  var query = 
    "DROP TABLE IF EXISTS players; "+
    "DROP TABLE IF EXISTS rooms; "+
    "CREATE TABLE rooms (" +
      "room_id serial PRIMARY KEY, "+
      "room_code VARCHAR (20) NOT NULL, "+
      "num_players INTEGER NOT NULL, "+
      "max_players INTEGER NOT NULL, "+
      "room_name VARCHAR (20), "+ 
      "room_owner VARCHAR (20), "
     
    "); ";
 
}

server.listen(port, function () {
  console.log(`SERVIDOR - PORT ${server.address().port}`);
});