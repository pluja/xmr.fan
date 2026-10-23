/* Push notifications for the scheduled jobs, through ntfy (ntfy.sh or self-hosted).
   NOTIFY_URL is the topic URL, e.g. https://ntfy.sh/xmrfan-<something-hard-to-guess>;
   NOTIFY_TOKEN is an optional access token. Without NOTIFY_URL, messages are only printed. */

export interface Notice {
  title: string;
  body: string;
  /** ntfy priority: 1 (min) to 5 (max). */
  priority?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  /** Opened when the notification is tapped. */
  click?: string;
}

export async function notify(n: Notice): Promise<void> {
  console.log(`\n[notify] ${n.title}\n${n.body}`);
  const url = process.env.NOTIFY_URL;
  if (!url) return;
  // ntfy reads headers as Latin-1, so non-ASCII titles go in RFC 2047 form.
  const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);
  const headers: Record<string, string> = { Title: header(n.title), Priority: String(n.priority ?? 3) };
  if (n.tags?.length) headers.Tags = n.tags.join(",");
  if (n.click) headers.Click = n.click;
  if (process.env.NOTIFY_TOKEN) headers.Authorization = `Bearer ${process.env.NOTIFY_TOKEN}`;
  try {
    const res = await fetch(url, { method: "POST", body: n.body, headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) console.warn(`[notify] ntfy answered ${res.status}`);
  } catch (e) {
    console.warn(`[notify] could not reach ntfy: ${(e as Error).message}`);
  }
}
