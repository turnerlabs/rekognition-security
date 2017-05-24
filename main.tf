provider "aws" {
    profile = "${var.profile}"
    region = "${var.region}"
}


resource "aws_s3_bucket" "bucket" {
  bucket = "${var.s3_bucket}"
}

resource "aws_iam_role" "iam_for_lambda" {
    name = "face-security"
    assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "lambda-rekognition-attach" {
    role = "${aws_iam_role.iam_for_lambda.name}"
    policy_arn = "arn:aws:iam::aws:policy/AmazonRekognitionFullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda-cw-attach" {
    role = "${aws_iam_role.iam_for_lambda.name}"
    policy_arn = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda-s3-attach" {
    role = "${aws_iam_role.iam_for_lambda.name}"
    policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

data "archive_file" "lambda_zip" {
    type        = "zip"
    source_dir  = "."
    output_path = "facial-rekognition.zip"
}

resource "aws_lambda_function" "facial-rekognition" {
    function_name = "find-faces"
    filename = "${data.archive_file.lambda_zip.output_path}"
    source_code_hash = "${data.archive_file.lambda_zip.output_base64sha256}"
    role = "${aws_iam_role.iam_for_lambda.arn}"
    handler = "index.handler"
    timeout = 300
    memory_size = 1024
    runtime = "nodejs4.3"
    environment {
        variables = {
          COLLECTION = "${var.collection}",
          CHANNEL = "${var.channel}",
          TOKEN = "${var.token}"
        }
    }
}

resource "aws_lambda_permission" "allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.facial-rekognition.arn}"
  principal     = "s3.amazonaws.com"
  source_arn    = "${aws_s3_bucket.bucket.arn}"
}

resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = "${aws_s3_bucket.bucket.id}"

  lambda_function {
    lambda_function_arn = "${aws_lambda_function.facial-rekognition.arn}"
    events              = ["s3:ObjectCreated:Put"]
    filter_prefix       = "og_images/"
    filter_suffix       = ".jpg"
  }
}
