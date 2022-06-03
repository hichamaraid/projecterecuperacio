const path = require('path');
const jsdom = require('jsdom');
const express = require('express');
const { Pool } = require('pg');

const app = express();
const server = require('http').Server(app);
const io = require('socket.io').listen(server);
const Datauri = require('datauri');
const querystring = require('querystring');
 
var bodyParser = require('body-parser');

const datauri = new Datauri();
const { JSDOM } = jsdom;

let port = process.env.PORT || 3000;

const CONNECTION_STRING = process.env.DATABASE_URL || '';

const IS_LOCAL = CONNECTION_STRING == '';

const SalesDeJocActives = {};

let joc;

if(!IS_LOCAL) {

    joc = new Joc({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });} else {console.log('SERVIDOR EXECUTANT');}


iniciarbasededades();

app.set('servidor', 'ejs');
app.use(express.static(__dirname + '/client'));

app.get('/', function(req,res){
    let reqsala = req.query.codisala || '';

    if(!IS_LOCAL){
        (async function(){
            let query = {
                text: "SELECT * FROM sales WHERE codisala = $1",
                values: [reqsala]
            };
            const jugador = await joc.connect();
            await jugador.query(query, (error, resultat) => {
                if(error){
                    console.error(error);
                    return;
                }
                if(resultat.rows.length == 0){
                    console.log('No existeix aquesta sala');
                    SalesDeJocActives[reqsala] = null;
                }
                enrutamentjoc(reqsala, req, res);
                jugador.release();
            });
        })
    }else{
        enrutamentjoc(reqsala,req,res);
    }
});

function enrutamentjoc(reqsala, req, res){
    if(!reqsala || reqsala == ''){
        actualitzar(res).catch(error => {console.error(error)})
    }
    else if(SalesDeJocActives[reqsala] && SalesDeJocActives[reqsala].numerojugadors < SalesDeJocActives[reqsala].maximjugadors){
        var nickname = req.query.nickname || '';
        if(nickname != ''){
            const query = querystring.stringify({
                'nickname': nickname
            });
            res.sendFile(__dirname + '/client/views/index.html', query);
        }else{
            res.sendFile(__dirname + '/client/views/index.html');
        }
    }
}

async function actualitzar(res){
    let query = {
        text: "SLEECT * FROM sales",
        values:[]
    };
    if(!IS_LOCAL){
        const jugador = await joc.connect();
        await jugador.query(query).then((resultat) => {
            Object.keys(SalesDeJocActives).forEach(clau =>{
                delete SalesDeJocActives[clau];
            });
            if(resultat.rows.length == 0){
                console.log("NO HI HAN RESULTATS");
            }
            else{
                resultat.rows.forEach(row => {
                    AfegirASalesDeJocActives(row.codisala, row.numerojugadors, row.maximjugadors, row.nomsala, row.amfitriosala, row.descripciojoc);
                });
            }
            res.render(__dirname + '/client/views/lobby.ejs', {SalesDeJocActives: SalesDeJocActives});
            jugador.release();
        })
    }
    else{
        res.render(__dirname + '/client/views/lobby.ejs', {SalesDeJocActives: SalesDeJocActives});
    }
}

app.post('/cinquillojoc', function(req, res){
    var novaidsala = uniqueId();
    while(SalesDeJocActives[novaidsala])
        novaidsala = uniqueId();

        let nickname = req.body.nickname || '';
        let maximjugadors = req.body.maximjugadors;
        let nomsala = req.body.nomsala || nickname;
        let descripciosala = req.body.descripciosala || '';

        createSala(novaidsala, maximjugadors, nomsala, nickname, descripciosala).catch( error => { console.error(error) });

        if(nickname != '')
            nickname = '&nickname=' + nickname;

            const query = querystring.stringify({
                "codisala": novaidsala
            });

            res.redirect('/?' + query + nickname); 
});

async function createSala(codisala, maximjugadors, nomsala, amfitriosala, descripciojoc) {
    if(!IS_LOCAL) {
      const query = {
        text: 'INSERT INTO sales (codisala, numerojugadors, maximjugadors, nomsala, amfitriosala, descripciojoc) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        values: [codisala, 0, maximjugadors, nomsala, amfitriosala, descripciojoc]
      };
      const jugador = await joc.connect();
      await jugador
        .query(query)
        .then(res =>{
          const r = res.rows[0];
          AfegirASalesDeJocActives(r.codisala, r.numerojugadors, r.maximjugadors, 
            r.nomsala, r.amfitriosala, r.descripciojoc)
          setupAuthoritativePhaser(SalesDeJocActives[codisala]);
        })
        .catch(e => console.error(e.stack));
      jugador.release();
    }
    else{
      AfegirASalesDeJocActives(codisala, 0, maximjugadors, nomsala, amfitriosala, descripciojoc);
      setupAuthoritativePhaser(SalesDeJocActives[codisala]);
    }
  }

  function AfegirASalesDeJocActives(codisala, numerojugadors, maximjugadors, nomsala, amfitriosala, descripciojoc){
    SalesDeJocActives[codisala] = {
      codisala: codisala,
      numerojugadors: numerojugadors,
      maximjugadors: maximjugadors,
      nomsala: nomsala,
      amfitriosala: amfitriosala,
      descripciojoc: descripciojoc
    };
  }

function setupAuthoritativePhaser(infosala) {
    if(infosala && infosala.codisala) {
      let sala_io = io.of('/' + infosala.codisala);
      JSDOM.fromFile(path.join(__dirname, 'servidor/javascript.html'), {
        runScripts: "dangerously",
        resources: "usable",
        pretendToBeVisual: true
      }).then((dom) => {
  
        dom.window.URL.createObjectURL = (blob) => {
          if (blob){
            return datauri.format(blob.type, blob[Object.getOwnPropertySymbols(blob)[0]]._buffer).content;
          }
        };
        dom.window.URL.revokeObjectURL = (objectURL) => {};
        
        dom.window.io = sala_io;        
        dom.window.IS_LOCAL = IS_LOCAL; 
        dom.window.joc = joc;         
        dom.window.infosala = infosala; 
        dom.window.numerojugadors = 0;
  
        
      })
    } 
  }

const uniqueId = function () {
    return Math.random().toString(36).substr(4);
  };
  

function iniciarbasededades(){
    var query = 
    "DROP TABLE IF EXISTS jugadors; "+
    "DROP TABLE IF EXISTS sales; "+
    "CREATE TABLE sales (" +
      "idsala serial PRIMARY KEY, "+
      "codisala VARCHAR (20) NOT NULL, "+
      "numerojugadors INTEGER NOT NULL, "+
      "maximjugadors INTEGER NOT NULL, "+
      "nomsala VARCHAR (20), "+ 
      "amfritriosala VARCHAR (20), "+ 
      "descripciojoc TEXT"+
    "); ";
    (async function() {
        if(!IS_LOCAL) {
          const jugador = await joc.connect()
          await jugador.query(query)
          jugador.release()
        }
      });
}

server.listen(port, function () {
    console.log(`PORT: ${server.address().port}`);
  });


