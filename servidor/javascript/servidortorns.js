function moveObjectToHand(self, object, playerId, pos) {
    if(!object || !players[playerId]) {
      return;
    }
  
    var numSprites = object.length; // Nombre de sprites a l'objecte
    
    for(var i = 0; i < numSprites; i++) {
      var sprite = object.first;      // Obteniu l'objecte sprite
      var isFaceUp = options["flipWhenEnterHand"] ? true : sprite.isFaceUp;
      // Actualitzar la informació de la mà per al client
      players[playerId].hand.splice(pos, 0, sprite.spriteId);  
      players[playerId].isFaceUp.splice(pos, 0, isFaceUp);     
  
      object.remove(sprite, true);    // Treiem l'esprit del contenidor
    }
    updateHandSpacing(playerId, -1);      // Ajustar l'espaiat
  
    delete objectInfoToSend[object.objectId]; // Suprimeix la informació de l'objecte per al client
    object.active = false; // Guardar per a més tard
  }
  
  //Revisa totes les cartes de la mà i actualitza la posició
  function updateHandSpacing(playerId, ignorePos, additionalPos) {
    if(!players[playerId]) {
      return;
    }
  
    if(ignorePos == null)
      ignorePos = -1;
    var rotation = Phaser.Math.DegToRad(-players[playerId].playerSpacing);
    var newLength = players[playerId].hand.length;
    var deltaLen = ignorePos == -1 ? newLength : newLength-1;
    if(additionalPos && additionalPos != -1) {
      newLength++;
      deltaLen++;
    }
    var startPos, spacing = HAND_SPACING, deltaPos = 0, deltaI = 0; 
    if(spacing * deltaLen >= HAND_WIDTH - 30)
      spacing = (HAND_WIDTH-CARD_WIDTH) / deltaLen;
    if(deltaLen % 2 == 1) // Nombre parell de cartes
      startPos = -spacing * Math.floor(deltaLen/2.0);
    else  // Nombre senar de cartes
      startPos = -spacing * Math.floor(deltaLen/2.0) + spacing/2;
  
    for(var i = 0; i < newLength; i++) {
      // Compensar la rotació i la translació
      var handX = players[playerId].x + Math.cos(rotation) * (startPos + spacing * (i+deltaPos));
      var handY = players[playerId].y + Math.sin(rotation) * (startPos + spacing * (i+deltaPos));
      
      if(additionalPos != null && i == additionalPos) {
        // Creeu un buit per afegir-hi una targeta
        var additionalXY = [handX, handY];
        deltaI--;
      }
      else {
        //Canvia la posició de la targeta xy
        players[playerId].handX[i+deltaI] = handX;
        players[playerId].handY[i+deltaI] = handY;
      }
      if(i == ignorePos) 
        deltaPos--; // Canvieu i per a cada targeta després de ignorePos
    }
    if(additionalXY)
      return additionalXY; // Torneu a la posició de la targeta que cal inserir
    return null;
  }
  
  
  
  
  function takeFromHand(self, socket, playerId, objectId, x, y) {
    const player = players[playerId];
    if(!player) {
      return;
    }
    // Mans bloquejades (els altres jugadors no poden agafar cartes de la teva mà)
    else if(options["lockedHands"] && (playerId != socket.id)) {
      return;
    }
    var isFaceUp = false;
    var pos = -1;
    for(var i = 0; i < players[playerId].hand.length; i++) {
      if(players[playerId].hand[i] == objectId) {
        pos = i;
        players[playerId].hand.splice(i, 1); // Retirar de la mà
        if(!options["flipWhenExitHand"])
          isFaceUp = players[playerId].isFaceUp[i];
        players[playerId].isFaceUp.splice(i, 1);
        break;
      }
    }
    if(pos == -1) {
      return;
    }
    updateHandSpacing(playerId, -1);      // Ajusteu l'espaiat a la mà

    //torneu a definir la pila i torneu a posar-hi el seu sprite
    const sprite = createSprite(self, objectId, cardNames[objectId], isFaceUp, frames);
    const object = getTableObject(self, objectId); //Trobeu la pila original amb la qual es va crear el sprite
    object.active = true;
    object.x = x;
    object.y = y;
    object.angle = -players[playerId].playerSpacing;
    object.objectId = objectId;
    object.add(sprite);
  
    //actualitzar els clients dient-los que creïn la nova pila
    objectInfoToSend[object.objectId]={
      objectId: object.objectId,
      items: [ objectId ],
      isFaceUp: [ isFaceUp ],
      x: x,
      y: y,
      objectDepth: incOverallDepth(),
      angle: -players[playerId].playerSpacing
    }
  }
  
  
  
  function flipHandObject(self, objectId, playerId) {
    var pos = -1;
    for(var i = 0; i < players[playerId].hand.length; i++) {
      if(players[playerId].hand[i] == objectId) {
        pos = i;
        players[playerId].isFaceUp[i] = !players[playerId].isFaceUp[i];
        break;
      }
    }
  }
  
  function setHandObjectPosition(self, socket, playerId, objectId, x, y) {
    if(!players[playerId]) {
      return;
    }
    for(var i = 0; i < players[playerId].hand.length; i++) {
      if(players[playerId].hand[i] == objectId && (!options["lockedHands"] || (playerId == socket.id))) {
        var originalPos = i;
        players[playerId].handX[i] = x;
        players[playerId].handY[i] = y;
        break;
      }
    }
    var data = findPosToInsertInHand(objectId, x, y);
  
    if(data && data[0] == playerId && originalPos) {
      var pos = data[1];
      var newXY = updateHandSpacing(playerId, originalPos, pos);
  
      players[playerId].handX[i] = newXY[0];
      players[playerId].handY[i] = newXY[1];
    }
    else
      updateHandSpacing(playerId, originalPos); // Treure altres cartes a la mà i ignoreu l'arrossegament de la targeta
  }
  
  function findPosToInsertInHand(objectId, x, y) {
    var closest = null;           // Identificador d'objecte de la carta més propera en una mà
    var dist = Math.pow(HAND_SNAP_DIST,2);
    var secondClosest = null;
    var dist2 = dist;
  
    Object.keys(players).forEach(key => {
      for(var i = 0; i < players[key].hand.length; i++) {
        var tempX = players[key].handX[i];
        var tempY = players[key].handY[i];
        var tempDistance = Math.pow(x-tempX,2) + Math.pow(y-tempY,2);
  
        if(players[key].hand[i] != objectId && tempDistance < dist) {
          secondClosest = closest;
          closest = {
            objectId: players[key].hand[i],
            playerId: key,
            pos: i,
            x: tempX,
            y: tempY
          };
          dist2 = dist;
          dist = tempDistance;
        }
        else if(players[key].hand[i] != objectId && tempDistance < dist2) {
          secondClosest = {
            objectId: players[key].hand[i],
            playerId: key,
            pos: i,
            x: tempX,
            y: tempY
          };
          dist2 = tempDistance;
        }
      }
    });
    
    if(closest) {
      var angle = Phaser.Math.DegToRad(-players[closest.playerId].playerSpacing);
      var isLeftOfClosest = Math.cos(angle) * (x-closest.x) + 
                            Math.sin(angle) * (y-closest.y) < 0;
    
      // Dos objectes mà estan a prop
      if(secondClosest && closest.playerId == secondClosest.playerId) {
        var leftPos = Math.min(closest.pos, secondClosest.pos);
        var rightPos = Math.max(closest.pos, secondClosest.pos);
        var isLeftOfSecondClosest = Math.cos(angle) * (x-secondClosest.x) + 
                                    Math.sin(angle) * (y-secondClosest.y) < 0;
        
        if(isLeftOfClosest && isLeftOfSecondClosest) 
          return [closest.playerId, leftPos];        // L'esquerra de les dues cartes
        else if(!isLeftOfClosest && !isLeftOfSecondClosest)
          return [closest.playerId, rightPos+1];     // Dret de les dues cartes
        else 
          return [closest.playerId, rightPos];       // Entre les cartes
      }
      else {  // Només hi ha una targeta a prop
        if(isLeftOfClosest)
          return [closest.playerId, closest.pos];    // Esquerra de la targeta
        else
          return [closest.playerId, closest.pos+1];  //Dret de targeta
      }
    }
    return null;
  }
  
  
  function moveAroundInHand(self, playerId, objectId, newPos) {
    if(!players[playerId])
      return;
    if(newPos == -1) { // Restableix l'espaiat
      updateHandSpacing(playerId, -1);
      return;
    }
    var pos = -1; 
    for(var i = 0; i < players[playerId].hand.length; i++) {
      if(players[playerId].hand[i] == objectId) {
        pos = i;  // Posició actual de la targeta
        break;  
      }
    }
    if(pos == -1) {
      return;
    }
    else if(pos == newPos || pos + 1 == newPos) { // La mateixa posició no fa res
      updateHandSpacing(playerId, -1);
      return;
    }
    else if(pos < 0)
      pos = 0;
    
    var x = players[playerId].handX[pos];
    var y = players[playerId].handY[pos];
    var isFaceUp = players[playerId].isFaceUp[pos];
    var toDelete = newPos > pos ? pos : pos+1;
    // Insereix una còpia a la nova posició
    players[playerId].hand.splice(newPos, 0, objectId); 
    players[playerId].handX.splice(newPos, 0, x);
    players[playerId].handY.splice(newPos, 0, y);
    players[playerId].isFaceUp.splice(newPos, 0, isFaceUp);
  
    // Elimina l'original
    players[playerId].hand.splice(toDelete, 1); 
    players[playerId].handX.splice(toDelete, 1);
    players[playerId].handY.splice(toDelete, 1);
    players[playerId].isFaceUp.splice(toDelete, 1);
  
    updateHandSpacing(playerId, -1);
  }
  
  function removeAllFromHand(self, playerId) {
    var x = 90;
    var y = 0;
    const player = players[playerId];
    if(!player) {
      return;
    }
    for(var i = 0; i < players[playerId].hand.length; i++) {
      var objectId = players[playerId].hand[i];
      var isFaceUp = players[playerId].isFaceUp[i];
  
      //torneu a definir la pila i torneu a posar-hi el seu sprite
      const sprite = createSprite(self, objectId, cardNames[objectId], isFaceUp, frames);
      const object = getTableObject(self, objectId); //Trobeu la pila original amb la qual es va crear el sprite
      object.active = true;
      object.x = x;
      object.y = y;
      object.angle = 0;
      object.objectId = objectId;
      object.add(sprite);
  
      //actualitzar els clients dient-los que creïn la nova pila
      objectInfoToSend[object.objectId]={
        objectId: object.objectId,
        items: [ objectId ],
        isFaceUp: [ isFaceUp ],
        x: x,
        y: y,
        objectDepth: incOverallDepth(),
        angle: -players[playerId].playerSpacing
      }
      // Combina les cartes en una pila
      if(i == 0) 
        var discardStack = object;
      else if(discardStack) {
        let topStack = object;
        mergeStacks(topStack, discardStack);
      }
      x += 20;
    }
  }