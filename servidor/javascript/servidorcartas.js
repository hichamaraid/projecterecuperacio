 
function loadCards(self) {
    self.tableObjects = self.add.group();
  
    frames = self.textures.get('cards').getFrameNames();
  
    const xStart = 100,  yStart = 100, 
          xSpacing = CARD_WIDTH/2.0, ySpacing = 200, 
          perRow = 13,   initialIsFaceUp = true;
  
    //AFEGIR LES CARTES EN ORDRE
    for (let objectId = 1; objectId <= 52; objectId++) {
      var initialX = ((objectId-1)%perRow) * xSpacing + xStart;
      var initialY = Math.floor((objectId-1)/perRow) * ySpacing + yStart;
      // ASSIGNAR INFORMACIO DE LA CARTA PER ENVIAR AL JUGADOR
      objectInfoToSend[objectId] = {
        objectId: objectId,
        items: [objectId],
        isFaceUp: [initialIsFaceUp],
        x: initialX,
        y: initialY,
        objectDepth: incOverallDepth(),
        angle: 0
      };
      addObject(self, [objectId], initialX, initialY, [initialIsFaceUp], frames);
    }
    gatherAllCards(self, TABLE_CENTER_X, TABLE_CENTER_Y);
  }
  
  function getTableObject(self, objectId) {
    // BUSCAR L'OBJECTE PER ID
     return self.tableObjects.getChildren()[objectId-1];
  }
  
  function gatherAllCards(self, xPos, yPos) {
    const bottomStack = getTableObject(self, 1);
    for(let i = 2; i <= 52; i++) {
      let topStack = getTableObject(self, i);
      mergeStacks(topStack, bottomStack);
    }
    bottomStack.x = xPos;
    bottomStack.y = yPos;
    flipTableObject(self, bottomStack);
  }
  
  function mergeStacks(topStack, bottomStack) {
    if(objectInfoToSend[topStack.objectId] == null) 
      console.log("");
    else if(objectInfoToSend[bottomStack.objectId] == null) 
      console.log("");
    else {
      // AGAFA ELS OBJECTES DE LA PILA SUPERIOR I POSARLO A INFERIOR
      const topSprites = topStack.getAll();
      for(var i = 0; i < topSprites.length; i++) {
        bottomStack.add(topSprites[i]); // COPIA ELS SPRITES DE LA PILA ANTERIOR
        // COPIAR INFORMACIO DEL OBJECTE
        objectInfoToSend[bottomStack.objectId].items.push(topSprites[i].spriteId);
        objectInfoToSend[bottomStack.objectId].isFaceUp.push(objectInfoToSend[topStack.objectId].isFaceUp[i]);
      }
    
  
      //Suprimeix la informació de la pila superior i defineix l'objecte com a no actiu
      topStack.active = false;                  
      delete objectInfoToSend[topStack.objectId];
    }
  }
  
  function flipTableObject(self, gameObject) {
    if(gameObject) {
      if(gameObject.length == 1) {
        gameObject.first.isFaceUp = !(gameObject.first.isFaceUp);
        objectInfoToSend[gameObject.objectId].isFaceUp[0] = gameObject.first.isFaceUp;
      }
      else {
        // // Obteniu el contenidor de l'última carta que serà el primer sprite de la nova pila
        if(gameObject.last == null) {
          return;
        }
        const newStack = getTableObject(self, gameObject.last.spriteId);
        newStack.active = true;
        newStack.objectId = gameObject.last.spriteId;
        newStack.x = gameObject.x;
        newStack.y = gameObject.y;
  
        var newSprites = [];  //Per enviar identificadors de sprites al client
        var newIsFaceUp = []; // Per a l'orientació de la targeta per enviar al client
        const numSprites = gameObject.length;
  
        // Copieu els sprites en ordre invers
        for(var i = 0; i < numSprites; i++) {
          // Obtenir l'objecte sprite
          var sprite = gameObject.last;         // Agafeu primer l'últim sprite
          sprite.isFaceUp = !sprite.isFaceUp;   //Girar Cart de volta
          newStack.add(sprite);
  
          //Recordeu informació per al client
          newSprites.push(sprite.spriteId);
          newIsFaceUp.push(sprite.isFaceUp);        
        }
  
  
        //actualitzar els clients dient-los que creab la nova pila
        objectInfoToSend[newStack.objectId] = {
          objectId: newStack.objectId,
          items: newSprites,
          x: gameObject.x,
          y: gameObject.y,
          objectDepth: incOverallDepth(),
          isFaceUp: newIsFaceUp
        }
  
        delete objectInfoToSend[gameObject.objectId];
        gameObject.active = false;  //Desar per a un ús posterior
      }
    }
  }
  
  function drawTopSprite(self, bottomStack) {
    if(!bottomStack || !bottomStack.last) {
      return;
    }
    const topSprite = bottomStack.last;                        //seleccioneu el sprite superior de la pila
    const topStack = getTableObject(self, topSprite.spriteId); //Trobar la pila original amb la qual es va crear el sprite
    
    //torneu a definir la pila i torneu a posar-hi el seu sprite original
    topStack.active = true;
    topStack.x = bottomStack.x;
    topStack.y = bottomStack.y;
    topStack.objectId = topSprite.spriteId;
    topStack.add(topSprite);
  
    //actualitzar els clients dient-los que creïn la nova pila
    objectInfoToSend[topStack.objectId]={
      objectId: topStack.objectId,
      items: [ objectInfoToSend[bottomStack.objectId].items.pop() ],
      x: bottomStack.x,
      y: bottomStack.y,
      objectDepth: incOverallDepth(),
      isFaceUp: [ objectInfoToSend[bottomStack.objectId].isFaceUp.pop() ]
    }
  }
  
  function addObject(self, spriteIds, x, y, spriteOrientations, frames) {
    const spritesToAdd = [];
    for(let i = 0; i < spriteIds.length; i++) {
      var spriteId = spriteIds[i];
      spritesToAdd[i] = createSprite(self, spriteId, cardNames[spriteId], spriteOrientations[i], frames);
    }
  
    // Crea un objecte que actuï com una pila (pot tenir diversos sprites)
    const object = self.add.container(x, y, spritesToAdd);
    object.objectId = spriteIds[0]; //El primer spriteId és sempre objectId
    object.setSize(CARD_WIDTH, CARD_HEIGHT);
    object.active = true;
  
    self.tableObjects.add(object);  //Afegiu-lo al grup d'objectes
  }
  
  //  Només podríem fer un seguiment dels identificadors dels sprites a objectInfoToSend
  function createSprite(self, spriteId, spriteName, isFaceUp, frames) {
    var frame = frames[frames.indexOf(spriteName)];
    // Crear sprite
    const sprite = self.add.sprite(0, 0, 'cards', frame);
    sprite.spriteId = spriteId;
    sprite.name = spriteName;
    sprite.displayWidth = CARD_WIDTH;
    sprite.displayHeight = CARD_HEIGHT;
    sprite.isFaceUp = true;
    return sprite;
  }
  
  function shuffleStack(self, originStack){
    // evitar el remenatge repetitiu ràpid
    if(!recentlyShuffled.includes(originStack.first.objectId)){
      let stackFacing = originStack.last.isFaceUp;
      
      //No es pot barrejar una baralla de una sola carta
      if(originStack.length == 1)
        return;
      
      //remenar cartes
      originStack.shuffle();
  
      //find the new bottom sprite of the container
      const shuffledBottomSprite = originStack.first;
  
      //error si el nou sprite inferior es perd d'alguna manera
      if(!shuffledBottomSprite) {
        return;
      }
  
      //Trobeu la pila original per al nou sprite inferior
      const targetStack = getTableObject(self, shuffledBottomSprite.spriteId);
  
      //afegeix un fons nou a recentment Shuffled per retardar la remodelació
      delayReshuffle(targetStack);
  
      if (originStack != targetStack){
        //redefinir el shuffledStack
        targetStack.active = true;
        targetStack.x = originStack.x;
        targetStack.y = originStack.y;
        targetStack.angle = originStack.angle;
        targetStack.objectId = shuffledBottomSprite.spriteId;
  
        //colocar tots els antics sprites originStack a targetStack
        const originSprites = originStack.getAll();
        let tempItems = [];
        let tempIsFaceUp = [];
        for(var i = 0; i < originSprites.length; i++) {
          targetStack.add(originSprites[i]);
          tempItems.push(originSprites[i].spriteId);
          tempIsFaceUp.push(stackFacing);
        }
  
        //actualitzar els clients informant-los de la nova pila
        objectInfoToSend[targetStack.objectId] = {
          objectId: targetStack.objectId,
          items: tempItems,
          x: originStack.x,
          y: originStack.y,
          objectDepth: objectInfoToSend[originStack.objectId].objectDepth,
          isFaceUp: tempIsFaceUp,
          angle: targetStack.angle
        }
  
        originStack.active = false;       // Conservar per a un ús posterior
        objectInfoToSend[originStack.objectId] = null; //No enviar al client
      }
      else{
        //tornar a ordenar la pila original
        const originSprites = originStack.getAll();
        let tempItems = [];
        let tempIsFaceUp = [];
        for(var i = 0; i < originSprites.length; i++) {
          tempItems.push(originSprites[i].spriteId);
          tempIsFaceUp.push(stackFacing);
        }
  
        objectInfoToSend[targetStack.objectId].items = tempItems;
        objectInfoToSend[targetStack.objectId].isFaceUp = tempIsFaceUp;
      }
  
      //digues a tots els clients que juguin a l'animació aleatòria
      io.emit('shuffleAnim', {
        originId: originStack.objectId,
        targetId: targetStack.objectId
      });
    }
  }
  
  //retarda la barreja d'objectes que s'han remenat recentment
  function delayReshuffle(tableObject){
    //establiu un temporitzador per tornar a permetre remenar la coberta
    recentlyShuffled.push(tableObject.objectId);
    setTimeout(function() { 
      recentlyShuffled.splice(recentlyShuffled.indexOf(tableObject.objectId), 1);
    }, SHUFFLE_WAIT_TIME);
  }
  
  function setTableObjectPosition(self, objectId, xPos, yPos) {
    var obj = getTableObject(self, objectId);
    if(obj) {
      //Comprova els límits
      if(xPos < TABLE_CENTER_X - TABLE_EDGE_FROM_CENTER)
        xPos = TABLE_CENTER_X - TABLE_EDGE_FROM_CENTER;
      if(xPos > TABLE_CENTER_X + TABLE_EDGE_FROM_CENTER)
        xPos = TABLE_CENTER_X + TABLE_EDGE_FROM_CENTER
      if(yPos < TABLE_CENTER_Y - TABLE_EDGE_FROM_CENTER)
        yPos = TABLE_CENTER_Y - TABLE_EDGE_FROM_CENTER;
      if(yPos > TABLE_CENTER_Y + TABLE_EDGE_FROM_CENTER)
        yPos = TABLE_CENTER_Y + TABLE_EDGE_FROM_CENTER
      if(xPos + yPos > TABLE_EDGE_CONSTANT) {
        var newConstant = TABLE_EDGE_CONSTANT/(xPos + yPos);
        xPos *= newConstant;
        yPos *= newConstant;
      }
      if(yPos - xPos > TABLE_EDGE_CONSTANT) {
        var newConstant = TABLE_EDGE_CONSTANT/(yPos - xPos);
        xPos *= newConstant;
        yPos *= newConstant;
      }
      if(xPos + yPos < -TABLE_EDGE_CONSTANT) {
        var newConstant = -TABLE_EDGE_CONSTANT/(xPos + yPos);
        xPos *= newConstant;
        yPos *= newConstant;
      }
      if(yPos - xPos < -TABLE_EDGE_CONSTANT) {
        var newConstant = -TABLE_EDGE_CONSTANT/(yPos - xPos);
        xPos *= newConstant;
        yPos *= newConstant;
      }
      
      obj.setPosition(xPos, yPos);
    }
  }
  
  
  // Augmenta la profunditat general en un i comprova si s'ha de baixar
  function incOverallDepth() {
    overallDepth++;
    if(overallDepth > MAX_DEPTH) {
      overallDepth = Math.floor(overallDepth / 2) + 1;
      Object.keys(objectInfoToSend).forEach(key => {
        objectInfoToSend[key].objectDepth /= 2;
      });
    }
    return overallDepth;
  }
  
  function resetTable(self) {
    
    self.tableObjects.destroy(true);
    
    Object.keys(objectInfoToSend).forEach(key => {
      delete objectInfoToSend[key];
    });
    
    Object.keys(players).forEach(key => {
      players[key].hand = [];
      players[key].handX = [];
      players[key].handY = [];
      players[key].isFaceUp = [];
    });
    overallDepth = MIN_DEPTH;
    loadCards(self);
  }
  
  //reparteix fins a DEFAULT_HAND_SIZE cartes a totes les mans sense cartes DEFAULT_HAND_SIZE
  function autoDeal(self, originStack){
    for (let i = 0; i < DEFAULT_HAND_SIZE; i++) {
      Object.keys(players).forEach(key => {
        if(players[key].hand.length < DEFAULT_HAND_SIZE){
          let card = dealTopSprite(self, originStack); //obteniu la targeta superior d'originStack
          if (card){
            moveObjectToHand(self, card, players[key].playerId, players[key].hand.length)
          }
        }
      });
    }
  } 
   
  //retorna el sprite superior de l'objecte passat com a objecte nou
  function dealTopSprite(self, bottomStack) {
    if(!bottomStack || !bottomStack.last) {
      return;
    }
    const topSprite = bottomStack.last;                        //seleccioneu el sprite superior de la pila
    const topStack = getTableObject(self, topSprite.spriteId); //Trobeu la pila original amb la qual es va crear el sprite
    
    //torneu a definir la pila i torneu a posar-hi el seu sprite original
    topStack.active = true;
    topStack.x = bottomStack.x;
    topStack.y = bottomStack.y;
    topStack.objectId = topSprite.spriteId;
    topStack.add(topSprite);
  
    //actualitzar els clients dient-los que crean la nova pila
    objectInfoToSend[topStack.objectId]={
      objectId: topStack.objectId,
      items: [ objectInfoToSend[bottomStack.objectId].items.pop() ],
      x: bottomStack.x,
      y: bottomStack.y,
      objectDepth: incOverallDepth(),
      isFaceUp: [ objectInfoToSend[bottomStack.objectId].isFaceUp.pop() ]
    }
    return topStack; 
  }