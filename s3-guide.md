# S3

## Prerequisites

Setup your credentials

```
aws configure
```

Credentials can be found in s3-dev-config.json

## Getting started

Create new S3 Bucket

```
aws s3 mb s3://<bucket-name> --endpoint-url http://localhost:8333
```

See all buckets

```
aws s3 ls --endpoint-url http://localhost:8333
```

Upload file to S3

```
aws s3 cp <target-path> s3://<bucket-name>/<desired-path> --endpoint-url http://localhost:8333
```

Retrieve file from S3

```
aws s3 cp s3://<bucket-name>/<target-path> <desired-path> --endpoint-url http://localhost:8333
```

### Note

-   this storage system uses mounted volume on host machine (named as `data`)\
-   remove folder `data` to empty the storage system

## Services

### S3

-   This service runs the SeaweedFS S3 server.
-   The S3 server provides an Amazon S3-compatible interface to interact with
    SeaweedFS.
-   Access via `http://localhost:8333`

### S3-master

-   This service runs the SeaweedFS Master server.
-   The master server is responsible for managing the metadata and coordinating the volume servers.

### S3-volume

-   This service runs the SeaweedFS Volume server.
-   The volume server stores the actual file data and is managed by the master server.

### S3-filer

-   This service runs the SeaweedFS Filer server.
-   The filer server provides the file system-like interface to access the data stored in the volume servers.
