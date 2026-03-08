import { google } from 'googleapis';
import path from 'path';
import { promises as fs, createReadStream } from 'fs';
import http from 'http';
import url from 'url';
import open from 'open';

// --- Configuration ---
// These paths should match your existing setup.
const SCRIPT_ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(SCRIPT_ROOT, 'credentials.json');
const TOKEN_PATH = path.join(SCRIPT_ROOT, 'youtube_token.json');
const VIDEO_DIRECTORY = 'D:\\youtube\\Shorts'; // The directory where your shorts and metadata.json are.
const METADATA_PATH = path.join(VIDEO_DIRECTORY, 'metadata.json');

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const REDIRECT_URI = 'http://localhost:8080/';

/**
 * Reads credentials, creates an OAuth2 client, and authorizes it.
 * If a token exists, it's loaded. If not, it initiates the interactive auth flow.
 * @returns {Promise<import('google-auth-library').OAuth2Client>}
 */
async function authorize() {
    let credentials;
    try {
        const content = await fs.readFile(CREDENTIALS_PATH);
        credentials = JSON.parse(content);
    } catch (err) {
        console.error(`Error loading credentials file from ${CREDENTIALS_PATH}.`);
        console.error('Please create a credentials.json file with your clientId and clientSecret.');
        process.exit(1);
    }

    const { clientId, clientSecret } = credentials;
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

    // Check if we have previously stored a token.
    try {
        const token = await fs.readFile(TOKEN_PATH);
        oAuth2Client.setCredentials(JSON.parse(token));
        console.log('Successfully loaded existing token.');
        return oAuth2Client;
    } catch (err) {
        console.log('No existing token found. Starting new authorization flow...');
        return await getNewToken(oAuth2Client);
    }
}

/**
 * Handles the interactive authorization flow to get a new token.
 * @param {import('google-auth-library').OAuth2Client} oAuth2Client The OAuth2 client to get the token for.
 * @returns {Promise<import('google-auth-library').OAuth2Client>}
 */
function getNewToken(oAuth2Client) {
    return new Promise((resolve, reject) => {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent', // Important to ensure a refresh_token is provided
        });

        console.log('Please authorize this application in your browser. A new window/tab should open.');
        open(authUrl);

        const server = http.createServer(async (req, res) => {
            try {
                const qs = new url.URL(req.url, 'http://localhost:8080').searchParams;
                const code = qs.get('code');
                if (!code) {
                    throw new Error('Failed to get authorization code from Google.');
                }
                
                res.end('<h1>Authorization successful!</h1><p>You can close this browser window and return to the console.</p>');
                server.close();

                const { tokens } = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                
                await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
                console.log('Tokens saved to', TOKEN_PATH);
                
                resolve(oAuth2Client);
            } catch (e) {
                reject(e);
            }
        }).listen(8080, () => {
            console.log('Server listening on http://localhost:8080');
        });
    });
}

/**
 * Uploads a video file to YouTube.
 * @param {import('google-auth-library').OAuth2Client} auth An authorized OAuth2 client.
 * @param {string} videoFilePath The path to the video file.
 * @param {object} videoMetadata The metadata for the video (title, description).
 */
async function uploadVideo(auth, videoFilePath, videoMetadata) {
    const youtube = google.youtube({ version: 'v3', auth });
    const fileName = path.basename(videoFilePath);

    console.log(`🚀 Uploading ${fileName}...`);

    try {
        const response = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: videoMetadata.title,
                    description: videoMetadata.description,
                    categoryId: '20', // Gaming
                },
                status: {
                    privacyStatus: 'public',
                    madeForKids: false,
                },
            },
            media: {
                body: createReadStream(videoFilePath),
            },
        });

        console.log(`✅ Successfully uploaded! Video ID: ${response.data.id}`);
        console.log(`   Watch it here: https://www.youtube.com/watch?v=${response.data.id}`);

    } catch (err) {
        console.error(`❌ Failed to upload ${fileName}.`);
        if (err.response && err.response.data) {
            console.error('   API Error:', JSON.stringify(err.response.data.error, null, 2));
        } else {
            console.error('   Error:', err.message);
        }
    }
}

/**
 * Main function to run the script.
 */
async function main() {
    let metadataMap;
    try {
        const metadataContent = await fs.readFile(METADATA_PATH);
        metadataMap = JSON.parse(metadataContent);
    } catch (err) {
        console.error(`Could not read metadata file at ${METADATA_PATH}. Cannot proceed.`);
        process.exit(1);
    }

    const auth = await authorize();
    if (!auth) {
        console.error('Authentication failed. Exiting.');
        return;
    }

    // Find the first video in the metadata that exists on disk
    for (const fileName in metadataMap) {
        const videoFilePath = path.join(VIDEO_DIRECTORY, fileName);
        try {
            await fs.access(videoFilePath); // Check if file exists
            const videoMetadata = metadataMap[fileName];
            await uploadVideo(auth, videoFilePath, videoMetadata);
            // This script uploads one video and then exits. Remove the 'break' to upload all.
            break; 
        } catch {
            // File not found, continue to the next one
            console.log(`File ${fileName} listed in metadata but not found on disk. Skipping.`);
        }
    }
}

main().catch(console.error);