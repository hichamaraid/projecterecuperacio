function debugObjectContents(object) {
    var i = 0;
    const perRow = 4;
    var last;
    var string = "";
    object.getAll().forEach(function (sprite) {
      if(i % perRow != 0)
        string +=  ",   ";
      if(i < 10)
        string += "[" + i + "] :" + sprite.name;
      else
        string += "[" + i + "]:" + sprite.name;
      if(sprite.isFaceUp)
        string += "( up )";
      else
        string += "(down)"; 
  
      i++;
      if(i % perRow == 0) {
        string = "";
      }
    });
  }
  
  function debugTicker(self) {
    var tickRate = 15000;
    let tickInterval = setInterval(() => {
      var cardInfo = 0;
      Object.keys(objectInfoToSend).forEach(key => {
        if(objectInfoToSend[key]) {
          cardInfo += objectInfoToSend[key].items.length;
   
        }
      });
      var serverCards = 0;
      self.tableObjects.getChildren().forEach(function (tableObject) {
        if(tableObject.active) {
          serverCards += tableObject.length;
        }
      });
  
      var string;
  
      Object.keys(players).forEach(key => {
        string = "  To client:" + players[key].name + " has ";
        for(var i = 0; i < players[key].hand.length; i++) {
          string += cardNames[players[key].hand[i]];
          if(players[key].isFaceUp[i])
            string += "▲, ";
          else
            string += "▼, ";
        }
  
      });
    }, tickRate); 
  }