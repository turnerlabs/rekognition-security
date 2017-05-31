The train_lambda.py is used for training the collection with images.

To run the code using lambda in AWS, zip the code and all the dependencies in one folder and create the lambda.

In the same folder that contains the code do the following:
pip install requests -t folder-with-code/lib/

Then zip the folder and create a lambda function with the command

aws lambda create-function \
--region us-west-2 \
--function-name HelloPython \
--zip-file fileb://deployment-package.zip \
--role arn:aws:iam::account-id:role/lambda_basic_execution  \
--handler hello_python.my_handler \
--runtime python3.6 \
--timeout 15 \
--memory-size 512


After this, set the parameters of the lambda function, and you are good to go.
