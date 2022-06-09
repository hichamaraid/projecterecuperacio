import { loadCards } from './cartas.js';
import { cam, getParameterByName, playerNickname, setCameraBounds } from './joc.js';

export var playerRotation = 0, seatSelected = false;
var tableColor;

export var seats = {};

export function loadGameUI(self) {
  loadChat(self);
  loadHelp(self);
  loadMenu(self);
  loadSeats(self);
  loadCards(self);
}

function loadChat(self) {
  $('input').keypress(function (e) {
    if (e.keyCode == 32) {
    }
  });

  $('#chat-form').submit(function(e) {
    e.preventDefault();
    self.socket.emit('chat message', playerNickname + ': ' + $('#chat-msg').val());
    $('#chat-msg').val('');
    $('#chat-msg').blur();
    return false;
  });

  self.socket.on('chat message', function(msg){
    $('#messages').append($('<li>').text(msg));
  });
}

function loadHelp(self) {
  //  jQuery per interactuar amb l'element HTML d'ajuda
  $('#help-button').click(function() {
    if($('#help-area').css("display") == "none") {
      $('#help-area').show();

      self.input.keyboard.on('keyup-ESC', function (event) {
        $('#help-area').hide();
      });

      $('#exit-help').click(function() {
        $('#help-area').hide();
      });
    }
    else {
      $('#help-area').hide();
    }

    
  });
}

function loadMenu(self) {
    $('#no-submit-form').submit(false);
    // jQuery per interactuar amb l'element HTML del menú
    $('#menu-button').click(function() {
      if($('#menu-area').css("display") == "none") {
        // Mostra l'element del menú
        $('#menu-area').show();
        $('#user-name').val(playerNickname);
        $('#room-id').val(getParameterByName('roomCode'));
        
        $('#menu-form').submit(function(e) {
          e.preventDefault();
      
          if(playerNickname != $('#user-name').val()) {
            self.socket.emit('playerNickname', $('#user-name').val());
          }
        });
    
        self.input.keyboard.on('keyup-ESC', function (event) {
          $('#menu-area').hide();
        });
    
        $('#exit-menu').click(function() {
          $('#menu-area').hide();
        });

        $('#reset-table').click(function() {
          self.socket.emit('request', 'resetTable');
          $('#menu-area').hide();
        });
      }
      else {
        // Tancar menu
        $('#menu-area').hide();
      }

    });
}

function loadSeats(self) {

  self.socket.on('seatAssignments', function(serverSeats) {
    seats = serverSeats;
    if (seatSelected == false) {
      $('div > button[value = true]').parent().remove(); // evita botons duplicats si hi ha diverses persones
      for (var x in seats) {               // seleccionar seients al mateix temps
        addSeat(self, seats[x]);
      }
      selectSeat(self);
    } else {
      $('div > button[value = false').parent().remove();
      for (var x in seats) {
        addSeat(self, seats[x]);
      }
      $('button[value=true]').hide();
    }
  });
}

function selectSeat(self) {
  var seatX, seatY;
  $('div > button').click(function() {
    if ($(this).val() == 'true') {
      $(this).text(playerNickname);
      $(this).val(false);
      // Estableix l'angle de la càmera
      for (var x in seats) {
        if (seats[x].id == $(this).attr('id')) {
          playerRotation = seats[x].rotation;
          seatX = seats[x].x;
          seatY = seats[x].y;
          cam.setAngle(playerRotation);
          setCameraBounds(self);
        }
      }

      self.socket.emit('seatSelected', {
        socket: self.socket.id,
        id: $(this).attr('id'),
        name: $(this).text(),
        available: false,
        playerSpacing: playerRotation,
        x: seatX,
        y: seatY
      });
      seatSelected = true;

      $('button[value=true]').hide();
    }
  });
}

function addSeat(self, seat) {
  var dom = self.add.dom(seat.x, seat.y).createFromCache('avatar');
  var openSeat = document.getElementById('player-button');
  openSeat.id = seat.id;
  openSeat.innerText = seat.name;
  openSeat.value = seat.available;
  dom.updateSize();
  dom.angle = -seat.rotation;
  
  if(seat.color && seat.color != '') {
    openSeat.style.backgroundColor = seat.color;
    if(seat.color == 'white' || seat.color == 'pink')
      openSeat.style.color = 'black';
  }
  else
    openSeat.style.backgroundColor = "#40434E";
}

export function changeTableColor(self, color) {
  if(color != tableColor) {
    self.tableParts.getChildren().forEach(function (part) {
      part.setFillStyle(color);
    });
  }
}