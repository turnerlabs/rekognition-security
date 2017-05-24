# face-security

A set of lambda functions that can detect images uploaded to an s3 bucket and check if
a face is part of a rekognition collection. If a face is detected that is not part of
the collection, the an alert is sent to a specified slack channel.

## Install

This project is installed with terraform. Just run `terraform apply -var-file=your_file.tf_vars`
You should have the appropriate variables in your .tf_vars file.

```
collection = "NAME_OF_YOUR_COLLECTION"
channel = "CHANNEL_YOU_WANT_TO_ALERT_IN"
token = "SLACK_TOKEN"
s3_bucket = "NAME_OF_YOUR_S3_BUCKET"
profile = "YOUR_AWS_CREDENTIALS_PROFILE"
```

After this the lambda functions will be installed in your account and all you have to do fire them is
upload a photo s3://${s3_bucket}/og_images.

This will fire the lambda and will alert the slack channel you set if there is a face in the picture
that is not in your collection.

TODOS:

1. Add lambda that trains the collection when an image is uploaded to a specific directory.
