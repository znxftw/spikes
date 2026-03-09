import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config/config.js';
import { authorize, uploadVideo, getUploadedVideos } from '../utils/youtube.js';

async function main() {
    const { videoDirectory, metadataPath, credentialsPath, tokenPath } = config.youtube;

    let metadataMap;
    try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadataMap = JSON.parse(metadataContent);
    } catch (err) {
        console.error(`Could not read metadata file at ${metadataPath}. Cannot proceed.`);
        console.error('Make sure to create a metadata.json file in the config folder representing your videos.');
        process.exit(1);
    }

    const auth = await authorize(credentialsPath, tokenPath);
    if (!auth) {
        console.error('Authentication failed. Exiting.');
        return;
    }

    console.log('Fetching list of already uploaded videos...');
    const uploadedVideos = await getUploadedVideos(auth);
    console.log(`Found ${uploadedVideos.size} videos on the channel.`);

    let metadataChanged = false;

    for (const fileName in metadataMap) {
        const videoFilePath = path.join(videoDirectory, fileName);
        const videoMetadata = metadataMap[fileName];

        if (videoMetadata.youtubeId) {
            console.log(`⏩ Video "${videoMetadata.title}" already has a YouTube ID (${videoMetadata.youtubeId}). Skipping upload.`);
            if (uploadedVideos.has(videoMetadata.title)) {
                const fetchedId = uploadedVideos.get(videoMetadata.title);
                if (fetchedId !== videoMetadata.youtubeId) {
                    console.warn(`   ⚠️ Warning: Mismatch! YouTube ID for this title on channel is ${fetchedId}, but metadata has ${videoMetadata.youtubeId}.`);
                }
            } else {
                console.warn(`   ⚠️ Warning: Mismatch! Video has YouTube ID ${videoMetadata.youtubeId} in metadata, but is not found in the list of uploaded videos on the channel.`);
            }
            continue;
        }

        if (uploadedVideos.has(videoMetadata.title)) {
            const videoId = uploadedVideos.get(videoMetadata.title);
            console.log(`⏩ Video "${videoMetadata.title}" found on YouTube with ID ${videoId}. Updating metadata and skipping.`);
            videoMetadata.youtubeId = videoId;
            metadataChanged = true;
            continue;
        }

        try {
            await fs.access(videoFilePath);
            const videoId = await uploadVideo(auth, videoFilePath, videoMetadata);
            if (videoId) {
                videoMetadata.youtubeId = videoId;
                metadataChanged = true;
            }
            break; // Currently uploads one video and exits, remove break to loop over all of them
        } catch {
            console.log(`File ${fileName} listed in metadata but not found on disk. Skipping.`);
        }
    }

    if (metadataChanged) {
        console.log('Updating metadata file with YouTube IDs...');
        await fs.writeFile(metadataPath, JSON.stringify(metadataMap, null, 2), 'utf8');
    }
}

main().catch(console.error);
