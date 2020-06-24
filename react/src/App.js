import React from 'react';
import './App.css';
import { w3cwebsocket as W3CWebSocket } from "websocket";
import Cookies from 'universal-cookie';
import { v4 as uuidv4 } from 'uuid';
import * as config from './config.js';

class CloseButton extends React.Component {
  render() {
    return (
      <div id="closebutton">
        <span onClick={this.props.onClick}>X</span>
      </div>
    );
  }
}

class AboutBox extends React.Component {
  render() {
    return (
      <div id="dim">
      <div id="about">
      <CloseButton onClick={this.props.hideAbout}/>
      <h2>How to Play Uptown</h2>
      <h3>Objective</h3>
      <p>
      The goal of Uptown is to place your colored tiles in such a way that
      at the end of the game, they're connected in as few <em>groups</em> as
      possible.  A group is a collection of tiles which are all touching at
      least one other member of the group on at least one side (not just on
      a corner).
      </p>
      <p>
      If one or more players has the same number of groups at the end of
      the game, the player who has <em>captured</em> the fewest of their
      opponents' tiles wins. See below for more about capturing.
      </p>

      <h3>Playing the Game</h3>
      <p>

      Below the board you can see the five tiles that are in your rack and
      available to place. On your turn, click one of these tiles, then click
      the space on the board where you want to place it. To be a legal
      move, the tile you're playing must match the board space where you're
      trying to place it. You can only place tiles with a letter on them
      (A-F) in the row with a matching label. You can only place tiles with
      a number (1-9) in the matching column. You can only place tiles with
      a symbol in the area of the board with matching symbols on it. The
      dollar sign ($) tile is wild and you can place it anywhere.

      </p>
      <p>
      Your supply includes one tile of each letter, number, and symbol.  The
      game ends when each player has drawn all of their tiles and placed all
      but four. Therefore, you there are four tiles you will not need to
      play. You can see how many tiles are left for you to draw by looking
      at the number on top of the stack to the right of your rack of tiles.
      </p>

      <h3>Capturing</h3>
      <p>
      If you wish to place a tile on a square where an opponent has already
      placed one of their tiles, you may do so. However, you may not
      split an opponent's tiles into more groups than they already had.
      You may also never capture one of your own tiles.
      </p>

      <p>

      You can see any tiles that your opponents have captured displayed below
      their names. Tiles that you have captured appear below your rack
      of tiles. At the end of the game, the player with fewest captured tiles
      wins in the case of a tie.

      </p>

      <h2>About This Site</h2>
      <p>

      Uptown runs on <a href="https://aws.amazon.com/">Amazon Web
      Services</a> using <a
      href="https://aws.amazon.com/lambda/">Lambda</a>, <a
      href="https://aws.amazon.com/api-gateway/">API Gateway</a>, and <a
      href="https://aws.amazon.com/s3/">S3</a>.  The frontend is <a
      href="https://reactjs.org/">React</a> and the backend is <a
      href="https://www.python.org/">Python</a>.  It is <a
      href="https://www.gnu.org/philosophy/free-sw.html">free software</a>. 
      Please contribute bug reports and patches on <a
      href="https://github.com/elliotkendall/uptown">GitHub</a>!

      </p>

      <p>
      Copyright &copy; {new Date().getFullYear()} Elliot Kendall
      </p>
      
      </div>
      </div>
    );
  }
}

class AboutButton extends React.Component {
  render() {
    return (
      <div id="aboutbutton" onClick={this.props.onClick}><span>?</span></div>
    );
  }
}

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
    if ("className" in this.props) {
      classes += " " + this.props.className;
    }
    let char;
    if (this.props.symbol in config.EMOJI) {
      char = config.EMOJI[this.props.symbol];
    } else {
      char = this.props.symbol;
    }
    return (
      <div className={classes} onClick={clickHandler} symbol={this.props.symbol}>
        <div className="content">{char}</div>
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
            if (this.props.latest.includes(id)) {
              props.latest = true;
            }
          }
          let classes = [];
          if ((id + 7) % 9 === 0 || (id + 4) % 9 === 0) {
            classes.push("rightline");
          } else if ((id + 6) % 9 === 0 || (id + 3) % 9 === 0) {
            classes.push("leftline");
          }
          if ((17 < id && id < 27) || (44 < id && id < 54)) {
            classes.push("bottomline");
          } else if ((26 < id && id < 36) || (53 < id && id < 63)) {
            classes.push("topline");
          }
          props.className = classes.join(" ");
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
      <span id="title">Welcome to Uptown</span>
      <p>
      Please enter an identifier to create or join a game.  This identifier
      can be just about anything, like a word or short phrase, and is case
      sensitive.  You and the people you want to play with should all use
      the same identifier.
      </p>
      <form onSubmit={this.props.onClick}>
      <input id="gameid" type="text"
       placeholder="Enter a game identifier"
       autoFocus="autofocus" />
      <input type="submit" value="Create or join game" />
      </form>
      </>
    );
  }
}

class JoinInterface extends React.Component {
  checkEnter(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this.props.join();
    }
  }
  render() {
    let players = [];
    let hasSelf = 0;
    for (const [playernum, attrs] of Object.entries(this.props.players)) {
      if ('self' in attrs) {
        hasSelf = 1;
        players.push(<span key={playernum} className="player self">Player {playernum}: {attrs['name']} (YOU) <input type="button" id="leavebutton" value="leave game" onClick={this.props.leave} />
        </span>);
      } else {
        players.push(<span key={playernum} className="player">Player {playernum}: {attrs['name']}</span>);
      }
    }
    if (! hasSelf) {
      players.push(<div key="addself">
        <input id="joinname"
               placeholder="Enter your name"
               onKeyDown={(event) => {if (event.key === "Enter") { event.preventDefault(); this.props.join();}}}
               autoFocus="autofocus" />
        <input type="button" value="Join" onClick={this.props.join} />
      </div>);
    }
    let message = null;
    if (this.props.message !== "") {
      message = <span>{this.props.message}</span>;
    }
    let buttonProps = {};
    let buttonLabel = "Start game"
    if (players.length < 3) {
      buttonProps.disabled = true;
      buttonLabel = "Minimum three players required";
    }
    return (
      <form id="join">
      <span id="title">Waiting for players to join...</span>
      {message}
      {players}
      <input type="button" id="startbutton" value={buttonLabel}
       {...buttonProps}
       onClick={this.props.startGame} />
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
    this.setState({connected: false});

    this.wsclient.onopen = () => {
      console.log('WebSocket Client Connected');
      this.setState({connected: true});
      if (this.state.queued !== null) {
        console.log('Sending queued message');
        this.wsclient.send(this.state.queued);
      } else if (this.state.gameid !== null) {
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
          let symbol;
          if (data.board[data.players[lastplayer].last][1] in config.EMOJI) {
            symbol = config.EMOJI[data.board[data.players[lastplayer].last][1]];
          } else {
            symbol = data.board[data.players[lastplayer].last][1];
          }
          this.addToScroll(
           data.players[lastplayer].name + ' plays ' + symbol,
           'player' + lastplayer);
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
    let state = { gameid: null, queued: null, scroll: [], showAbout: false};
    if (window.location.search !== "") {
      state.gameid = window.location.search.substring(1);
    }
    this.state = state;

    this.createHandler = this.createHandler.bind(this);
    this.joinGame = this.joinGame.bind(this);
    this.leaveGame = this.leaveGame.bind(this);
    this.startGame = this.startGame.bind(this);
    this.playTile = this.playTile.bind(this);
    this.setHighlightedTile = this.setHighlightedTile.bind(this);
    this.showAbout = this.showAbout.bind(this);
    this.hideAbout = this.hideAbout.bind(this);
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
    this.wsSendMessage(JSON.stringify({
      "gameid": this.state.gameid,
      "authtoken": this.state.authtoken,
      "action": "start"
    }));
  }

  joinGame() {
    this.wsSendMessage(JSON.stringify({
      "gameid": this.state.gameid,
      "authtoken": this.state.authtoken,
      "action": "join",
      "name": document.getElementById('joinname').value
    }));
  }

  leaveGame() {
    this.wsSendMessage(JSON.stringify({
      "gameid": this.state.gameid,
      "authtoken": this.state.authtoken,
      "action": "leave"
    }));
  }

  wsSendMessage(message) {
    console.log("WS socket state is: " + this.wsclient.readyState);
    if (this.wsclient.readyState === 0) {
      // Connecting
      this.setState({queued: message});
    } else if (this.wsclient.readyState === 1) {
      // Connected
      this.wsclient.send(message);
    } else {
      // Closed/closing
      console.log("Websocket connection closed; reconnecting");
      this.setState({queued: message});
      this.connectToWebSocket();
    }
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
      "tile": tiles[0].getAttribute('symbol'),
      "location": location
    });
    console.log("Sending move");
    console.log(message);
    this.wsSendMessage(message);
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

  showAbout() {
    this.setState({"showAbout": true});
  }

  hideAbout() {
    this.setState({"showAbout": false});
  }

  render() {
    let about = null;
    if (this.state.showAbout) {
      about = (<AboutBox hideAbout={this.hideAbout} />);
    }
    if (this.state.gameid == null) {
      // We need to create/join a game
      return (
        <div className="App">
          <CreateInterface onClick={this.createHandler}/>
          <AboutButton onClick={this.showAbout} />
          {about}
        </div>
      );    
    } else if ('board' in this.state) {
      // Render the game board
      let opponents = [];
      let captured = [];
      let myplayernum = -1;
      let latest = [];
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
          <Board tiles={this.state.board} latest={latest}
           playTile={this.playTile} />
          <Scroll items={this.state.scroll}
                  nextPlayerName={nextPlayer}
                  nextPlayerNumber={this.state.nextplayer}
                  gameOver={'scores' in this.state} />
          </div>
          <Rack tiles={this.state.rack} playernum={myplayernum}
           tilesLeft={this.state.tilesleft}
           setHighlight={this.setHighlightedTile} />
          <Captured tiles={captured} />
          <AboutButton onClick={this.showAbout} />
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
        <AboutButton onClick={this.showAbout} />
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
