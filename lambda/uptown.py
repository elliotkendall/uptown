import json
import boto3
import os

class WebSocketMessenger:
  def __init__(self, client, cid):
    self.client = client
    self.cid = cid

  def send_message(self, message, cid=None):
    if cid is None:
      cid = self.cid
    self.client.post_to_connection(Data=json.dumps(message).encode(), ConnectionId=cid)

  def error(self, message):
    self.send_message({'error': message})

def get_game_state(gid, s3):
  objects = s3.list_objects_v2(Bucket=os.environ['S3_BUCKET_NAME'], Prefix=gid)
  if objects['KeyCount'] == 0:
    return None
  filename = objects['Contents'][0]['Key']
  obj = s3.get_object(Bucket=os.environ['S3_BUCKET_NAME'], Key=filename)
  return json.loads(obj['Body'].read().decode())

def create_game(gid, s3):
  data = {'players': {}, 'watchers': {}}
  update_game(data, gid, s3)
  return data

def update_game(state, gid, s3):
  s3.put_object(Body=json.dumps(state), Key=gid + '.json', Bucket=os.environ['S3_BUCKET_NAME'])

def shuffle_tiles():
  import random
  tiles = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', '~', '!', '@', '#', '%', '^', '&', '*', '$']
  random.shuffle(tiles)
  return tiles

def between(i, min, max):
  return (i >= min and i <= max)

def valid_move(tile, location):
  # Dollar sign is wild
  if tile == '$':
    return True

  # Number tiles
  try:
    numtile = int(tile)
    return (location % 9) + 1 == numtile
  except ValueError:
    pass

  # Letter tiles
  lettertile = ord(tile)
  if between(lettertile, 65, 74):
    lettertile = lettertile - 65
    start = lettertile * 9
    return between(location, start, start+8)

  # Symbol tiles
  quadrants = {'~': [0, 0], '!': [0, 1], '@': [0, 2], '#': [1, 0], '?': [1, 1], '%': [1, 2], '^': [2, 0], '&': [2, 1], '*': [2, 2]}
  if tile in quadrants:
    quadrant = quadrants[tile]
    print(quadrant)
    start = 3*quadrant[1] + 27*quadrant[0]
    return (between(location, start, start + 2)
     or between(location, start + 9, start + 11)
     or between(location, start + 18, start + 20))
  return False

def valid_capture(location, board):
  color = board[location][0]
  orth = []
  for i in [-9, -1, 1, 9]:
    if (location + i) in board and board[location + i][0] == color:
      orth.append(i)

  if len(orth) < 2:
    # Don't even need to count the diagonal tiles for this case
    return True

  diag = []
  for i in [-10, -8, 8, 10]:
    if (location + i) in board and board[location + i][0] == color:
      diag.append(i)

  if len(orth) == 2:
    if abs(orth[0]) == abs(orth[1]):
      # Opposite sides
      return False
    if (orth[0] + orth[1]) in diag:
      # Diagonal between corners is filled
      return True
    return False
  elif len(orth) == 3:
    lookup = {
      -9: [-8, -10],
      -1: [8, -10],
      1: [-8, 10],
      9: [8, 10]
    }
    corners = lookup[sum(orth)]
    if corners[0] in diag and corners[1] in diag:
      return True
    return False
  elif len(orth) == 4 and len(diag) == 4:
    return True
  return False

def prepare_player_state(state, myat):
  ret = {'players': {}}
  if 'board' in state:
    ret['board'] = state['board']
    ret['nextplayer'] = state['nextplayer']
  if 'message' in state:
    ret['message'] = state['message']

  for authtoken in state['players']:
    ret['players'][state['players'][authtoken]['playernum']] = {}
    for item in ['name', 'last', 'captured']:
      if item in state['players'][authtoken]:
        ret['players'][state['players'][authtoken]['playernum']][item] = state['players'][authtoken][item]
    if authtoken == myat:
      ret['players'][state['players'][authtoken]['playernum']]['self'] = True
      if 'rack' in state['players'][authtoken]:
        ret['rack'] = state['players'][authtoken]['rack']
  return ret

def sync_authtoken(state, cid, authtoken, gameid, s3):
  for ptype in ['players', 'watchers']:
    if not ptype in state:
      continue
    for at in state[ptype]:
      if at == authtoken:
        if state[ptype][at]['cid'] != cid:
          state[ptype][at]['cid'] = cid
          update_game(state, gameid, s3)
          print('Updated cid for authtoken ' + authtoken + ' to ' + cid)
        return

def lambda_handler(event, context):
  if not event['requestContext']['eventType'] == 'MESSAGE':
    print('This event is not a message, so not sending a response. Probably indicates an API gateway misconfiguration.')
    return {'statusCode': 200}

  client = boto3.client("apigatewaymanagementapi",
    endpoint_url = "https://" + event["requestContext"]["domainName"] +
    "/" + event["requestContext"]["stage"])
  cid = event["requestContext"].get("connectionId")
  ws = WebSocketMessenger(client, cid)

  message = json.loads(event['body'])
  for item in ['gameid', 'action', 'authtoken']:
    if not item in message:
      ws.error(item + ' required')
      return {'statusCode': 200}
    if type(message[item]) != str:
      ws.error(item + ' must be a string')
      return {'statusCode': 200}
    if len(message[item]) > 36:
      ws.error(item + ' max length is 36')
      return {'statusCode': 200}

  s3 = boto3.client('s3')
  gameid = message['gameid']
  authtoken = message['authtoken']
  state = get_game_state(gameid, s3)

  if state == None:
    state = create_game(gameid, s3)
  elif 'gameover' in state:
    ws.send_message(prepare_player_state(state, authtoken), cid)
    return {'statusCode': 200}

  sync_authtoken(state, cid, authtoken, gameid, s3)

  ### MOVE ###
  if message['action'] == 'move':
    # Sanity checks
    if not authtoken in state['players']:
      ws.error('you are not in this game')
      return {'statusCode': 200}
    if state['nextplayer'] != state['players'][authtoken]['playernum']:
      ws.error('it is not your turn')
      return {'statusCode': 200}
    if not 'tile' in message:
      ws.error('must specify a tile')
      return {'statusCode': 200}
    if type(message['tile']) != str:
      ws.error('tile must be a string')
      return {'statusCode': 200}
    if not 'location' in message:
      ws.error('must specify a location')
      return {'statusCode': 200}
    if type(message['location'])!= int:
      ws.error('location must be a number')
      return {'statusCode': 200}
    if not message['tile'] in state['players'][authtoken]['rack']:
      ws.error('you do not have that tile')
      return {'statusCode': 200}
    if not valid_move(message['tile'], message['location']):
      ws.error('that tile does not go there')
      return {'statusCode': 200}

    # Handle capturing
    if message['location'] in state['board']:
      if state['board'][message['location']][0] == state['players'][authtoken]['playernum']:
        ws.error('you cannot capture your own tile')
        return {'statusCode': 200}
      if not valid_capture(message['location'], state['board']):
        ws.error('capturing that tile would break up a group')
        return {'statusCode': 200}
      state['players'][authtoken]['captured'].append(state['board'][str(message['location'])])

    # Place the tile on the board
    state['board'][message['location']] = [state['players'][authtoken]['playernum'], message['tile']]

    # Remove the tile from the rack
    state['players'][authtoken]['rack'].remove(message['tile'])

    # Update last move for this player
    state['players'][authtoken]['last'] = message['location']

    # If there are more tiles to draw, draw one
    if len(state['players'][authtoken]['tiles']) > 0:
      state['players'][authtoken]['rack'].append(state['players'][authtoken]['tiles'].pop())

    # Advance to the next player
    state['nextplayer'] += 1
    if state['nextplayer'] > len(state['players']):
      state['nextplayer'] = 1

    # Check for end of game
    gameover = True
    for authtoken in state['players']:
      if len(state['players'][authtoken]['rack']) == 5:
        gameover = False
        break
    if gameover:
      state['message'] = 'game over'
      state['gameover'] = True
    update_game(state, gameid, s3)

    for pat in state['players']:
      try:
        ws.send_message(prepare_player_state(state, pat), state['players'][pat]['cid'])
      except client.exceptions.GoneException:
        print("CID " + state['players'][pat]['cid'] + " for authtoken " + pat + " has gone away. Probably a timeout.")
    return {'statusCode': 200}
  ### JOIN ###
  elif message['action'] == 'join':
    if authtoken in state['players']:
      ws.error('you are already in this game')
      return {'statusCode': 200}
    if len(state['players']) > 4:
      ws.error('this game is at capacity')
      return {'statusCode': 200}
    if not 'name' in message:
      ws.error('must specify a name')
      return {'statusCode': 200}
    if type(message['name']) != str:
      ws.error('name must be a string')
      return {'statusCode': 200}
    if len(message['name']) > 36:
      name = message['name'][0:36]
    else:
      name = message['name']

    if authtoken in state['watchers']:
      del state['watchers'][authtoken]
    state['players'][authtoken] = {
      'name': name,
      'playernum': len(state['players']) + 1,
      'cid': cid
    }
    update_game(state, gameid, s3)
    for ptype in ['watchers', 'players']:
      for authtoken in state[ptype]:
        ws.send_message(prepare_player_state(state, authtoken), state[ptype][authtoken]['cid'])
    return {'statusCode': 200}
  ### LEAVE ###
  elif message['action'] == 'leave':
    if not authtoken in state['players']:
      ws.error('you are not in this game')
      return {'statusCode': 200}
    # Remove as a player, add as a watcher
    del state['players'][authtoken]
    state['watchers'][authtoken] = {'cid': cid}
    update_game(state, gameid, s3)
    # Send notifications
    for ptype in ['watchers', 'players']:
      for authtoken in state[ptype]:
        ws.send_message(prepare_player_state(state, authtoken), state[ptype]['cid'])
    return {'statusCode': 200}
  ### START ###
  elif message['action'] == 'start':
    if not authtoken in state['players']:
      ws.error('you are not in this game')
      return {'statusCode': 200}
    if 'board' in state:
      ws.error('game is already in progress')
      return {'statusCode': 200}
    if len(state['players']) < 3:
      ws.error('minimum 3 players required')
      return {'statusCode': 200}

    del state['watchers']
    state['board'] = {}
    state['nextplayer'] = 1
    for pat in state['players']:
      state['players'][pat]['captured'] = []
      state['players'][pat]['tiles'] = shuffle_tiles()
      state['players'][pat]['rack'] = []
      for i in range(5):
        state['players'][pat]['rack'].append(state['players'][pat]['tiles'].pop())
    update_game(state, gameid, s3)

    for authtoken in state['players']:
      ws.send_message(prepare_player_state(state, authtoken), state['players'][authtoken]['cid'])
    return {'statusCode': 200}
  ### GET ###
  elif message['action'] == 'get':
    if 'board' in state and not authtoken in state['players']:
      ws.error('you are not in this game')
      return {'statusCode': 200}
    if 'watchers' in state and authtoken not in state['watchers'] and authtoken not in state['players']:
      state['watchers'][authtoken] = {'cid': cid}
      update_game(state, gameid, s3)
    ws.send_message(prepare_player_state(state, authtoken), cid)
    return {'statusCode': 200}
  else:
    ws.error('unknown action')
    return {'statusCode': 200}
