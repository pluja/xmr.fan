/* ElevenLabs v3/v4 audio tags the podcast may use. Anything else in [brackets]
   is stripped, so the voice never reads a stray tag aloud. */
export const AUDIO_TAGS = ["laughs", "starts laughing", "sighs", "exhales", "curious", "excited", "sarcastic", "whispers", "mischievously"];

export const cleanTags = (text: string) =>
  text
    .replace(/\[([^\]]{1,30})\]/g, (_, tag: string) => (AUDIO_TAGS.includes(tag.trim().toLowerCase()) ? `[${tag.trim().toLowerCase()}]` : ""))
    .replace(/\s{2,}/g, " ")
    .trim();
