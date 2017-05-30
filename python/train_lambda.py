import os
import boto3
import sys
import urllib

lib_path = os.path.abspath(os.path.join('lib'))
sys.path.append(lib_path)

import requests

def train(collection, srcBucket, srcKey):
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    client = boto3.client('rekognition')
    response = client.index_faces(
    CollectionId=collection,
    Image={
        'S3Object': {
            'Bucket': srcBucket,
            'Name': srcKey,
        }
    },
    )

    return response

def lambda_handler(event, context):
    COLLECTION = str(os.environ.get('COLLECTION'))

    # Read credentials from the environment
    bucket = event["Records"][0]['s3']['bucket']['name']
    srcKey = urllib.unquote(event["Records"][0]['s3']['object']['key'].replace("+", " "))
    print bucket
    print srcKey
    response = train(COLLECTION,bucket,srcKey)
    print response
    return response


if __name__ == '__main__':
  BUCKET = str(os.environ.get('LOCAL_BUCKET'))
  FILE = str(os.environ.get('FILE'))
  COLLECTION = str(os.environ.get('COLLECTION'))
  response = train(COLLECTION,BUCKET,FILE)
  print response
