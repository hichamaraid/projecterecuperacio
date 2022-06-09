   
const customCursors = [
    {inUse: false, path: 'blue'},
    {inUse: false, path: 'green'},
    {inUse: false, path: 'orange'},
    {inUse: false, path: 'pink'},
    {inUse: false, path: 'purple'},
    {inUse: false, path: 'red'},
    {inUse: false, path: 'white'},
    {inUse: false, path: 'yellow'}
  ];
  
  function addPlayer(self, socket) {
    numPlayers++;
    playerCounter++;
    players[socket.id] = {
      playerId: socket.id,
      name: "player" + playerCounter,
      playerNum: playerCounter,       //el número de jugador que no és llarg
      hand: [],                    // Tots els identificadors de les cartes a la mà
      handX: [],
      handY: [],                   //ubicació de les cartes a la mà
      isFaceUp: [],
      depth: -1,                   // objectId de un objecte que s'està arrossegant actualment 
      x: TABLE_CENTER_X,
      y: TABLE_CENTER_Y,
      playerSpacing: 0,
      playerCursor: selectPlayerCursor()
    }
  
   
  }
  
  function removePlayer(self, socket) {
    numPlayers--;
    removeAllFromHand(self, socket.id);
    deselectPlayerCursor(players[socket.id].playerCursor);

    delete players[socket.id];
  }
  
  function selectPlayerCursor(){
    let playerCursor = null;
    for (let i = 0; i < customCursors.length; i++) {
      if(!customCursors[i].inUse){
        playerCursor = customCursors[i];
        customCursors[i].inUse = true;
        break;
      }
    }
    if(playerCursor){
      return playerCursor.path;
    }
    else{
      return customCursors[0].path;
    }
  }
  
  function deselectPlayerCursor(playerCursor){
    for (let i = 0; i < customCursors.length; i++) {
      if(customCursors[i].path == playerCursor){
        customCursors[i].inUse = false;
        break;
      }
    }
  }