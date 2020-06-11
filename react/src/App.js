import React from 'react';
import './App.css';
import { w3cwebsocket as W3CWebSocket } from "websocket";
import Cookies from 'universal-cookie';
import { v4 as uuidv4 } from 'uuid';
import * as config from './config.js';

class Square extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      classes: "square",
      clickable: this.props.clickable
    };
    this.highlight = this.highlight.bind(this);
    this.unhighlight = this.unhighlight.bind(this);
    this.play = this.play.bind(this);
  }

  highlight() {
    if (this.state.classes.indexOf("highlighted") === -1) {
      this.setState({
        classes: this.state.classes + " highlighted",
        clickable: "unhighlight"
      });
      this.props.setHighlight(this);
    }
  }

  unhighlight() {
    this.setState({
      classes: this.state.classes.replace(" highlighted", ""),
      clickable: "highlight"
    });
  }

  play() {
    this.props.playTile(this.props.id);
  }

  render() {
    let classes = this.state.classes;
    let clickHandler = null;
    if (this.state.clickable === "highlight") {
      clickHandler=this.highlight;
    } else if (this.state.clickable === "unhighlight") {
      clickHandler=this.unhighlight;
    } else if (this.state.clickable === "play") {
      clickHandler=this.play;
    }
    if (this.props.player > 0) {
      classes += " player" + this.props.player;
    }
    if (this.props.label === "true") {
      classes += " label";
    }
    if ("className" in this.props) {
      classes += " " + this.props.className;
    }
    return (
      <div className={classes} onClick={clickHandler} >
        <div className="content">{this.props.symbol}</div>
      </div>
    );
  }
}

class Board extends React.Component {
  render() {
    let symbols = [
     ['~', '#', '^'],
     ['!', '?', '&'],
     ['@', '%', '*']
    ];
    let ret = [];

    // Top labels
    ret.push(<Square key="blank1" label="true" symbol=" " />);
    for(let i=1;i<10;i++) ret.push(<Square key={i + 'top'} label="true" symbol={i} />);
    ret.push(<Square key="blank2" label="true" symbol=" " />);

    let id=0;
    for(let i=0; i<9; i++) {
      // Left label
      ret.push(<Square label="true" key={String.fromCharCode(65+i) + '1'} symbol={String.fromCharCode(65+i)} />);

      for(let j=0;j<3;j++) {
        for(let k=0; k<3; k++) {
          let props = {playTile: this.props.playTile, clickable: "play", id: id, key: id}
          if (this.props.tiles[id] == null) {
            // Empty square
            props.symbol = symbols[j][Math.floor(i/3)];
          } else {
            // Tile
            props.symbol = this.props.tiles[id][1];
            props.player = this.props.tiles[id][0];
          }
          id++;
          ret.push(React.createElement(Square, props));
        }
      }

      // Right label
      ret.push(<Square label="true" key={String.fromCharCode(65+i) + '2'} symbol={String.fromCharCode(65+i)} />);
    }

    // Bottom labels
    ret.push(<Square key="blank3" label="true" symbol=" " />);
    for(let i=1;i<10;i++) ret.push(<Square key={i + 'bottom'} label="true" symbol={i} />);
    ret.push(<Square key="blank4" label="true" symbol=" " />);

    return (
     <div className="board">{ret}</div>
    );
  }
}

class Rack extends React.Component {
  render() {
    let tiles = [];
    for(let i=0;i<this.props.tiles.length;i++) {
      tiles.push(
       <Square player={this.props.playernum}
               clickable="highlight"
               setHighlight={this.props.setHighlight}
               symbol={this.props.tiles[i]}
               key={i} />);
    }
    tiles.push(<Square key="tilesleft" symbol={this.props.tilesLeft}
     className="tilesleft"
     player={this.props.playernum} />);
    return (
      <>
      <div id="rack">{tiles}</div>
      </>
    );
  }
}

class Opponent extends React.Component {
  render() {
    let elements = [];
    elements.push(<div key="playername" className={"name player" + this.props.playernum}>{this.props.name}</div>);
    elements.push(<Captured key="captured" tiles={this.props.captured} />);
    return (
      <div className="opponent">
        {elements}
      </div>
    );
  }
}

class Captured extends React.Component {
  render() {
    let captured = [];
    for (let i=0;i<this.props.tiles.length;i++) {
      captured.push(
        <Square player={this.props.tiles[i][0]}
         symbol={this.props.tiles[i][1]} key={i}/>
      );
    }
    return (
      <div className="captured">{captured}</div>
    );
  }
}

class CreateInterface extends React.Component {
  render() {
    return (
      <>
      <span id="title">Welcome to Uptown!</span>
      <form onSubmit={this.props.onClick}>
      <input id="gameid" type="text"
       placeholder="Please enter a game identifier"
       autoFocus="autofocus" />
      <input type="submit" value="Create or join game" />
      </form>
      </>
    );
  }
}

class JoinInterface extends React.Component {
  render() {
    let players = [];
    let hasSelf = 0;
    for (const [playernum, attrs] of Object.entries(this.props.players)) {
      if ('self' in attrs) {
        hasSelf = 1;
        players.push(<span key={playernum} className="player self">Player {playernum}: {attrs['name']} (YOU)
         <input type="button" id="leavebutton" value="leave game" onClick={this.props.leave} />
        </span>);
      } else {
        players.push(<span key={playernum} className="player">Player {playernum}: {attrs['name']}</span>);
      }
    }
    if (! hasSelf) {
      players.push(<div key="addself">
        <input id="joinname" placeholder="Enter your name" />
        <input type="button" value="Join" onClick={this.props.join} />
      </div>);
    }
    let message = null;
    if (this.props.message !== "") {
      message = <span>{this.props.message}</span>;
    }
    return (
      <form id="join">
      <span>Waiting to start game...</span>
      {message}
      {players}
      <input type="button" id="startbutton" value="Start game" onClick={this.props.startGame} />
      </form>
    );
  }

}

class Scroll extends React.Component {
  componentDidUpdate() {
    let np = document.getElementById("nextplayer");
    np.scrollIntoView();
  }

  render() {
    let items = [];
    for (let item in this.props.items) {
      if (this.props.items[item][1]) {
        items.push(<span key={item} className={this.props.items[item][1]}>{this.props.items[item][0]}</span>);
      } else {
        items.push(<span key={item}>{this.props.items[item][0]}</span>);
      }
    }
    if (this.props.gameOver) {
      items.push(<span key="nextplayer" id="nextplayer">Game over</span>);
    } else if (this.props.nextPlayerName === true) {
      items.push(<span key="nextplayer" className="yourturn" id="nextplayer">It's your turn!</span>);
    } else {
      items.push(<span key="nextplayer" className={"player" + this.props.nextPlayerNumber} id="nextplayer">It's {this.props.nextPlayerName}'s turn</span>);
    }
    return (
      <div id="scroll">
        {items}
      </div>
    );
  }
}

class App extends React.Component {
  intToOrdinal(i) {
    if (i === 1) {
      return '1st';
    } else if (i === 2) {
      return '2nd';
    } else if (i === 3) {
      return '3rd';
    } else {
      return i.toString() + 'th';
    }
  }

  connectToWebSocket() {
    this.wsclient = new W3CWebSocket(config.APIURL);

    this.wsclient.onopen = () => {
      console.log('WebSocket Client Connected');
      this.addToScroll("Welcome to Uptown");
      if (this.state.gameid !== null) {
        this.wsclient.send(JSON.stringify({
          "gameid": this.state.gameid,
          "authtoken": this.state.authtoken,
          "action": "get"
        }));
      }
    };
    this.wsclient.onerror = (err) => {
      console.log("Websocket error");
      console.log(err);
      this.addToScroll("Error connecting to websocket", "error");
    }
    this.wsclient.onmessage = (message) => {
      let data = JSON.parse(message.data);
      console.log("Received message");
      console.log(data);
      if ('error' in data) {
        this.addToScroll(data.error, "error");
        this.setState({error: data.error});
      } else {
        this.setState(data);
      }
      if ('message' in data) {
        this.addToScroll(data.message);
      }
      if ('scores' in data) {
        for (let i=0;i<data.scores.length;i++) {
          let winners = [];
          data.scores[i][0].forEach(playernum => {
            winners.push(data.players[playernum].name);
          });

          let groups = data.scores[i][1];
          let captures = data.scores[i][2];
          this.addToScroll(this.intToOrdinal(i+1) + ' place: ' + winners.join(', ')
           + ' with ' + groups.toString() + ' groups and '
           + captures.toString() + ' captured tiles');
        }
        return;
      }
      if ('nextplayer' in data) {
        let lastplayer = data.nextplayer - 1;
        if (lastplayer < 1) {
          lastplayer = Object.keys(data.players).length;
        }
        if ("last" in data.players[lastplayer]) {
          this.addToScroll(data.players[lastplayer].name + ' plays '
           + data.board[data.players[lastplayer].last][1], 'player' + lastplayer);
        }
      }
    };
  }
  componentDidMount() {
    const cookies = new Cookies();
    let authtoken = cookies.get('authtoken');
    if (! authtoken) {
      authtoken = uuidv4();
      cookies.set('authtoken', authtoken, { path: '/' });
    }
    this.setState({"authtoken": authtoken});

    this.connectToWebSocket();
  }

  constructor(props) {
    super(props);
    if (window.location.search === "") {
      this.state = { gameid: null, scroll: []};
    } else {
      this.state = { gameid: window.location.search.substring(1), scroll: [] };
    }

    this.createHandler = this.createHandler.bind(this);
    this.joinGame = this.joinGame.bind(this);
    this.leaveGame = this.leaveGame.bind(this);
    this.startGame = this.startGame.bind(this);
    this.playTile = this.playTile.bind(this);
    this.setHighlightedTile = this.setHighlightedTile.bind(this);
  }  

  addToScroll(message, type = null) {
    let scroll = this.state.scroll;
    let newitem;
    if (type === null) {
      newitem = [message, null];
    } else {
      newitem = [message, type];
    }
    scroll.push(newitem);
    this.setState({scroll: scroll});
  }

  createHandler() {
    let gameid = document.getElementById('gameid').value;
    this.setState({
      gameid: gameid
    });
    window.location.search= '?' + gameid;
  }

  startGame() {
    this.wsclient.send(JSON.stringify({
      "gameid": this.state.gameid,
      "authtoken": this.state.authtoken,
      "action": "start"
    }));
  }

  joinGame() {
    this.wsclient.send(JSON.stringify({
      "gameid": this.state.gameid,
      "authtoken": this.state.authtoken,
      "action": "join",
      "name": document.getElementById('joinname').value
    }));
  }

  leaveGame() {
    this.wsclient.send(JSON.stringify({
      "gameid": this.state.gameid,
      "authtoken": this.state.authtoken,
      "action": "leave"
    }));
  }

  playTile(location) {
    let tiles = document.getElementsByClassName('highlighted');
    if (tiles.length === 0) {
      this.addToScroll("Select a tile from your rack first", "error");
      return;
    } else if (tiles.length > 1) {
      console.log("Multiple highlighted tiles?");
      return;
    }
    let message = JSON.stringify({
      "gameid": this.state.gameid,
      "authtoken": this.state.authtoken,
      "action": "move",
      "tile": tiles[0].textContent,
      "location": location
    });
    if (this.wsclient.readyState !== 1) {
      console.log("Websocket connection closed; reconnecting");
      this.connectToWebSocket();
    }
    console.log("Sending move");
    console.log(message);
    this.wsclient.send(message);
    this.clearHighlightedTile();
  }

  setHighlightedTile(tile) {
    if ("highlighted" in this.state
     && this.state.highlighted
     && tile !== this.state.highlighted) {
      this.state.highlighted.unhighlight();
    }
    this.setState({"highlighted": tile});
  }

  clearHighlightedTile() {
    this.state.highlighted.unhighlight();
    this.setState({"highlighted": null});
  }

  render() {
    if (this.state.gameid == null) {
      // We need to create/join a game
      return (
        <div className="App">
          <CreateInterface onClick={this.createHandler}/>
        </div>
      );    
    } else if ('board' in this.state) {
      // Render the game board
      let opponents = [];
      let captured = [];
      let myplayernum = -1;
      for (const [playernum, attrs] of Object.entries(this.state.players)) {
        if ('self' in attrs) {
          captured = attrs.captured;
          myplayernum = playernum;
        } else {
          opponents.push(<Opponent
           key={playernum}
           playernum={playernum}
           name={attrs.name}
           captured={attrs.captured}
          />);
        }
      }
      if (myplayernum === -1) {
        return (<span>Did not find own player</span>);
      }
      let nextPlayer;
      if ("self" in this.state.players[this.state.nextplayer]) {
        nextPlayer = true;
      } else {
        nextPlayer = this.state.players[this.state.nextplayer].name;
      }
      return (
        <div className="App">
          <div id="opponents">
          {opponents}
          </div>
          <div id="middle">
          <Board tiles={this.state.board} playTile={this.playTile} />
          <Scroll items={this.state.scroll}
                  nextPlayerName={nextPlayer}
                  nextPlayerNumber={this.state.nextplayer}
                  gameOver={'scores' in this.state} />
          </div>
          <Rack tiles={this.state.rack} playernum={myplayernum}
           tilesLeft={this.state.tilesleft}
           setHighlight={this.setHighlightedTile} />
          <Captured tiles={captured} />
        </div>
      );
    } else if ('players' in this.state) {
      // Waiting to start the game
      return (
        <div className="App">
        <JoinInterface players={this.state.players}
         join={this.joinGame}
         leave={this.leaveGame}
         startGame={this.startGame}
         message={this.state.message}
         />
        </div>
      );
    } else if ('error' in this.state) {
      return (
        <div className="App">
          <span id="error">{this.state.error}</span>
        </div>
      );
    } else {
      return(<div className="loader">Loading...</div>);
    }
  }
}
export default App;
