Python code for detecting faces using AWS Rekognition and Lambda

train_lambda.py can be used for training the collection with images
index_lambda.py can be used for detecting faces, checking the face i collection, sending a message if face is not present in collection.

All the python code and the dependencies should be zipped into a single zip file.
The dependencies can be installed in the /lib folder in the same folder in which you have the python code.
The dependencies can be installed with: pip install dependency-name -t folder-path/lib/

Zip using the following command: zip -r deployment-package.zip folder-path

The lambda function can be created with the following command
aws lambda create-function \
--region us-west-2 \
--function-name HelloPython[Your-function-name] \
--zip-file fileb://deployment-package.zip[deployment package name] \
--role arn:aws:iam::account-id:role/lambda_basic_execution[arn code]  \
--handler hello_python.my_handler[python-code.lambda-handler-name] \
--runtime python3.6[Change accordingly to 2.7 or 3.6] \
--timeout 15 \
--memory-size 512

The lambda can be updated using the following command:
aws lambda update-function-code --function-name HelloPython[your-function-name] --zip-file fileb://deployment-package.zip
 
 
 
