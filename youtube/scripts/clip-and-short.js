import fs from 'fs';
import readline from 'readline';
import { spawnSync } from 'child_process';
import { config } from '../config/config.js';
import { moveToDestination } from '../utils/file.js';

const { inputFile, start, end, clipDir, shortDir, archiveDir } = config.video;

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

    if (!inputFile || !fs.existsSync(inputFile)) {
        console.error(`\x1b[31mInput file not specified or not found: '${inputFile}'. Please check your configuration.\x1b[0m`);
        await askQuestion("Press Enter to exit...");
        rl.close();
        process.exit(1);
    }

    console.log("\x1b[33m--- Video Processing ---\x1b[0m");
    console.log(`\x1b[90mUsing Input File: ${inputFile}\x1b[0m`);
    console.log(`\x1b[90mUsing Start Time: ${start}\x1b[0m`);
    console.log(`\x1b[90mUsing End Time:   ${end}\x1b[0m`);
    console.log("------------------------");

    console.log("1. Create Clip (Fast, no re-encoding)");
    console.log("2. Create Short (Vertical 9:16, Blurred Background)");
    console.log("3. Both");

    const choice = (await askQuestion("Select an option (1, 2, or 3): ")).trim();
    let processed = false;

    if (choice === "1" || choice === "3") {
        console.log("\n\x1b[36mGenerating Clip...\x1b[0m");
        const tempClip = "temp_clip_process.mp4";

        const args = ['-hwaccel', 'cuda', '-ss', start, '-to', end, '-i', inputFile, '-c', 'copy', tempClip];
        const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });

        if (result.status === 0 && fs.existsSync(tempClip)) {
            moveToDestination(tempClip, clipDir, "clipped");
            processed = true;
        } else {
            console.error("\x1b[31mFFmpeg failed to create clip.\x1b[0m");
        }
    }

    if (choice === "2" || choice === "3") {
        console.log("\n\x1b[36mGenerating Short...\x1b[0m");
        const tempShort = "temp_short_process.mp4";
        const filterComplex = "[0:v]format=yuv420p,split=2[bg][fg]; [bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:10[bg_blurred]; [fg]scale=1080:-2[fg_scaled]; [bg_blurred][fg_scaled]overlay=(W-w)/2:(H-h)/2";

        const args = [
            '-hwaccel', 'cuda', '-ss', start, '-to', end, '-i', inputFile,
            '-filter_complex', filterComplex,
            '-c:v', 'hevc_nvenc', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'copy', tempShort
        ];

        const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });

        if (result.status === 0 && fs.existsSync(tempShort)) {
            moveToDestination(tempShort, shortDir, "shorts");
            processed = true;
        } else {
            console.error("\x1b[31mFFmpeg failed to create short.\x1b[0m");
        }
    }

    if (processed) {
        console.log("\n\x1b[35mArchiving original file...\x1b[0m");
        moveToDestination(inputFile, archiveDir, "", true);
    } else if (!["1", "2", "3"].includes(choice)) {
        console.log("\x1b[31mInvalid selection. No files processed or archived.\x1b[0m");
    }

    await askQuestion("\nPress Enter to continue...");
    rl.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
