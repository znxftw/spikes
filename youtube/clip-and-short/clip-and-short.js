const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawnSync } = require('child_process');

// --- Configuration ---
// Edit these variables before running the script.
const InputFile = "C:\\Path\\To\\Video.mp4";
const Start = "00:02:30";
const End = "00:02:57";
const ClipDir = "D:\\youtube\\Clipped";
const ShortDir = "D:\\youtube\\Shorts";
const ArchiveDir = "D:\\youtube\\Archive";

// --- Function to Handle Numbering and Moving ---
function moveToDestination(pathToMove, destinationDir, prefix, preserveName = false) {
    if (fs.existsSync(pathToMove)) {
        if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
        }

        let finalName;
        if (preserveName) {
            finalName = path.basename(pathToMove);
        } else {
            // Find the latest number (e.g., "shorts-5.mp4" -> 5)
            const existingFiles = fs.readdirSync(destinationDir);
            let maxNumber = 0;
            const regex = new RegExp(`^${prefix}-(\\d+)\\.mp4$`, 'i');

            for (const file of existingFiles) {
                const match = file.match(regex);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }

            const nextNumber = maxNumber + 1;
            finalName = `${prefix}-${nextNumber}.mp4`;
        }

        const destinationPath = path.join(destinationDir, finalName);
        try {
            fs.renameSync(pathToMove, destinationPath);
        } catch (err) {
            if (err.code === 'EXDEV') {
                fs.copyFileSync(pathToMove, destinationPath);
                fs.unlinkSync(pathToMove);
            } else {
                throw err;
            }
        }
        console.log(`\x1b[32mSuccess: Saved to ${destinationPath}\x1b[0m`);
    } else {
        console.error(`\x1b[31mFile not found for moving: ${pathToMove}\x1b[0m`);
    }
}

// --- Main Execution ---
async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

    if (!InputFile || !fs.existsSync(InputFile)) {
        console.error(`\x1b[31mInput file not specified or not found: '${InputFile}'. Please check your configuration.\x1b[0m`);
        await askQuestion("Press Enter to exit...");
        rl.close();
        process.exit(1);
    }

    console.log("\x1b[33m--- Video Processing ---\x1b[0m");
    console.log(`\x1b[90mUsing Input File: ${InputFile}\x1b[0m`);
    console.log(`\x1b[90mUsing Start Time: ${Start}\x1b[0m`);
    console.log(`\x1b[90mUsing End Time:   ${End}\x1b[0m`);
    console.log("------------------------");

    console.log("1. Create Clip (Fast, no re-encoding)");
    console.log("2. Create Short (Vertical 9:16, Blurred Background)");
    console.log("3. Both");

    const choice = (await askQuestion("Select an option (1, 2, or 3): ")).trim();
    let processed = false;

    if (choice === "1" || choice === "3") {
        console.log("\n\x1b[36mGenerating Clip...\x1b[0m");
        const tempClip = "temp_clip_process.mp4";

        const args = ['-hwaccel', 'cuda', '-ss', Start, '-to', End, '-i', InputFile, '-c', 'copy', tempClip];
        const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });

        if (result.status === 0 && fs.existsSync(tempClip)) {
            moveToDestination(tempClip, ClipDir, "clipped");
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
            '-hwaccel', 'cuda', '-ss', Start, '-to', End, '-i', InputFile,
            '-filter_complex', filterComplex,
            '-c:v', 'hevc_nvenc', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'copy', tempShort
        ];

        const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });

        if (result.status === 0 && fs.existsSync(tempShort)) {
            moveToDestination(tempShort, ShortDir, "shorts");
            processed = true;
        } else {
            console.error("\x1b[31mFFmpeg failed to create short.\x1b[0m");
        }
    }

    // --- Archive Process ---
    if (processed) {
        console.log("\n\x1b[35mArchiving original file...\x1b[0m");
        moveToDestination(InputFile, ArchiveDir, "", true);
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
