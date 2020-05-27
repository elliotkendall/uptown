import json
import boto3
import os
import datetime
import dateutil.tz

def lambda_handler(event, context):
  s3 = boto3.client('s3')
  
  continuation = False
  todelete = []
  while continuation is not None:
    if continuation is not False:
      result = s3.list_objects_v2(Bucket=os.environ['S3_BUCKET_NAME'], ContinuationToken=continuation)
    else:  
      result = s3.list_objects_v2(Bucket=os.environ['S3_BUCKET_NAME'])
    
    for item in result['Contents']:
      if (item['LastModified'] + datetime.timedelta(days=int(os.environ['EXPIRATION_DAYS']))
        < datetime.datetime.now(tz=dateutil.tz.tzlocal())):
        todelete.append({'Key': item['Key']})
        print('Trying to delete ' + item['Key'])
    
    if result['IsTruncated']:
      continuation = result['NextContinuationToken']
    else:
      continuation = None
  
  if len(todelete) > 0:
    result = s3.delete_objects(Bucket=os.environ['S3_BUCKET_NAME'], Delete={'Objects': todelete})
    if 'Errors' in result:
      for error in result['Errors']:
        print('Failed to delete ' + error['Key'] + ': ' + error['Message'])
  
  return {'statusCode': 200 }
