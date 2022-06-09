import { 
    cardNames
  } from './cartas.js';
  
  import { 
    hands
  } from './torns.js';
  
  import { 
    players
  } from './joc.js';
  
  export function debugObjectContents(object) {
   
    
    var i = 0;
  
    object.getAll().forEach(function (sprite) {
     
      i++;
    });
  
  }
    
  export function debugTicker(self) {

    let tickInterval = setInterval(() => {
  
      var totalCards = 0;
      self.tableObjects.getChildren().forEach((object) => {
          totalCards += object.length;
      });
  
     
      var string;
    
  
      Object.keys(players).forEach(key => {
        string = "  In players object          :" + players[key].name + " has ";
        for(var i = 0; i < players[key].hand.length; i++) {
          string += cardNames[players[key].hand[i]] + " ";
        }
   
      });
  
    }, 10000); 
  
  }