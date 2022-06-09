const config = {
    type: Phaser.HEADLESS,
    width: 1000,
    height: 1000,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    audio: {
      disableWebAudio: true
    },
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
        gravity: {
          y: 0
        }
      }
    },
    scene: {
      preload: preload,
      create: create,
      update: update
    },
    autoFocus: false
  };
  
  // VARIABLE GLOBALS
  
  const ROOM_TIMEOUT_LENGTH = 1800000;    //(30 min) Temps que el servidor esperarà per tancar-se després que tots els jugadors hagin marxat
  const CHECK_ROOM_INTERVAL = 300000;     // (5min) Amb quina freqüència el servidor comprovarà si hi ha jugadors
  const GAME_TICK_RATE = 50;              // (10 Hz) El joc funciona a una velocitat d'1 tick per 100 mil·lisegons (10 Hz)
  const SLOW_TO_FAST_TICK = 100;          // (.1 hz) Quants ticks ràpids per ticks lents (per a actualitzacions lentes al client)
  const CARD_WIDTH = 70;
  const CARD_HEIGHT = 95;
  const TABLE_CENTER_X = 0;
  const TABLE_CENTER_Y = 0;
  const TABLE_EDGE_FROM_CENTER = 625-CARD_HEIGHT/2;     // Distància de la vora de la taula des del centre de la taula (això fa un rectangle)
  const TABLE_EDGE_CONSTANT = ((2+Math.pow(2,.5))/(1+Math.pow(2,.5))) * TABLE_EDGE_FROM_CENTER;
  const DISTANCE_FROM_CENTER = 600;       // Les mans de distància són del centre
  const DISTANCE_FROM_HAND = 90;          // Distància de l'indicador del jugador des de la mà
  const HAND_WIDTH = 400;
  const HAND_HEIGHT = 75;
  const HAND_SPACING = 50;
  const HAND_SNAP_DIST = 100;
  const MIN_DEPTH = 10;                   // Profunditat mínima per a objectes de taula
  const MAX_DEPTH = 850;                  // Profunditat màxima per a objectes de taula
  const SHUFFLE_WAIT_TIME = 1000;
  const DEFAULT_HAND_SIZE = 7;


  const objectInfoToSend = {};            // Objecte per enviar a objectUpdates
  const players = {};                     // Informació de tots els jugadors actuals a la sessió de joc
  const cursorInfo = {};
  const options = {};                     // Opcions per al joc
  const recentlyShuffled = [];            // Piles remenades recentment
  options["debugMode"] = IS_LOCAL;        // Executa el servidor i el client en mode de depuració
  options["lockedHands"] = true;          // Si és cert, els jugadors només poden agafar cartes de la seva pròpia mà.
  options["flipWhenExitHand"] = false;    // Si és cert, en deixar una mà, les cartes es giraran automàticament per amagar-se.
  options["flipWhenEnterHand"] = true;    // Si és cert, les cartes es giraran cap amunt quan s'insereixen a una mà


  const roomCode = roomInfo.roomCode;
  const maxPlayers = roomInfo.maxPlayers;
  let playerCounter = 0;
  let overallDepth = MIN_DEPTH;           // Profunditat de la carta més alta
  let tickCount = 0;                      
  
  let frames;
  const cardNames = ['back', 
  'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'o10', 'o11', 'o12', 'c1',
  'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8','c9', 'c10', 'c11', 'c12', 'e1', 'e2',
  'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'b1', 'b2', 'b3',
  'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12'
  ];
  
  var seats = {};
  
  for(var i = 1; i <= 8; i++) {
    var angle = (i-1) * 45;
    var numAsString = i.toString(10);
  
    seats[numAsString] = {
      id: numAsString,
      name: 'Open',
      x: TABLE_CENTER_X + (DISTANCE_FROM_CENTER+DISTANCE_FROM_HAND) * Math.sin(Phaser.Math.DegToRad(angle)),
      y: TABLE_CENTER_Y + (DISTANCE_FROM_CENTER+DISTANCE_FROM_HAND) * Math.cos(Phaser.Math.DegToRad(angle)),
      available: true,
      rotation: angle,
      transform: 0,
      socket: 0,
      color: ''
    };
  }
  
  function preload() {
    this.load.atlas('cards', 'images/cartas/cartas.png', 'images/cartas/cartas.json');
  }
  
  function create() {
    // Per passar aquest punter a altres funcions
    const self = this;
    loadCards(self);
  
    startGameDataTicker(self);
    if(options["debugMode"]) 
      debugTicker(self);
  
    // Quan es fa una connexió
    io.on('connection', function (socket) {
      addPlayer(self, socket);
      io.emit('defaultName', players[socket.id].name);
      addPlayerToDB();
      io.emit('seatAssignments', seats);
      io.emit('options', options);
      startSocketUpdates(self, socket, frames);
    });
  }
  
  function startSocketUpdates(self, socket, frames) {
    // Assigna un nickname
    socket.on('playerNickname', function(name) {
     
      players[socket.id].name = name; 
  
      for (var x in seats) {
        if (seats[x].socket == socket.id) {
          seats[x].name = name;
        }
      }
      io.emit('nameChange', players);
      io.emit('seatAssignments', seats);
    });
  
    socket.on('chat message', (msg) => {
      io.emit('chat message', msg);
    });
  
    socket.on('seatSelected', function(seat) {
      seats[seat.id].socket = seat.socket;
      seats[seat.id].name = seat.name;
      seats[seat.id].available = false;
      var angle = seat.playerSpacing;
      players[seat.socket].playerSpacing = angle;
      players[seat.socket].x = TABLE_CENTER_X + DISTANCE_FROM_CENTER * Math.sin(Phaser.Math.DegToRad(angle));
      players[seat.socket].y = TABLE_CENTER_X + DISTANCE_FROM_CENTER * Math.cos(Phaser.Math.DegToRad(angle));
      seats[seat.id].color = players[seat.socket].playerCursor;
      io.emit('seatAssignments', seats);
    });
  
    // Escolta quan es desconnecta un usuari
    socket.on('disconnect', function () {
      removePlayerFromDB();
      for (var x in seats) {
        if (seats[x].socket == socket.id) {
          seats[x].name = 'Open';
          seats[x].available = true;
          seats[x].socket = 0;
          seats[x].color = '';
        }
      }
      io.emit('seatAssignments', seats); 
      removePlayer(self, socket);
    });
  
    // Escolta el moviment d'objectes per part del jugador
    socket.on('objectInput', function (inputData) {
      if(!inputData.playerId) { 
        setTableObjectPosition(self, inputData.objectId, inputData.x, inputData.y);
      }
      else {
        setHandObjectPosition(self, socket, inputData.playerId, inputData.objectId, inputData.x, inputData.y);
      }
    });
  
    socket.on('objectRotation', function (inputData) {
      const object = getTableObject(self, inputData.objectId);
      if(object)
        object.angle = inputData.angle;
    });
  
    // Actualitza la profunditat quan el jugador agafa una carta
    socket.on('objectDepth', function (inputData) {
      if(objectInfoToSend[inputData.objectId] != null)
        objectInfoToSend[inputData.objectId].objectDepth = incOverallDepth();
    });
  
    socket.on('mergeStacks', function (inputData) {
      // agafar tots els articles de la pila superior i poseu-los a la pila inferior
      // després suprimiu la pila superior
      const topStack = getTableObject(self, inputData.topStack);
      const bottomStack = getTableObject(self, inputData.bottomStack);
      mergeStacks(topStack, bottomStack);
    });
  
    socket.on('drawTopSprite', function(inputData){
      //trobar la pila de la qual s'ha de treure
      const bottomStack = getTableObject(self, inputData.bottomStack);
      drawTopSprite(self, bottomStack);
    });
  
    // Actualitza la cara de la targeta quan el jugador agafa una carta
    socket.on('objectFlip', function (inputData) {
      if(inputData.playerId)
        flipHandObject(self, inputData.objectId, inputData.playerId);
      else {
        var objToFlip = getTableObject(self, inputData.objectId);
        flipTableObject(self, objToFlip);
      }
    });
  
    socket.on('dummyCursorLocation', function(inputData){
      cursorInfo[inputData.playerId]=inputData;
    });
  
    socket.on('shuffleStack', function(inputData){
      const originStack = getTableObject(self, inputData.objectId);
      shuffleStack(self, originStack);
    });
  
    socket.on('autoDeal', function(inputData){
      const originStack = getTableObject(self, inputData.objectId);
      autoDeal(self, originStack);
    });
  
    socket.on('objectToHand', function(inputData){
      const object = getTableObject(self, inputData.objectId);
      moveObjectToHand(self, object, inputData.playerId, inputData.pos);
    });
  
    socket.on('handToTable', function(inputData){
      takeFromHand(self, socket, inputData.playerId, inputData.objectId, inputData.x, inputData.y);
    });
  
    socket.on('handToHand', function(inputData){
      moveAroundInHand(self, inputData.playerId, inputData.objectId, inputData.pos);
    });
  
    // request al servidor
    socket.on('request', function(request) {
      if(request == 'resetTable')
        resetTable(self);
    });
  }
  
  function update() {}
  
  // Per a informació que els usuaris no necessiten immediatament
  function slowUpdates(self) {
    tickCount++;
    if(tickCount >= SLOW_TO_FAST_TICK) {
  
      io.emit('options', options);
  
      tickCount = 0;
    }
  }
  
  // Aquesta és la funció update() per al servidor per a actualitzacions ràpides
  function startGameDataTicker(self) {
    let tickInterval = setInterval(() => {
        // Actualitza la informació de l'objecte per enviar-la als clients des dels objectes del joc
        self.tableObjects.getChildren().forEach((object) => {
          if(object.active) {
            objectInfoToSend[object.objectId].x = object.x;
            objectInfoToSend[object.objectId].y = object.y;
            objectInfoToSend[object.objectId].angle = object.angle;
          }
        });
  
        // Envia les posicions de la targeta als clients
        io.emit('objectUpdates', objectInfoToSend);
        io.emit('currentPlayers', players);
        io.emit('moveDummyCursors', cursorInfo);
        slowUpdates(self);
  
    }, GAME_TICK_RATE);
  }
  
  // PHASER JOC
  const game = new Phaser.Game(config);
  
  // Temporitzador per tancar el servidor si està inactiu
  var timer = setInterval(function() {
    // Comproveu quants jugadors
    if(numPlayers <= 0) {
      // Esperar
      setTimeout(function() { 
        // Comproveu de nou i comproveu si encara no hi ha jugadors
        if(numPlayers <= 0) {
          clearInterval(timer);
          (async function() {
            if(!IS_LOCAL) {
              const query = {
                text: "DELETE FROM rooms WHERE room_code = $1",
                values: [roomCode]
              };
              const client = await pool.connect();
              await client.query(query);
              client.release();
            }
          })().catch( e => { console.error(e) }).then(() => {
            game.destroy(true, true);
            window.close(); 
          });
        }
      }, ROOM_TIMEOUT_LENGTH);
    }
  }, CHECK_ROOM_INTERVAL);
  
  function addPlayerToDB(){
    if(!IS_LOCAL) {
      (async function() {
        let query = {
          text: "SELECT * FROM rooms WHERE room_code = $1",
          values: [roomCode]
        };
        const client = await pool.connect();
        await client.query(query)
          .then(res =>{
            if(res.rows[0]){
              let curSize = res.rows[0].num_players;
              (async function() {
                let query = {
                  text: "UPDATE rooms SET num_players = $1 WHERE room_code = $2",
                  values: [curSize+1, roomCode]
                };
                await client.query(query).catch(e => console.error(e.stack));
              })().catch( e => { console.error(e) });
            }
          }).catch(e => console.error(e.stack));
        client.release();
      })().catch( e => { console.error(e) });
    } 
  }
  
  function removePlayerFromDB(){
    if(!IS_LOCAL) {
      (async function() {
        let query = {
          text: "SELECT * FROM rooms WHERE room_code = $1",
          values: [roomCode]
        };
        const client = await pool.connect();
        await client.query(query)
          .then(res =>{
            if(res.rows[0]){
              let curSize = res.rows[0].num_players;
              (async function() {
                let query = {
                  text: "UPDATE rooms SET num_players = $1 WHERE room_code = $2",
                  values: [curSize-1, roomCode]
                };
                await client.query(query).catch(e => console.error(e.stack));
              })().catch( e => { console.error(e) });
            }
          }).catch(e => console.error(e.stack));
        client.release();
      })().catch( e => { console.error(e) });
    }
  }