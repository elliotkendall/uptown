import json
import boto3
import os

class DebugMessenger:
  def send_message(self, message):
    print('WebSocket: ' + str(message))
  
  def error(self, message):
    self.send_message('Error: ' + message)
    
class WebSocketMessenger:
  def __init__(self, client, cid):
    self.client = client
    self.cid = cid
    
  def send_message(self, message, cid=None):
    if cid is None:
      cid = self.cid
    print('Sending to ' + cid + ':' + json.dumps(message))
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
  data = {'players': {}, 'watchers': []}
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
    if location + i in board and board[location + i][0] == color:
      orth.append(i)

  if len(orth) < 2:
    # Don't even need to count the diagonal tiles for this case
    return True

  diag = []
  for i in [-10, -8, 8, 10]:
    if location + i in board and board[location + i][0] == color:
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

def prepare_player_state(state, mycid):
  ret = {'players': {}}
  if 'board' in state:
    ret['board'] = state['board']
    ret['nextplayer'] = state['nextplayer']
  
  for cid in state['players']:
    ret['players'][state['players'][cid]['playernum']] = {'name': state['players'][cid]['name']}
    if 'captured' in state['players'][cid]:
      ret['players'][state['players'][cid]['playernum']]['captured'] = state['players'][cid]['captured']
    if cid == mycid and 'rack' in state['players'][cid]:
      ret['rack'] = state['players'][cid]['rack']
      ret['players'][state['players'][cid]['playernum']]['self'] = True
    
  return ret

def lambda_handler(event, context):
  if not event['requestContext']['eventType'] == 'MESSAGE':
    print('Not a message, so not sending a response')  
    return {'statusCode': 200}
  
  if 'debug' in event:
    ws = DebugMessenger()
    cid = 'debug'
  else:
    client = boto3.client("apigatewaymanagementapi",
      endpoint_url = "https://" + event["requestContext"]["domainName"] +
      "/" + event["requestContext"]["stage"])
    cid = event["requestContext"].get("connectionId")
    ws = WebSocketMessenger(client, cid)
  
  print('Body: ' + event['body'])
  message = json.loads(event['body'])
  if not 'gameid' in message:
    ws.error('gameid required')
    return {'statusCode': 200}
  if not 'action' in message:
    ws.error('action required')
    return {'statusCode': 200}
    
  s3 = boto3.client('s3')
  gameid = message['gameid']
  state = get_game_state(gameid, s3)
  if state == None:
    state = create_game(gameid, s3)
  
  ### MOVE ###
  if message['action'] == 'move':
    if not cid in state['players']:
      ws.error('you are not in this game')
      return {'statusCode': 200}
    if state['nextplayer'] != state['players'][cid]['playernum']:
      ws.error('it is not your turn')
      return {'statusCode': 200}
    if not 'tile' in message:
      ws.error('must specify a tile')
      return {'statusCode': 200}
    if not 'location' in message:
      ws.error('must specify a location')
      return {'statusCode': 200}
    if not message['tile'] in state['players'][cid]['rack']:
      ws.error('you do not have that tile')
      return {'statusCode': 200}
    if not valid_move(message['tile'], message['location']):
      ws.error('that tile does not go there')
      return {'statusCode': 200}
    # Handle capturing
    if str(message['location']) in state['board']:
      print('Looking for self capture')
      print(state['board'][str(message['location'])][0])
      print(state['players'][cid]['playernum'])
      if state['board'][str(message['location'])][0] == state['players'][cid]['playernum']:
        ws.error('you cannot capture your own tile')
        return {'statusCode': 200}
      if not valid_capture(message['location'], state['board']):
        ws.error('capturing that tile would break up a group')
        return {'statusCode': 200}
      state['players'][cid]['captured'].append(state['board'][message['location']])
    # Place the tile on the board
    state['board'][message['location']] = [state['players'][cid]['playernum'], message['tile']]
    # Remove the tile from the rack
    state['players'][cid]['rack'].remove(message['tile'])
    # If there are more tiles to draw, draw one
    if len(state['players'][cid]['tiles']) > 0:
      state['players'][cid]['rack'].append(state['players'][cid]['tiles'].pop())
    # Advance to the next player
    state['nextplayer'] += 1
    if state['nextplayer'] > len(state['players']):
      state['nextplayer'] = 1
    # TODO - Check for end of game
    update_game(state, gameid, s3)
    for pcid in state['players']:
      ws.send_message(prepare_player_state(state, pcid), pcid)
    return {'statusCode': 200}
  ### JOIN ###
  elif message['action'] == 'join':
    print(state)
    if cid in state['players']:
      ws.error('you are already in this game')
      return {'statusCode': 200}
    if cid in state['watchers']:
      state['watchers'].remove(cid)
    state['players'][cid] = {'name': message['name'], 'playernum': len(state['players']) + 1}
    update_game(state, gameid, s3)
    ws.send_message(prepare_player_state(state, cid))
    for pcid in state['watchers'] + list(state['players']):
      ws.send_message(prepare_player_state(state, pcid), pcid)
    return {'statusCode': 200}
  ### LEAVE ###
  elif message['action'] == 'leave':
    return {'statusCode': 200}
  ### START ###
  elif message['action'] == 'start':
    if not cid in state['players']:
      ws.error('you are not in this game')
      return {'statusCode': 200}
    if 'board' in state:
      ws.error('game is already in progress')
      return {'statusCode': 200}
    
    del state['watchers']
    state['board'] = {}
    state['nextplayer'] = 1
    for pcid in state['players']:
      state['players'][pcid]['captured'] = []
      state['players'][pcid]['tiles'] = shuffle_tiles()
      state['players'][pcid]['rack'] = []
      for i in range(5):
        state['players'][pcid]['rack'].append(state['players'][pcid]['tiles'].pop())
    update_game(state, gameid, s3)
    for pcid in state['players']:
      ws.send_message(prepare_player_state(state, pcid), pcid)
    return {'statusCode': 200}
  ### GET ###
  elif message['action'] == 'get':
    if 'board' in state and not cid in state['players']:
      ws.error('you are not in this game')
      return {'statusCode': 200}
    if 'watchers' in state and cid not in state['watchers']:
      state['watchers'].append(cid)
      update_game(state, gameid, s3)
    ws.send_message(prepare_player_state(state, cid))
    return {'statusCode': 200}
  else:
    ws.error('unknown action')
    return {'statusCode': 200}
    