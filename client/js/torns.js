import { 
    MENU_DEPTH,
    CARD_WIDTH,
    CARD_HEIGHT,
    frames,
    cardNames,
    isDragging,
    draggingObj,
    drewAnObject,
    addObject,
    rotateObject,
    setDrewAnObject,
    addTableObject,
    setDraggingObj,
    options
} from './cartas.js';

import { 
    updateObject
} from './actualitzaciojoc.js';


// VARIABLES
const HAND_WIDTH = 400;
const HAND_HEIGHT = 75;
const HAND_SPACING = 50;
const HAND_SNAP_DIST = 100;
const HAND_DEPTH = 10;
const HAND_ZONE_SIZE = 150;

// VARIABLES GLOBALS
export const hands = {};      // Objecte amb informació sobre les mans dels jugadors
// Crea un objecte per a la mà. Només ha de tenir un spriteId i spriteOrientation
function addHandObject(self, playerId, pos, angle, spriteId, x, y, isFaceUp) {
  const isMe = playerId == self.socket.id;
  var object = addObject(self, [spriteId], x, y, [isFaceUp]);
  if(!isMe && isFaceUp) // Amaga la targeta si no jo
    object.first.setFrame(frames[frames.indexOf('joker')]); // Marcador de posició de Joker
  object.playerId = playerId;   // Jugador al qual pertany la carta
  object.pos = pos;             // Posició a la mà
  object.angle = angle;
  object.depth = HAND_DEPTH;

  self.handObjects.add(object); // Afegeix al grup de mans    
  return object;
}

export function addHand(self, playerId, xPos, yPos, angle) {
  // Zona interior que detecta quan hi ha una targeta per sobre
  var snapZone = self.add.rectangle(xPos, yPos, HAND_ZONE_SIZE, HAND_ZONE_SIZE, 0xff4c4c);
  snapZone.setVisible(false); // Estableix visible per a la depuració
  snapZone.playerId = playerId;
  snapZone.angle = angle;
  snapZone.depth = HAND_DEPTH-1;
  self.handSnapZones.add(snapZone);

  hands[playerId] = {
    playerId: playerId,
    angle: angle,
    size: 0             // Quantes cartes a la mà
  }
}

export function updateHand(self, playerId, xPos, yPos, spriteIds, objectXs, objectYs, isFaceUp, angle) {
  if(!hands[playerId]) {
    return;
  }
  // Actualitza la zona de captura de mà
  self.handSnapZones.getChildren().forEach(function (zone) {
    if(zone.playerId == playerId) {
      zone.x = xPos;
      zone.y = yPos;
    }
  }); 

  hands[playerId].angle = angle;
  hands[playerId].size = spriteIds.length;

  // Recorre la llista de servidors
  for(var i = 0; i < spriteIds.length; i++) {
    var serverSpriteId = spriteIds[i];
    var serverIsFaceUp = isFaceUp[i];
    var serverX = objectXs[i];
    var serverY = objectYs[i];
    var hasUpdated = false;

    //Recorre els objectes del joc local
    var count = 0;
    self.handObjects.getChildren().forEach(function (handObject) {
      if(handObject.objectId == serverSpriteId) {
        // Actualitzar l'objecte a la mà
        updateHandObject(self, handObject, playerId, i, angle, serverSpriteId, serverX, serverY, serverIsFaceUp);
        hasUpdated = true;
        count++;
      }
    });
    if(!hasUpdated && isDragging != serverSpriteId) {
      // Crear objecte
      addHandObject(self, playerId, i, angle, serverSpriteId, serverX, serverY, serverIsFaceUp);
    }
  }
  // Comproveu si hi ha objectes que no estiguin a la llista i suprimiu-los
  self.handObjects.getChildren().forEach(function (object) {
    if(object.playerId == playerId && spriteIds[object.pos] != object.objectId &&
       isDragging != object.objectId
    ) {
      object.removeAll(true); 
      object.destroy();
    }
  });
}

// Busca la zona de mà i s'hi insereix
export function checkSnapToHand(self, object) {
  var hand = findClosestHandZone(self, object);
  // Afegeix a la mà buida
  if(hand && hand.size == 0) {
    moveObjectToHand(self, object, hand.playerId, 0);
    return true;
  }
  else {
    var data = findPosToInsertInHand(self, object);
    var playerId = data[0];
    var pos = data[1];
    if(pos != -1) {
      moveObjectToHand(self, object, playerId, pos);
      return true;
    }
  }
  return false;
}

//Retorna l'objecte mà si el punter està per sobre. en cas contrari null
function findClosestHandZone(self, object) {
  var closestHand = null;
  var objBounds = object.getBounds();
  self.handSnapZones.getChildren().forEach(function (zone) {
    var zoneBounds = zone.getBounds();
    if(Phaser.Geom.Intersects.RectangleToRectangle(objBounds, zoneBounds))
      closestHand = hands[zone.playerId];
  }); 
  return closestHand;
}

// Mou una pila sencera a la mà
function moveObjectToHand(self, object, playerId, pos) {
  self.socket.emit('objectToHand', { 
    objectId: object.objectId,
    playerId: playerId,
    pos: pos
  });

  
}

function takeFromHand(self, object) {
  const playerId = object.playerId; 
  if(!playerId) {
    return;
  }
  // Mans bloquejades (els altres jugadors no poden agafar cartes de la teva mà)
  else if(options["lockedHands"] && (playerId != self.socket.id)) {
    return;
  }
  setDrewAnObject(true);
  const spriteId = object.first.spriteId;
  var isFaceUp = object.first.isFaceUp;
  if(options["flipWhenExitHand"]) 
    isFaceUp = false;  // Gireu sempre la targeta en agafar
  const x = object.x;
  const y = object.y;
  
  self.socket.emit('handToTable', { 
    objectId: object.objectId,
    playerId: playerId,
    x: x,
    y: y
  });
  setDraggingObj(addTableObject(self, [spriteId], x, y, [isFaceUp]));

}


function updateHandObject(self, object, playerId, pos, angle, spriteId, x, y, isFaceUp) {
  var updated = updateObject(self, x, y, pos+HAND_DEPTH, angle, [spriteId], [isFaceUp], object);
  const isMe = self.socket.id == playerId;
  if(!isMe && isFaceUp) {
    updated.first.setFrame(frames[frames.indexOf('joker')]);
  }
  updated.playerId = playerId;
  updated.pos = pos;
  return updated;
}

export function flipHandObject(self, object) {
  self.socket.emit('objectFlip', { 
    objectId: object.objectId,
    playerId: object.playerId
  });

  // Gira el sprite superior per a les aparences
  var sprite = object.first;
  if(!sprite.isFaceUp) 
    sprite.setFrame(frames[frames.indexOf(cardNames[sprite.spriteId])]);
  else
    sprite.setFrame(frames[frames.indexOf('back')]);   
}

export function checkForHandZone(self, gameObject, dragX, dragY) {
  var foundHand = false;
  var dist = HAND_SNAP_DIST;

  self.handObjects.getChildren().forEach(function (handObject) {
    if(handObject.objectId != gameObject.objectId) {
      var tempDistance = Phaser.Math.Distance.BetweenPoints(gameObject, handObject);
      if(tempDistance < dist) {
        dragHandObject(self, gameObject, dragX, dragY);
        foundHand = true;
      } 
    }
  });
  if(
    !foundHand &&                   // No en una handZone
    gameObject === draggingObj && 
    !drewAnObject 
  ) {
    takeFromHand(self, gameObject);
  }
}

function dragHandObject(self, gameObject, dragX, dragY){
  if(gameObject) {
    // Canvia localment la posició de l'objecte
    gameObject.x = dragX;
    gameObject.y = dragY;
    gameObject.depth = MENU_DEPTH-1;

    rotateObject(self, gameObject);

    // Envia l'entrada al servidor
    self.socket.emit('objectInput', { 
      objectId: gameObject.objectId,
      playerId: gameObject.playerId,
      x: dragX, 
      y: dragY 
    });
  }
}

// Canvia la posició de les cartes a la mà
export function moveAroundInHand(self, object) {
  var data = findPosToInsertInHand(self, object);
  var playerId = data[0];
  var pos = data[1];
  if(pos != -1) {
    self.socket.emit('handToHand', { 
      objectId: object.objectId,
      playerId: playerId,
      pos: pos  // Posició on moure's
    });
  }
 
    
}

function findPosToInsertInHand(self, object) {
  var closest = null;
  var dist = HAND_SNAP_DIST;
  var secondClosest = null;
  var dist2 = HAND_SNAP_DIST;

  self.handObjects.getChildren().forEach(function (handObject) {
    if(handObject.objectId != object.objectId) {
      var tempDistance = Phaser.Math.Distance.BetweenPoints(object, handObject);
      if(tempDistance < dist) {
        secondClosest = closest;
        closest = handObject;
        dist2 = dist;
        dist = tempDistance;
      } 
      else if(tempDistance < dist2) {
        secondClosest = handObject;
        dist2 = tempDistance;
      }
    }
  });

  if(closest) {
    var hand = hands[closest.playerId];
    var angle = Phaser.Math.DegToRad(hand.angle);
    var isLeftOfClosest = Math.cos(angle) * (object.x-closest.x) + Math.sin(angle) * (object.y-closest.y) < 0;
  
    // Dos objectes mà estan a prop
    if(secondClosest && closest.playerId == secondClosest.playerId) {
      var leftPos = Math.min(closest.pos, secondClosest.pos);
      var rightPos = Math.max(closest.pos, secondClosest.pos);
      var isLeftOfSecondClosest = Math.cos(angle) * (object.x-secondClosest.x) + Math.sin(angle) * (object.y-secondClosest.y) < 0;
      
      if(isLeftOfClosest && isLeftOfSecondClosest) 
        return [closest.playerId, leftPos];        // L'esquerra de les dues cartes
      else if(!isLeftOfClosest && !isLeftOfSecondClosest)
        return [closest.playerId, rightPos+1];     // Dreta de les dues cartes
      else 
        return [closest.playerId, rightPos];       // Entre les cartes
    }
    else {  // Només hi ha una carta a prop
      if(isLeftOfClosest)
        return [closest.playerId, closest.pos];    // Esquerra de la carta
      else
        return [closest.playerId, closest.pos+1];  // Dreta de la carta
    }
  }
  return -1; //No hi ha objectes prou a prop
}