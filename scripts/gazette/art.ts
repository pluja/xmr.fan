/* Needs NANO_GPT_API_KEY. Optional: ART_MODEL, ART_RESOLUTION, ART_ASPECT. */

export const ART_STYLE = `Minimal low-resolution pixel art, like a sprite from an 8-bit era video game, enlarged.
- The whole picture is drawn on a coarse grid of only about 64 by 36 big square pixels: every pixel is a large, clearly visible block. Enlarged with nearest-neighbor: perfectly sharp square edges.
- Very little detail. One bold, simple, iconic subject with a silhouette you can read at a glance, centered, with plenty of empty space around it.
- Plain flat background in dark charcoal #2b282d, at most a simple floor line or one band of checkerboard dithering.
- Flat colors only, at most five, all from this palette: #2b282d charcoal, #45404a dark gray, #a39ca8 light gray, #ff6600 Monero orange, #fb8c3c orange, #ffd2ad peach.
- No gradients, no glow, no soft lighting, no texture, no anti-aliasing, no fine lines, no outlines thinner than one big pixel.
- No people, hands, faces, text, letters, numbers or logos.`;

export async function drawImage(scene: string): Promise<{ bytes: Buffer; ext: string }> {
  const model = process.env.ART_MODEL || "openai/gpt-image-2.5/sunburst/text-to-image";
  const res = await fetch("https://api.nano-gpt.com/api/v1/images", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.NANO_GPT_API_KEY! },
    body: JSON.stringify({
      model,
      prompt: `Scene: ${scene}\n\n${ART_STYLE}`,
      resolution: process.env.ART_RESOLUTION || "1k",
      aspect_ratio: process.env.ART_ASPECT || "16:9",
      n: 1,
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`Image request failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const { data } = await res.json();
  const first = Array.isArray(data) ? data[0] : undefined;
  const bytes = first?.b64_json
    ? Buffer.from(first.b64_json, "base64")
    : first?.url ? Buffer.from(await (await fetch(first.url)).arrayBuffer()) : undefined;
  if (!bytes) throw new Error("Image response had no image");
  return { bytes, ext: imageExtension(bytes) };
}

/** Detected from the image's magic bytes. */
export function imageExtension(b: Buffer): string {
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "webp";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  throw new Error("Unknown image format");
}
