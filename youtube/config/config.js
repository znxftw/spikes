import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
    video: {
        // Edit these variables
        inputFile: "C:\\Path\\To\\Video.mp4",
        start: "00:02:30",
        end: "00:02:57",
        clipDir: "D:\\youtube\\Clipped",
        shortDir: "D:\\youtube\\Shorts",
        archiveDir: "D:\\youtube\\Archive"
    },
    youtube: {
        credentialsPath: path.join(__dirname, 'credentials.json'),
        tokenPath: path.join(__dirname, 'youtube_token.json'),
        videoDirectory: "D:\\youtube\\Shorts",
        metadataPath: path.join(__dirname, 'metadata.json'),
    }
};
