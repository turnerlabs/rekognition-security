"use strict";

const util = require('util');
const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition();

let COLLECTION = process.env.COLLECTION;
let LOCAL_BUCKET = process.env.LOCAL_BUCKET;
let LOCAL_FILE = process.env.LOCAL_FILE;

exports.handler = main;

if (LOCAL_FILE && LOCAL_BUCKET) {
    main({Records: [{s3: {bucket: {name: LOCAL_BUCKET}, object: {key: LOCAL_FILE}}}]}, null, (err, data) => {
      if (err) {
        console.log(err)
      }

    });
}

function main(event, context, callback) {
    console.log("Reading input from event:\n", util.inspect(event, {depth: 5}));

    const srcBucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    const srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

    // find Faces
    train(COLLECTION, srcBucket, srcKey, callback);
}

function train(collection, bucket, key, callback) {

      let params = {
          CollectionId: collection,
          Image: {
            S3Object: {
                Bucket: bucket,
                Name: key
            }
          }
      };

      rekognition.indexFaces(params, (err, data) => {

        if (err) {
            console.log(err)
            callback("failed");
            return;
        }

        console.log(JSON.stringify(data, null, 4));
        callback(null, `Trained ${key}`);
      });

}
