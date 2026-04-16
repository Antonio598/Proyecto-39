import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { writeFile, readFile, unlink } from "fs/promises";

/**
 * Merge a remote video URL with a local audio buffer using FFmpeg.
 * Returns the merged MP4 as a Buffer.
 * Uses temp files for reliability (piped MP4 output has moov-atom issues).
 */
export async function mergeAudioVideo(params: {
  videoUrl: string;
  audioBuffer: Buffer;
}): Promise<Buffer> {
  const id = randomUUID();
  const audioPath = join(tmpdir(), `${id}_audio.mp3`);
  const outputPath = join(tmpdir(), `${id}_merged.mp4`);

  try {
    // Write audio buffer to temp file
    await writeFile(audioPath, params.audioBuffer);

    // Run FFmpeg merge
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(params.videoUrl)
        .input(audioPath)
        // Keep original video, replace audio with ElevenLabs voice
        .addOptions(["-map 0:v", "-map 1:a", "-c:v copy", "-c:a aac", "-shortest"])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
        .run();
    });

    return await readFile(outputPath);
  } finally {
    // Clean up temp files regardless of success/failure
    await unlink(audioPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
