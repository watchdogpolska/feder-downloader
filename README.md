# Feder-Downloader

[![Build Status](https://travis-ci.com/watchdogpolska/feder-downloader.svg?branch=master)](https://travis-ci.com/watchdogpolska/feder-downloader)
[![Docker Repository on Quay](https://quay.io/repository/watchdogpolska/feder-downloader/status "Docker Repository on Quay")](https://quay.io/repository/watchdogpolska/feder-downloader)

Provides ability to archive locally dataset of specific monitoring in [feder](http://github.com/watchdogpolska/feder/).

## Parameters

* ```--monitoring``` - ID of monitoring
* ```--root``` - URL of root of [feder](http://github.com/watchdogpolska/feder/) instance
* ```--output-dir``` - Path to directory to store archived data


## Docker

```bash
docker run -v $(pwd)/out:/out quay.io/watchdogpolska/feder-downloader nodejs index.js --monitoring 12 --output-dir /out
```
