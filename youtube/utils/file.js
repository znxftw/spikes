import path from 'path';
import fs from 'fs';

export function moveToDestination(pathToMove, destinationDir, prefix, preserveName = false) {
    if (fs.existsSync(pathToMove)) {
        if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
        }

        let finalName;
        if (preserveName) {
            finalName = path.basename(pathToMove);
        } else {
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
