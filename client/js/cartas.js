import { debugTicker } from './actualitzar.js';
import { players,
    TABLE_CENTER_X,
    TABLE_CENTER_Y,
    TABLE_EDGE_FROM_CENTER,
    TABLE_EDGE_CONSTANT
} from './joc.js';
import { 
    updateTableObjects,
    updateSprite,
    updateObject
} from './actualitzaciojoc.js';

import { 
    checkForHandZone,
    checkSnapToHand,
    moveAroundInHand,
    flipHandObject
} from './torns.js';

import { playerRotation } from './joclogica.js';

// VARIABLES
export const MENU_DEPTH = 1000;
export const CURSOR_DEPTH = 950;
const STACK_SNAP_DISTANCE = 10;
const LONG_PRESS_TIME = 300;
export const CARD_WIDTH = 70;
export const CARD_HEIGHT = 95;
const WAIT_UPDATE_INTERVAL = 150;
const SHUFFLE_WAIT_TIME = 1000;


// VARIABLES GLOBALS
export const cardNames = ['atras', 
  'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'o10', 'o11', 'o12', 'c1',
  'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8','c9', 'c10', 'c11', 'c12', 'e1', 'e2',
  'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'b1', 'b2', 'b3',
  'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12'
];
export let frames;            // Punter global als marcs de textura de la targeta
export var isDragging = -1;   // L'identificador d'un objecte que s'està arrossegant actualment.
export var wasDragging = -1;  //Identificador d'objecte que s'ha arrossegat recentment. Per compensació de retard.
export var draggingObj = null;    // El punter a l'objecte que s'està arrossegant actualment
export var drewAnObject = false;  // Feu un seguiment si heu dibuixat un element per no dibuixar-ne múltiples
var hoveringObj = null;       // Punter a l'objecte sobre el qual es passa el cursor 
export var options = {};      //Opcions per al joc
var debugMode = false;
export const waitUpdate = [];        // Llista d'objectes a esperar actualització
var recentlyShuffled = false;
var lockedStacks = [];

export function loadCards(self) {
  frames = self.textures.get('cards').getFrameNames();
  self.input.mouse.disableContextMenu();
  // Només agafa l'objecte superior
  self.input.topOnly = true;
  
  self.input.on('pointerover', function(pointer, justOver){
    hoveringObj = justOver[0];
  });  

  self.input.on('pointermove', function(pointer, currentlyOver){
    hoveringObj = currentlyOver[0];
  }); 

  self.input.on('pointerout', function(pointer, justOut){
    hoveringObj = null;
  });

  self.input.on('pointerdown', function (pointer, currentlyOver) {
    if (pointer.rightButtonDown()) {
      var object = currentlyOver[0];
      flipTableObject(self, object);
    }
  });

  // Quan el ratolí comença a arrossegar l'objecte
  self.input.on('dragstart', function (pointer, gameObject) {
    isDragging = gameObject.objectId;
    draggingObj = gameObject;
    if(!options["lockedHands"] || (!draggingObj.playerId || draggingObj.playerId == self.socket.id))
      draggingObj.depth = MENU_DEPTH-1;
    self.socket.emit('objectDepth', { // Indica al servidor que augmenti la profunditat de l'objecte
      objectId: gameObject.objectId
    });
  });
  
  // Mentre el ratolí arrossega
  self.input.on('drag', function (pointer, gameObject, dragX, dragY) {
    if(!lockedStacks.includes(gameObject.objectId)){
      if( 
          gameObject === draggingObj && 
          !drewAnObject &&
          draggingObj.length > 1 && 
          pointer.moveTime - pointer.downTime < LONG_PRESS_TIME
         
      ) {
        drawTopSprite(self);
      } 
      //Arrossegar l'objecte de la taula
      if(self.tableObjects.contains(draggingObj))
        dragTableObject(self, draggingObj, dragX, dragY);
      // Arrossegar l'objecte de la mà
      else if(
          self.handObjects.contains(draggingObj) && 
          // No es poden arrossegar altres jugadors
          (!options["lockedHands"] || (!draggingObj.playerId || draggingObj.playerId == self.socket.id))
      ) {
        checkForHandZone(self, draggingObj, dragX, dragY); 
      }
    }
  });
  
  // Quan el ratolí acabi d'arrossegar
  self.input.on('dragend', function (pointer, gameObject) {

    if(!onObjectDrop(self, draggingObj)) {    //Deixar a la taula/en altres cartes a la taula
      if(self.tableObjects.contains(draggingObj))
        checkSnapToHand(self, draggingObj);   //Eliminar carta a la mà
      else
        moveAroundInHand(self, draggingObj);  // Canviar de posició a la mà
    }

    wasDragging = isDragging;
    isDragging = -1; 
    draggingObj = null;
    drewAnObject = false;

    setTimeout(function() { 
      wasDragging = -1;
    }, 300);
  });  

  //barreja hoveringObj a la tecla R
  self.input.keyboard.on('keyup_R', function () {
    if(hoveringObj && self.tableObjects.contains(hoveringObj)) {
      shuffleStack(self, hoveringObj);
    }
  });

  self.input.keyboard.on('keyup_D', function(){
    if(hoveringObj && self.tableObjects.contains(hoveringObj)) {
      autoDeal(self, hoveringObj);
    }
  });

  self.input.keyboard.on('keyup_F', function (event) {
    if(hoveringObj && self.tableObjects.contains(hoveringObj)) 
      flipTableObject(self, hoveringObj);
    else if(hoveringObj && self.handObjects.contains(hoveringObj)) 
      flipHandObject(self, hoveringObj);
  });

  //Inicieu l'escolta d'objectes per a les ordres del servidor
  self.socket.on('objectUpdates', function (objectsInfo) {
    updateTableObjects(self, objectsInfo);
  });

  self.socket.on('options', function (optionsInfo) {
    options = optionsInfo;
    if(options["debugMode"] == true & debugMode == false) {
      debugMode = true;
      debugTicker(self);
    }
  });

  self.socket.on('shuffleAnim', (objectInfo)=>{
    shuffleTween(self, objectInfo);
  });
}

export function addTableObject(self, spriteIds, x, y, spriteOrientations) {
  var object = addObject(self, spriteIds, x, y, spriteOrientations);
  self.tableObjects.add(object);
  return object;
}

// Pot tenir diversos sprites per a un objecte (en el cas d'una pila)
export function addObject(self, spriteIds, x, y, spriteOrientations) {
  const spritesToAdd = []; // Matriu d'objectes sprite per afegir al contenidor de pila
  // primer spriteId sempre serà igual a objectId
  for(let i = 0; i < spriteIds.length; i++) {
      var spriteId = spriteIds[i];
      spritesToAdd[i] = createSprite(self, spriteId, cardNames[spriteId], spriteOrientations[i]);

      //Efecte visual 
      stackVisualEffect(self, spritesToAdd[i], 0, i, spriteIds.length-1);
  }
  // Creeu un objecte semblant a una pila (pot tenir diversos sprites)
  const object = self.add.container(x, y, spritesToAdd); //El servidor el mourà amb "ObjectUpdates"
  object.objectId = spriteIds[0];  // El primer spriteId és sempre objectId
  object.setSize(CARD_WIDTH, CARD_HEIGHT);
  object.setInteractive();         // Feu interactiu amb el ratolí
  self.input.setDraggable(object);

  return object;
}

export function createSprite(self, spriteId, spriteName, isFaceUp) {
  var frame;
  if(isFaceUp)
    frame = frames[frames.indexOf(spriteName)];
  else
    frame = frames[frames.indexOf('back')];
  // crear sprite
  const sprite = self.add.sprite(0, 0, 'cards', frame);
  sprite.spriteId = spriteId;
  sprite.name = spriteName;
  sprite.displayWidth = CARD_WIDTH;
  sprite.displayHeight = CARD_HEIGHT;
  sprite.isFaceUp = isFaceUp;

  return sprite;
}

// Actualitza tots els sprites d'una pila d'objectes amb l'efecte visual
function updateStackVisualEffect(self, object) {
  var pos = 0;
  var size = object.length-1;
  object.getAll().forEach(function (sprite) {
    stackVisualEffect(self, sprite, object.angle, pos, size);
    pos++;
  });
}

// Fa que una pila de cartes sembli 3D
export function stackVisualEffect(self, sprite, parentAngle, pos, size) {
  if(sprite && players[self.socket.id]) {
    var preX = -Math.floor((size-pos)/10);
    var preY = Math.floor((size-pos)/4);
    var angle = Phaser.Math.DegToRad(parentAngle + playerRotation);
    sprite.x = Math.cos(angle) * preX + Math.sin(angle) * preY;
    sprite.y = Math.cos(angle) * preY - Math.sin(angle) * preX;
  }
}

// S'anomena quan es deixa caure un objecte
function onObjectDrop(self, gameObject) {
  // Trobeu l'objecte més proper per fixar-vos
  var closest = findSnapObject(self, gameObject);
  if(closest) {
    //Mou la targeta superior a la posició de la targeta inferior
    gameObject.x = closest.x;
    gameObject.y = closest.y;
    gameObject.angle = closest.angle;

    // Digues al servidor que fusioni les dues piles
    self.socket.emit('mergeStacks', { 
      topStack: gameObject.objectId,
      bottomStack: closest.objectId
    });
    self.socket.emit('objectInput', { 
      objectId: closest.objectId,
      x: closest.x, 
      y: closest.y 
    });

    // Fusionar localment
    const topSprites = gameObject.getAll();
    for(var i = 0; i < topSprites.length; i++) {
      var oldSprite = gameObject.getAt(i);
      // Heu de crear un sprite nou. Afegint l'antic Sprite bloqueja el phaser.
      var newSprite = createSprite(self, oldSprite.spriteId, oldSprite.name, oldSprite.isFaceUp);
      closest.add(newSprite); // Copia els sprites a la pila inferior
    }

    updateStackVisualEffect(self, closest);
    setWaitObjUpdate(self, closest); 

    return true;
  } 
  else return false;
}
  
// Troba el primer objecte dins de la distància de fixació, retorna null si no n'hi ha cap
function findSnapObject(self, gameObject) {
  var closestObj = null;
  var distance = STACK_SNAP_DISTANCE;
  self.tableObjects.getChildren().forEach(function (tableObject) {
    if (gameObject !== tableObject) {
      var tempDistance = Phaser.Math.Distance.BetweenPoints(gameObject, tableObject);
      if(tempDistance < distance) {
      closestObj = tableObject;
      distance = tempDistance;
      }
    }
  });
  return closestObj;
}
  
// Actualitza la variable global draggingObj
function drawTopSprite(self){
  // Assegureu-vos de dibuixar només una vegada
  self.socket.emit('drawTopSprite', {
    bottomStack: draggingObj.objectId
  });

  let drawnSpriteId = draggingObj.last.spriteId;
  draggingObj.last.setVisible(false);
  draggingObj.remove(draggingObj.last, true);
  setWaitObjUpdate(self, draggingObj);

  draggingObj = addTableObject(self, [drawnSpriteId], draggingObj.x, draggingObj.y, [draggingObj.last.isFaceUp]);
 
  draggingObj.depth = MENU_DEPTH-1;
  wasDragging = isDragging;
  isDragging = draggingObj.objectId;
  
  drewAnObject = true;
}

function dragTableObject(self, gameObject, dragX, dragY){
  if(gameObject) {    
    // Comprova els límits
    if(dragX < TABLE_CENTER_X - TABLE_EDGE_FROM_CENTER)
      dragX = TABLE_CENTER_X - TABLE_EDGE_FROM_CENTER;
    if(dragX > TABLE_CENTER_X + TABLE_EDGE_FROM_CENTER)
      dragX = TABLE_CENTER_X + TABLE_EDGE_FROM_CENTER
    if(dragY < TABLE_CENTER_Y - TABLE_EDGE_FROM_CENTER)
      dragY = TABLE_CENTER_Y - TABLE_EDGE_FROM_CENTER;
    if(dragY > TABLE_CENTER_Y + TABLE_EDGE_FROM_CENTER)
      dragY = TABLE_CENTER_Y + TABLE_EDGE_FROM_CENTER
    if(dragX + dragY > TABLE_EDGE_CONSTANT) {
      var newConstant = TABLE_EDGE_CONSTANT/(dragX + dragY);
      dragX *= newConstant;
      dragY *= newConstant;
    }
    if(dragY - dragX > TABLE_EDGE_CONSTANT) {
      var newConstant = TABLE_EDGE_CONSTANT/(dragY - dragX);
      dragX *= newConstant;
      dragY *= newConstant;
    }
    if(dragX + dragY < -TABLE_EDGE_CONSTANT) {
      var newConstant = -TABLE_EDGE_CONSTANT/(dragX + dragY);
      dragX *= newConstant;
      dragY *= newConstant;
    }
    if(dragY - dragX < -TABLE_EDGE_CONSTANT) {
      var newConstant = -TABLE_EDGE_CONSTANT/(dragY - dragX);
      dragX *= newConstant;
      dragY *= newConstant;
    }

    // Canvia localment la posició de l'objecte
    gameObject.x = dragX;
    gameObject.y = dragY;
    gameObject.depth = MENU_DEPTH-1;

    rotateObject(self, draggingObj);

    // Envia l'entrada al servidor
    self.socket.emit('objectInput', { 
      objectId: gameObject.objectId,
      x: dragX, 
      y: dragY 
    });
  }
}

export function rotateObject(self, gameObject) {
  var player = players[self.socket.id];
  if(gameObject.angle != -playerRotation) {
    gameObject.angle = -player.playerSpacing;

    self.socket.emit('objectRotation', { 
      objectId: gameObject.objectId,
      angle: gameObject.angle
    });
  }
}

function shuffleStack(self, object){
  if(object && object.length > 1  && object.objectId!=isDragging){
    if(!recentlyShuffled){
      delayShuffle();
      self.socket.emit('shuffleStack', {
        objectId: object.objectId
      });
    }
  }
} 

//torna a retardar la barreja durant SHUFFLE_WAIT_TIME per evitar trampes
function delayShuffle (){
  recentlyShuffled = true;
  setTimeout(function() { 
    recentlyShuffled= false;
  }, SHUFFLE_WAIT_TIME);
}

//reprodueix una animació per representar la barreja de la pila mentre no permet el moviment d'aquesta pila
function shuffleTween(self, objectInfo){
  //Trobeu la pila correcta per animarla
  self.tableObjects.getChildren().forEach((stack)=>{
    let targetStackSprites = []; //tots els sprites de l'objectiu
    let targets = []; //sprites per animar les escenes
    if(stack.objectId == objectInfo.originId){
      targetStackSprites = stack.getAll();
      
      //tria els primers 10 sprites amb els quals animar
      for (let i = targetStackSprites.length; i > targetStackSprites.length-10; i--){
        if(targetStackSprites[i]){
          let sprite;
          if(targetStackSprites[i].isFaceUp){
            sprite = self.add.sprite(stack.x, stack.y, 'cards', frames[frames.indexOf(targetStackSprites[i].name)]);
          }
          else{
            sprite = self.add.sprite(stack.x, stack.y, 'cards', frames[frames.indexOf("back")]);
          }
          sprite.removeInteractive();
          sprite.setRotation(Phaser.Math.DegToRad(playerRotation))
          sprite.displayWidth = CARD_WIDTH;
          sprite.displayHeight = CARD_HEIGHT;
          sprite.setDepth(stack.depth+1);
          targets.push(sprite);  
        }
      }

      //deixar d'enviar actualitzacions per a la pila barrejada
      setWaitObjUpdate(self, stack, SHUFFLE_WAIT_TIME);
      //bloquejar les piles d'origen/objectiu per evitar que es moguin durant l'animació
      lockedStacks.push(objectInfo.originId);
      lockedStacks.push(objectInfo.targetId);

      //animeu els sprites escollits i elimineu les piles d'origen/destinació de les piles bloquejades
      let tween = self.tweens.add({
        targets: targets,
        angle: 360,
        duration: SHUFFLE_WAIT_TIME,
        delay: self.tweens.stagger(100),
        onComplete: ()=>{
          targets.forEach((sprite)=>{
            sprite.destroy();
          });
          lockedStacks.splice(lockedStacks.indexOf(objectInfo.originId));
          lockedStacks.splice(lockedStacks.indexOf(objectInfo.targetId));
        }
      });
    }
  });
}

function flipTableObject(self, gameObject) {
  if(gameObject) {
    self.socket.emit('objectFlip', { 
      objectId: gameObject.objectId
    });
    
    if(gameObject.length == 1) {
      // Gira el sprite superior per a les aparences
      var sprite = gameObject.first;
      if(!sprite.isFaceUp) 
        sprite.setFrame(frames[frames.indexOf(cardNames[sprite.spriteId])]);
      else
        sprite.setFrame(frames[frames.indexOf('back')]); 
    } 
    else {
      gameObject.objectId = gameObject.last.spriteId;
      var lowerSprite = gameObject.first;
      var upperSprite = gameObject.last;
      var lowerSpriteId = lowerSprite.spriteId;
      var upperSpriteId = upperSprite.spriteId;
      var lowerOrientation = !lowerSprite.isFaceUp;
      var upperOrientation = !upperSprite.isFaceUp;

      // Inverteix els valors
      updateSprite(lowerSprite, upperSpriteId, upperOrientation, frames);
      updateSprite(upperSprite, lowerSpriteId, lowerOrientation, frames);
    }
    setWaitObjUpdate(self, gameObject);
  }
}

export function setDrewAnObject(setting) {
  drewAnObject = setting;
}

export function setDraggingObj(object) {
  draggingObj.x = -2000;
  draggingObj.y = -2000;
  draggingObj.setVisible(false);
  draggingObj.setActive(false);
  
  draggingObj = object;
  isDragging = object.objectId;
  draggingObj.depth = MENU_DEPTH-1; 
  return draggingObj;
}

async function setWaitObjUpdate(self, object, customInterval) {
  waitUpdate.push(object.objectId);
  setTimeout(function() { 
    waitUpdate.splice(waitUpdate.indexOf(object.objectId));
  }, customInterval || WAIT_UPDATE_INTERVAL);
}

function autoDeal(self, object){
  if(object && object.length > 1  && object.objectId!=isDragging){
    if(!recentlyShuffled){

      self.socket.emit('autoDeal', {
        objectId: object.objectId
      });
    }
  }
}