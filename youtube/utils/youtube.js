import { google } from 'googleapis';
import { promises as fs, createReadStream } from 'fs';
import http from 'http';
import url from 'url';
import open from 'open';
import path from 'path';

const SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly'
];
const REDIRECT_URI = 'http://localhost:8080/';

export async function authorize(credentialsPath, tokenPath) {
    let credentials;
    try {
        const content = await fs.readFile(credentialsPath, 'utf8');
        credentials = JSON.parse(content);
    } catch (err) {
        console.error(`Error loading credentials file from ${credentialsPath}.`);
        console.error('Please create a credentials.json file with your clientId and clientSecret.');
        process.exit(1);
    }

    const clientData = credentials.installed || credentials.web || credentials;
    const clientId = clientData.client_id || clientData.clientId;
    const clientSecret = clientData.client_secret || clientData.clientSecret;

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

    try {
        const token = await fs.readFile(tokenPath, 'utf8');
        const parsedToken = JSON.parse(token);

        const tokenScopes = (parsedToken.scope || '').split(' ');
        const hasAllScopes = SCOPES.every(scope => tokenScopes.includes(scope));

        if (!hasAllScopes) {
            console.log('Existing token is missing required scopes. Starting new authorization flow...');
            return await getNewToken(oAuth2Client, tokenPath);
        }

        oAuth2Client.setCredentials(parsedToken);
        console.log('Successfully loaded existing token.');
        return oAuth2Client;
    } catch (err) {
        console.log('No existing/valid token found. Starting new authorization flow...');
        return await getNewToken(oAuth2Client, tokenPath);
    }
}

function getNewToken(oAuth2Client, tokenPath) {
    return new Promise((resolve, reject) => {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent',
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
                
                await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2));
                console.log('Tokens saved to', tokenPath);
                
                resolve(oAuth2Client);
            } catch (e) {
                reject(e);
            }
        }).listen(8080, () => {
            console.log('Server listening on http://localhost:8080');
        });
    });
}

export async function getUploadedVideos(auth) {
    const youtube = google.youtube({ version: 'v3', auth });
    const videosMap = new Map();

    try {
        let nextPageToken = undefined;
        do {
            const response = await youtube.search.list({
                part: 'snippet',
                forMine: true,
                type: 'video',
                maxResults: 50,
                pageToken: nextPageToken
            });

            const videos = response.data.items;
            if (videos) {
                for (const video of videos) {
                    if (video.id && video.id.videoId) {
                        videosMap.set(video.snippet.title, video.id.videoId);
                    }
                }
            }
            nextPageToken = response.data.nextPageToken;
        } while (nextPageToken);

        return videosMap;
    } catch (err) {
        console.error('Error fetching uploaded videos:', err.message);
        if (err.response && err.response.data) {
            console.error('   API Error:', JSON.stringify(err.response.data.error, null, 2));
        }
        return videosMap;
    }
}

export async function uploadVideo(auth, videoFilePath, videoMetadata) {
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
                    categoryId: '20',
                },
                status: {
                    privacyStatus: 'public',
                    selfDeclaredMadeForKids: false,
                },
            },
            media: {
                body: createReadStream(videoFilePath),
            },
        });

        console.log(`✅ Successfully uploaded! Video ID: ${response.data.id}`);
        console.log(`   Watch it here: https://www.youtube.com/watch?v=${response.data.id}`);
        return response.data.id;

    } catch (err) {
        console.error(`❌ Failed to upload ${fileName}.`);
        if (err.response && err.response.data) {
            console.error('   API Error:', JSON.stringify(err.response.data.error, null, 2));
        } else {
            console.error('   Error:', err.message);
        }
        return null;
    }
}
