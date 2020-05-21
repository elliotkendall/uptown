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
    if ("latest" in this.props) {
      classes += " latest";
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
    var symbols = [
     ['~', '#', '^'],
     ['!', '?', '&'],
     ['@', '%', '*']
    ];
    var ret = [];

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
          var props = {playTile: this.props.playTile, clickable: "play", id: id, key: id}
          if (id in this.props.tiles) {
            // Tile
            props.symbol = this.props.tiles[id][1];
            props.player = this.props.tiles[id][0];
            if (this.props.latest.includes(id)) {
              props.latest = true;
            }
          } else {
            // Empty square
            props.symbol = symbols[j][Math.floor(i/3)];
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
    return (
      <>
      <div id="rack">{tiles}</div>
      </>
    );
  }
}

class Opponent extends React.Component {
  render() {
    var elements = [];
    elements.push(<div key="playername" className={"name player" + this.props.playernum}>Player {this.props.playernum}: {this.props.name}</div>);
    if (this.props.isnext) {
      elements.push(<div key="spinner" className="loader">Loading...</div>);
    }
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

class Message extends React.Component {
  render() {
    if (this.props.content === "") {
      return (null);
    }
    return (
      <div id="message">{this.props.content}</div>
    );
  }

}

class CreateInterface extends React.Component {
  render() {
    return (
      <>
      <span id="title">Welcome to Uptown!</span>
      <form onSubmit={this.props.onClick}>
      <input id="gameid" name="gameid" type="text"
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
    var message = null;
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

class App extends React.Component {
  componentDidMount() {
    const cookies = new Cookies();
    var authtoken = cookies.get('authtoken');
    if (! authtoken) {
      authtoken = uuidv4();
      cookies.set('authtoken', authtoken, { path: '/' });
    }
    this.setState({"authtoken": authtoken});

    this.wsclient = new W3CWebSocket(config.APIURL);

    this.wsclient.onopen = () => {
      console.log('WebSocket Client Connected');
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
      this.setState({"message": "Error connecting to websocket"});
    }
    this.wsclient.onmessage = (message) => {
      let data = JSON.parse(message.data);
      console.log("Received message");
      console.log(data);
      if ('error' in data) {
        this.setState({"message": data.error});
      } else {
        if (! ('message' in data)) {
          data.message = '';
        }
        this.setState(data);
      }
    };
  }

  constructor(props) {
    super(props);
    if (window.location.search === "") {
      this.state = { gameid: null };
    } else {
      this.state = { gameid: window.location.search.substring(1) };
    }

    this.createHandler = this.createHandler.bind(this);
    this.joinGame = this.joinGame.bind(this);
    this.leaveGame = this.leaveGame.bind(this);
    this.startGame = this.startGame.bind(this);
    this.playTile = this.playTile.bind(this);
    this.setHighlightedTile = this.setHighlightedTile.bind(this);
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
    var tiles = document.getElementsByClassName('highlighted');
    if (tiles.length === 0) {
      this.setState({"message": "Select a tile from your rack first"});
      return;
    } else if (tiles.length > 1) {
      console.log("Multiple highlighted tiles?");
      return;
    }
    var message = JSON.stringify({
      "gameid": this.state.gameid,
      "authtoken": this.state.authtoken,
      "action": "move",
      "tile": tiles[0].textContent,
      "location": location
    });
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
      var opponents = [];
      var captured = [];
      var myplayernum = -1;
      var latest = [];
      for (const [playernum, attrs] of Object.entries(this.state.players)) {
        if ('last' in attrs) {
          latest.push(attrs.last);
        }
        if ('self' in attrs) {
          captured = attrs.captured;
          myplayernum = playernum;
        } else {
          opponents.push(<Opponent
           key={playernum}
           playernum={playernum}
           isnext={playernum === this.state.nextplayer.toString()}
           name={attrs.name}
           captured={attrs.captured}
          />);
        }
      }
      if (myplayernum === -1) {
        return (<span>Did not find own player</span>);
      }
      return (
        <div className="App">
          <div id="opponents">
          {opponents}
          </div>
          <Board tiles={this.state.board} latest={latest} playTile={this.playTile} />
          <Message content={this.state.message} />
          <Rack tiles={this.state.rack} playernum={myplayernum}
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
    } else if ('message' in this.state) {
      return (
        <div className="App">
          <span id="error">{this.state.message}</span>
        </div>
      );
    } else {
      return(<div className="loader">Loading...</div>);
    }
  }
}
export default App;
