import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config/config.js';
import { authorize, uploadVideo } from '../utils/youtube.js';

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

    for (const fileName in metadataMap) {
        const videoFilePath = path.join(videoDirectory, fileName);
        try {
            await fs.access(videoFilePath);
            const videoMetadata = metadataMap[fileName];
            await uploadVideo(auth, videoFilePath, videoMetadata);
            break; // Currently uploads one video and exits, remove break to loop over all of them
        } catch {
            console.log(`File ${fileName} listed in metadata but not found on disk. Skipping.`);
        }
    }
}

main().catch(console.error);
