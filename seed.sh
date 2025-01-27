#!/bin/bash

if ! command -v elasticdump &> /dev/null
then
    echo "Error: Elasticdump is not installed on this machine."
    exit 1
fi

if ! command -v aws &> /dev/null
then 
    echo "Error: AWS CLI is not installed on this machine."
    exit 1
fi


elasticdump --input=testdata/es_dump/time_record_mapping.json --output=http://localhost:9200/time_record --type=mapping
elasticdump --input=testdata/es_dump/time_record.json --output=http://localhost:9200/time_record --type=data

elasticdump --input=testdata/es_dump/organization_mapping.json --output=http://localhost:9200/organization --type=mapping
elasticdump --input=testdata/es_dump/organization.json --output=http://localhost:9200/organization --type=data

curl http://localhost:9200/organization/_search
curl http://localhost:9200/time_record/_search
 
export AWS_ACCESS_KEY_ID=normal
export AWS_SECRET_ACCESS_KEY=normal
export AWS_DEFAULT_REGION=wtf-2

aws s3 cp --recursive ./testdata/images/ s3://tokbud/time-record --endpoint-url http://localhost:8333
aws s3 cp s3://tokbud/time-record/clock-in1.jpeg ./test1.jpeg --endpoint-url http://localhost:8333
