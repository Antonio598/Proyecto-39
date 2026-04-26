import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { writeFile, readFile, unlink } from "fs/promises";

// Point fluent-ffmpeg at the static binary bundled by @ffmpeg-installer/ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download clip (${res.status}): ${url}`);
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
}

/**
 * Merge a remote video URL with a local audio buffer using FFmpeg.
 * Returns the merged MP4 as a Buffer.
 * Uses temp files for reliability (piped MP4 output has moov-atom issues).
 */
export async function mergeAudioVideo(params: {
  videoUrl: string;
  audioBuffer: Buffer;
  videoBuffer?: Buffer; // optional pre-loaded video; skips download if provided
}): Promise<Buffer> {
  const id = randomUUID();
  const videoPath = join(tmpdir(), `${id}_video.mp4`);
  const audioPath = join(tmpdir(), `${id}_audio.mp3`);
  const outputPath = join(tmpdir(), `${id}_merged.mp4`);

  try {
    // Write video to temp file (use pre-loaded buffer or download)
    if (params.videoBuffer) {
      await writeFile(videoPath, params.videoBuffer);
    } else {
      await downloadToFile(params.videoUrl, videoPath);
    }
    // Write audio buffer to temp file
    await writeFile(audioPath, params.audioBuffer);

    // Run FFmpeg merge
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
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
    await unlink(videoPath).catch(() => {});
    await unlink(audioPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Concatenate multiple remote video clips into a single MP4 using FFmpeg concat demuxer.
 * All clips must have compatible codecs (guaranteed when all come from the same Kling config).
 * Returns the concatenated MP4 as a Buffer.
 */
export async function concatVideoClips(params: {
  videoUrls: string[];
}): Promise<Buffer> {
  const id = randomUUID();
  const clipPaths = params.videoUrls.map((_, i) => join(tmpdir(), `${id}_clip_${i}.mp4`));
  const listPath = join(tmpdir(), `${id}_list.txt`);
  const outputPath = join(tmpdir(), `${id}_concat.mp4`);

  try {
    // Download all clips in parallel
    await Promise.all(params.videoUrls.map((url, i) => downloadToFile(url, clipPaths[i])));

    // Write FFmpeg concat demuxer list file
    const listContent = clipPaths.map((p) => `file '${p}'`).join("\n");
    await writeFile(listPath, listContent);

    // Run FFmpeg concat (no re-encode — all clips share same codec from Kling)
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(new Error(`FFmpeg concat error: ${err.message}`)))
        .run();
    });

    return await readFile(outputPath);
  } finally {
    await Promise.all([
      ...clipPaths.map((p) => unlink(p).catch(() => {})),
      unlink(listPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);
  }
}
