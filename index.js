"use strict";

const util = require('util');
const fs = require('fs');
const AWS = require('aws-sdk');
const fetch = require('node-fetch');
const Jimp = require("jimp");
const Slack = require('node-slack-upload');
const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3();

let COLLECTION = process.env.COLLECTION;
let WEBHOOK_URL = "https://slack.com/api/files.upload";
let TOKEN = process.env.TOKEN;
let LOCAL_BUCKET = process.env.LOCAL_BUCKET;
let LOCAL_FILE = process.env.LOCAL_FILE;
let slack = new Slack(TOKEN);

exports.handler = main;

if (LOCAL_FILE && LOCAL_BUCKET) {
    main({Records: [{s3: {bucket: {name: LOCAL_BUCKET}, object: {key: LOCAL_FILE}}}]}, null, (err, data) => {
      if (err) {
        console.log(err)
      }
      console.log(data);
    });
}

function main(event, context, callback) {
    console.log("Reading input from event:\n", util.inspect(event, {depth: 5}));

    const srcBucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    const srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

    // find Faces
    findFaces(COLLECTION, srcBucket, srcKey)
    .then((data) => {
      let promises = [];
      if (data.FaceDetails.length !== 0) {
        crop(data, srcBucket, srcKey)
        .then((data) => {
          data.map((faceData) => {
            if (faceData.data && faceData.data.FaceMatches.length === 0) {
                let promise = fireSlackMessage(faceData)
                .then((data) => {
                  var params = {
                        Bucket: srcBucket,
                        Key: 'alerts/cropped_' + faceData.key,
                        Body: fs.readFileSync(faceData.file),
                        Metadata: {
                            'Content-Type': 'image/jpeg'
                        }
                    };

                    return s3.putObject(params).promise()
                    .then((s3Data) => {
                        console.log('saved the alert in s3 so we can train if needed', 'alerts/cropped_' + faceData.key)
                        resolve(data);
                    })
                });

                promises.push(promise);
            }
          });

          if (!promises || promises.length === 0) {
              callback(null, "success and no intruders found.");
          } else {
              Promise.all(promises)
              .then((data) => {
                  callback(null, `success and found ${promises.length} Intruders.`);
              });
          }
        });
      } else {
          callback(null, "success and no faces found.");
          return;
      }
    })
    .catch((err) => {
      callback(err)
    });
}

function crop(facesData, bucket, key) {
    let params = {
        Bucket: bucket,
        Key: key
    },
    promises;

    let promise = s3.getObject(params).promise()
    .then((data) => {
        promises = facesData.FaceDetails.map((faceData, index) => {
            let promise = new Promise((resolve, reject) => {
                console.log('Success Got Individual Face');
                let file = key.split('/').pop();
                let tmpFile = "/tmp/" + index + "_" + file;
                fs.writeFile(tmpFile, data.Body, function(err) {
                    if(err) {
                        return console.log(err);
                    }

                    let tmpCropped = "/tmp/_croppped_" + index + "_" + file;

                    return Jimp.read(tmpFile).then(function (image) {
                        image.crop(
                          faceData.BoundingBox.Left * image.bitmap.width,
                          faceData.BoundingBox.Top * image.bitmap.height,
                          faceData.BoundingBox.Width * image.bitmap.width,
                          faceData.BoundingBox.Height * image.bitmap.height
                          , (err, image) => {
                            image.write(tmpCropped, (err, data) => {
                                // .quality(100) // set JPEG quality
                                //image.write("/tmp/" + key + "_croppped", (data) => {
                                console.log('successfully wrote image to local');
                                let params = {
                                    collection: COLLECTION,
                                    data: fs.readFileSync(tmpCropped)
                                };

                                return rekognize(params)
                                .then((data) => {
                                    resolve({file: tmpCropped, key: index + "_" + file, data: data});
                                }).catch((err) => {
                                    console.log(err)
                                    resolve(false);
                                });
                              });
                          });
                    }).catch(function (err) {
                        console.error(err);
                    });

                    console.log("The file was saved!");
                });
            });

            return promise;
        });

        return Promise.all(promises);
    })
    .catch((err) => {
        console.log(err);
    })

    return promise;
}

function rekognize(face) {
    return new Promise((resolve, reject) => {

      let params = {
          CollectionId: face.collection,
          Image: {
            Bytes: face.data
          }
      };

      rekognition.searchFacesByImage(params).promise()
      .then((data) => resolve(data),
      (err) => {
         if (err.code === "InvalidParameterException") {
             resolve(false);
         }
      })
      .catch((err) => reject(err));
    });
}

function findFaces(collection, bucket, key) {

  let params = {
      Image: { /* required */
          //Bytes: new Buffer('...') || 'STRING_VALUE',
          S3Object: {
              Bucket: bucket,
              Name: key
          }
      }
  };

  return new Promise((resolve, reject) => {
      rekognition.detectFaces(params).promise()
      .then((data) => resolve(data))
      .catch((err) => reject(err));
  });
}

function fireSlackMessage(data) {
  let promise = new Promise((resolve, reject) => {
    slack.uploadFile({
      file: fs.createReadStream(data.file),
      filetype: 'image/jpeg',
      title: 'Intruder Alert',
      initialComment: `The Following Intruder Was Found: 'alerts/cropped_${data.key}'`,
      channels: process.env.CHANNEL
    }, function(err, data) {
      if (err) {
        console.error(err);
        reject(err);
      }
      else {
        console.log('Uploaded file: ', data.file.name);
        resolve(data);
      }
    });
  });

  return promise;
}
