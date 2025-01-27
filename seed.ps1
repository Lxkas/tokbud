# if cannot run, exec "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned"

if (-not (Get-Command elasticdump -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Elasticdump is not installed on this machine."
    exit 1
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "Error: AWS CLI is not installed on this machine."
    exit 1
}

elasticdump --input=es_dump\time_record_mapping.json --output=http://localhost:9200/time_record --type=mapping
elasticdump --input=es_dump\time_record.json --output=http://localhost:9200/time_record --type=data

elasticdump --input=es_dump\organization_mapping.json --output=http://localhost:9200/organization --type=mapping
elasticdump --input=es_dump\organization.json --output=http://localhost:9200/organization --type=data

$env:AWS_ACCESS_KEY_ID = "normal"
$env:AWS_SECRET_ACCESS_KEY = "normal"
$env:AWS_DEFAULT_REGION = "wtf-2"

aws s3 cp --recursive .\testdata\images\ s3://tokbud/time-record --endpoint-url http://localhost:8333

Write-Host "Done"
