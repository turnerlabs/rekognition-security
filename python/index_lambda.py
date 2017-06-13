#This code finds faces from an image, crops the faces, searches the faces in the AWS collection and adds them to a s3 bucket
#if the image is not found in the collection

import os
import sys
lib_path = os.path.abspath(os.path.join('lib'))
sys.path.append(lib_path)
import boto3
from PIL import Image
import botocore
import io
import urllib

#environment variables
COLLECTION = str(os.environ.get('COLLECTION')) #Collection to which images are saved
CROPBUFFER = int(os.environ.get('BUFFER'))#Buffer to avoid tight cropping of faces, (values like - 10,15,20)
TOPICARN = str(os.environ.get('TOPICARN'))#TopicArn of the sns service

def findFaces(collection, srcBucket, srcKey):
    client = boto3.client('rekognition')
    #Find faces in the image
    try:
        response = client.detect_faces(
            Image={
                'S3Object': {
                    'Bucket': srcBucket,
                    'Name': srcKey
                }
            },
            )
    except Exception as e:
        print "Your exception is: ",e
        return 'Code exception in findfaces'

    print 'Number of faces:',len(response['FaceDetails'])
    if len(response['FaceDetails'])!=0:
        return crop(response,srcBucket,srcKey)
    else:
        return 'No faces found.'


def crop(data, srcBucket, srcKey):
    client = boto3.client('s3')
    s3 = boto3.resource('s3')
    sns = boto3.client("sns")
    localFilename = '/tmp/{}'.format(os.path.basename(srcKey))

    #Download image to local
    try:
        s3.Bucket(srcBucket).download_file(srcKey, localFilename)
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == "404":
            print("The object does not exist.")
        else:
            raise

    # Load the original image:
    img = Image.open(localFilename)
    for i in range (0,len(data['FaceDetails'])):
        width = data['FaceDetails'][i]['BoundingBox']['Width']
        height = data['FaceDetails'][i]['BoundingBox']['Height']
        left = data['FaceDetails'][i]['BoundingBox']['Left']
        top =  data['FaceDetails'][i]['BoundingBox']['Top']

        widImage = img.size[0]
        htImage = img.size[1]

        #Added Buffer to avoid tight cropping and provide room for detecting faces

        img1 = img.crop(((left * widImage) - CROPBUFFER,(top * htImage) - CROPBUFFER,(left * widImage) + (width * widImage) + (2 * CROPBUFFER),(top * htImage) + (height * htImage) + (2 * CROPBUFFER)))

        key = srcKey.replace('/',"")
        #naming the image
        tmpCropped = 'cropped_'+str(i)+key

        #Changing image to bytes
        imgByteArr = io.BytesIO()
        img1.save(imgByteArr, format='JPEG')
        imgByteArr = imgByteArr.getvalue()
        response = searchImageinCollection(COLLECTION, srcBucket, imgByteArr)

        #If no matches found add the image to test folder
        if response != False and len(response['FaceMatches'])==0:
            print 'Alert'
            name = 'test/'+tmpCropped
            #put object in bucket
            object = s3.Bucket(srcBucket).put_object(Body = imgByteArr, Key = name)
            #Bucket name and file name is published as the message to sns topic
            strMessage = 'Bucket: '+srcBucket+' File Name: '+name

            sns.publish(TopicArn=TOPICARN,Message=strMessage)
    return ''

def searchImageinCollection(collection, srcBucket, imgBytes):

    client = boto3.client('rekognition')
    try:
        response = client.search_faces_by_image(
            CollectionId=collection,
            Image={
                'Bytes': imgBytes,

            },
        )
        return response

    except Exception as e:
         print "Your exception in Search Image in Collection is: ", e
         return False


def lambda_handler(event, context):
    COLLECTION = str(os.environ.get('COLLECTION'))
    # Read credentials from the environment
    srcBucket = event["Records"][0]['s3']['bucket']['name']
    srcKey = urllib.unquote(event["Records"][0]['s3']['object']['key'].replace("+", " "))
    response = findFaces(COLLECTION,srcBucket,srcKey)
    return response


if __name__ == '__main__':
    srcBucket = str(os.environ.get('LOCAL_BUCKET'))
    srcKey = str(os.environ.get('FILE'))
    res = findFaces(COLLECTION,srcBucket,srcKey)
    print res
