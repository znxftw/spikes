# YouTube Tools

A set of automated tools for processing videos and uploading them to YouTube.

## Features

- **Clip & Short**: A script (`clip-and-short`) to process standard landscape videos into vertical shorts using `ffmpeg`. It handles clipping, adding a blurred background layer, overlaying the cropped gameplay video, and archiving the source files.
- **Auto-Upload**: A Node.js upload script (`upload.js`) that automates uploading process to YouTube using the Google Videos API.
- **Metadata Management**: A JSON-based configuration file (`metadata.json`) keeps track of video metadata like title, description, and corresponding YouTube ID so the script avoids double-uploads.

## Setup

1. Configure variables (video paths, durations, directories) in `config/config.js`.
2. Add your `credentials.json` from the Google Developer Console within the `config` directory.
3. Add entries describing your videos in `config/metadata.json`.

## Usage

* `npm run clip-and-short`: Processes the input video configured in `config.js` to create clips and vertical shorts using `ffmpeg`.
* `npm run upload`: Starts the automated process of validating the local video with your channel, reading metadata, and uploading any new videos to YouTube.
