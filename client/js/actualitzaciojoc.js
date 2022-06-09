import { 
    addTableObject, 
    cardNames,
    createSprite, 
    isDragging, 
    stackVisualEffect, 
    wasDragging,
    frames,
    waitUpdate
} from './cartas.js';

export function updateTableObjects(self, objectsInfo) {
  Object.keys(objectsInfo).forEach(function (id) {
    if(objectsInfo[id] != null) {
      var updatedAnObject = false;
      var count = 0;
      self.tableObjects.getChildren().forEach(function (object) {
        if(objectsInfo[object.objectId] == null) {
          if(isDragging != object.objectId && wasDragging != object.objectId) {
            object.removeAll(true);
            object.destroy();
          }
        }

        else if(object.objectId == id ) {
          if(!waitUpdate.includes(object.objectId)) {
            updateObject(self, 
                         objectsInfo[id].x, 
                         objectsInfo[id].y, 
                         objectsInfo[id].objectDepth, 
                         objectsInfo[id].angle,
                         objectsInfo[id].items,
                         objectsInfo[id].isFaceUp,
                         object);
          }

          updatedAnObject = true;
          count++;
        } 
      });

      if(!updatedAnObject && isDragging != id) {
        var object = addTableObject(self, objectsInfo[id].items, objectsInfo[id].x, objectsInfo[id].y, objectsInfo[id].isFaceUp);
        object.angle = objectsInfo[id].angle;
        object.depth = objectsInfo[id].objectDepth;
      }
    }
  });

  self.tableObjects.getChildren().forEach(function (object) {
    if(objectsInfo[object.objectId] == null) {
      if(isDragging != object.objectId && wasDragging != object.objectId) {
        object.removeAll(true);
        object.destroy();
      }
    }
  });
}

export function updateObject(self, xPos, yPos, objectDepth, angle, items, isFaceUp, object) {
  if(!object) { 
    return;
  }
  object.active = true;
  object.setVisible(true);
  object.objectId = items[0];

  if(isDragging != object.objectId && wasDragging != object.objectId) {
    if(object.x != xPos || object.y != yPos) {
      object.setPosition(xPos, yPos);
    }
    if(object.depth != objectDepth) {
      object.depth = objectDepth;
    }

    object.angle = angle;
  }
  for (var i = 0; i < Math.max(object.length, items.length); i++) {
    var serverSpriteId = items[i];
    if(i >= object.length) {
      var newSprite = createSprite(self, serverSpriteId, cardNames[serverSpriteId], isFaceUp[i]);
      object.add(newSprite); // Afegeix al final de la llista
    }
    else if(i >= items.length) {
      object.removeAt(i, true);
    }
    else {
      var spriteToUpdate = object.getAt(i);

      updateSprite(spriteToUpdate, serverSpriteId, isFaceUp[i]);

      stackVisualEffect(self, spriteToUpdate, angle, i, items.length-1);
    }
  }
  return object;
}


export function updateSprite(oldSprite, newId, newIsFaceUp) {
  if(oldSprite) {
    oldSprite.spriteId = newId;
    oldSprite.name = cardNames[newId];
    if(newIsFaceUp) 
      oldSprite.setFrame(frames[frames.indexOf(cardNames[newId])]);
    else
      oldSprite.setFrame(frames[frames.indexOf('back')]);
    oldSprite.isFaceUp = newIsFaceUp;
  }
}