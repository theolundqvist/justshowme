# Craft: how the reference video was made

The reference is a 4 min 4 s narrated explainer of a database pull request: Gmail treats `Café` and `Cafe` as two labels, MySQL's `utf8mb4_0900_ai_ci` collation treats them as one, and the PR stops the second from overruling the first. 15 beats, 554 words, 136 wpm overall, one voice, a quiet music bed and three sound effects. Viewers called out the voice, the level of detail and the storytelling. This file records what each of those was, concretely, so the next video starts there.

## 1. The brief comes before the script

The brief is a file with four parts, written before any narration:

1. **Style and viewer.** "A database teacher on YouTube: conversational, curious, a little playful, never hype. Real SQL on screen with real results. Short sentences. The camera pushes into the line of SQL the voice is talking about." The viewer: a technical lead who wants the whole change and why.
2. **Verified facts, verbatim.** Real query output from the real database version (`SELECT 'Café' = 'Cafe'` → `1`, `CHAR_LENGTH('Straße')` → `6`, the broken rename producing `Renamede/Inner`), the exact SQL from the base commit with its file and line, the exact schema lines, the before/after outputs of one CI job that ran both versions on the same scenarios, and a benchmark marked as private (not production latency). The header says *do not invent others*.
3. **The script**, beat by beat, verbatim.
4. **A visual plan**: one hero per beat in a line each, and the recurring anchor (the two label chips `Café` and `Cafe`).

Every on-screen string and every spoken number traces to part 2. The one error the reference shipped proves the rule: its tradeoff beat said a deferred case "nests on the next sync" because an earlier slide summary said so, while the code actually created a separate parent. Claims about the future get traced through the code like everything else.

## 2. Story shape

| # | beat | s | job | hero |
|---|---|---|---|---|
| 1 | hook | 12.6 | concrete cold open | two chips, `Café` / `Cafe`, each with its Gmail id; "Let's ask MySQL." |
| 2 | collation | 23.1 | the surprising fact, proven live | query card types `SELECT 'Café' = 'Cafe'`, a big `1` pops; then `Straße` = `Strasse`; schema card with the collation underlined |
| 3 | question | 9.3 | name the viewer's question | the chips slide into each other, crack, flash; caption "same name?" |
| 4 | recase | 19.6 | symptom 1 | tree `Notifications` → `notifications/CI`; the `n` turns red and capital; "rename → Gmail" |
| 5 | renamede | 24.8 | symptom 2, the favourite | the real UPDATE with CONCAT/SUBSTRING; character cells count 6 vs 7; the stray `e` ringed |
| 6 | fold | 12.7 | symptom 3 | two children pulled into one invented parent |
| 7 | rootcause | 14.2 | one-sentence cause | `WHERE name = ?` matches both chips; then the ids glow: "the id is the identity" |
| 8 | identity | 20.6 | fix 1 | schema card for the virtual column; a two-row table of its values; the new key |
| 9 | expand | 15.7 | why both keys exist | old key bar, new key bar, old one marked "dropped later" |
| 10 | parents | 14.9 | fix 2 | a decision flow with tokens running each path |
| 11 | renames | 19.4 | fix 3 | the path rebuilt segment by segment; a whole-tree gate that passes before any write |
| 12 | migration | 14.9 | fix 4 | two copies, one deleted in Gmail and one live; the live one merges |
| 13 | perf | 12.6 | the bonus | two shrinking bars with counters, "was 2.221 s", caption "private MySQL benchmark" |
| 14 | tradeoff | 14.9 | honesty | NOW panel vs dashed AFTER panel |
| 15 | close | 14.3 | answer the opening question | the same two chips, a tick under each, in Gmail and in Scape |

What makes the shape work:

- **Cold open on the object, not a title.** The first frame is the two chips the whole video is about. No title card, no agenda.
- **Prove the surprise with the real tool.** The second beat runs the query and shows the database's own answer. The viewer believes the rest because they saw this.
- **Name the question by beat 3**, in the viewer's words: "So what happens when Gmail has names that MySQL thinks are the same?"
- **Escalating symptoms, then one cause.** Three failures, each stranger than the last, then a single sentence explains all three. The cause beat ends on the fix's idea ("Gmail already gives every label a stable id. That's the real identity.") so the fixes feel inevitable.
- **Numbered fixes.** "First… Second… Third… Fourth…" lets the viewer keep count without a slide of bullets.
- **Admit the cost.** One beat says plainly what gets worse and until when. It buys trust for every claim before it.
- **Close on the opening image.** The same two chips answer the same question.

## 3. The script, written for the ear

Rules the reference followed, with its own lines as examples:

- **Short declaratives, plain words.** "Select Café equals Cafe. One. True. Same string."
- **One personal aside per video, no more.** "This one's my favorite." Personality lives in small asides and understatement ("Turns out, a bunch of weird stuff."), never in hype.
- **A closing button line.** "MySQL can think whatever it wants."
- **Say symbols the way people say them.** `utf8mb4_0900_ai_ci` became "the zero nine hundred A I C I collation"; `/` became "slash"; `2.221 s` became "two point two seconds"; "two hundred thirty one SQL statements to sixty two".
- **Rewrite what the ear can't hear.** The broken output `Renamede/Inner` sounds like "Renamed", so the line became "So you get Renamed, plus a stray e, slash Inner." Whisper's transcript of each take is how you find these: if Whisper hears something else, so will a listener.
- **Name the real code.** CONCAT, SUBSTRING, CHAR_LENGTH, "a virtual column, provider name owner". Teachers quote the real thing.
- **Numbers are real and labelled.** The benchmark beat says "in a benchmark", and the caption says "private MySQL benchmark".
- **Pace.** 136 wpm overall with holds; each beat's voice runs 7–23 s. Long beats (the collation proof, the rename) earn their length with something new every sentence.

## 4. The voice

- **Model and voice:** Gemini 2.5 Pro TTS (`gemini-2.5-pro-tts`) on Vertex AI, prebuilt voice **Puck**. It sounds like a relaxed person talking, keeps a natural pitch spread, and reads verbatim far more reliably than realtime chat models used as narrators.
- **Style instruction**, sent as a prefix to every beat's text: *"Read this as a narrator: conversational, lightly energetic, plain, about 155 words per minute, like a relaxed, curious database teacher; read exactly as written"*. Name the kind of teacher that fits the subject; keep the rest.
- **One request per beat**, PCM at 24 kHz, encoded to MP3, trimmed of leading and trailing silence.
- **Verbatim check.** Local `faster-whisper small.en` (int8, 2 CPU threads) transcribes each take with the script as `initial_prompt`. Words are compared after lowercasing, accent folding and `ß` → `ss`, because Whisper writes `Café` as `Cafe` and `Straße` as `Strassa`. A take passes with at most one isolated miss per 30 words and no two adjacent misses (adjacent misses mean a paraphrase); otherwise it is retaken, up to 4 times.
- **Word times** come from the same transcription and are aligned onto the script words (misses interpolated), so every script phrase has a tick.
- **Breathing room.** Each beat starts with a lead of 0.8 s (first) or 0.6 s, and ends with a hold of 1.2–3 s while the picture resolves. The final beat holds 3 s.
- **Cache.** Takes are cached by (model, voice, style, text): fixing one line re-records one beat.

## 5. Sound

- **Voice** normalised to −20 dBFS RMS over speech.
- **Music bed:** Lyria 002 on Vertex with the prompt "light lo-fi beat, warm keys, unobtrusive, steady" and the negative prompt "vocals, singing, drums, percussion". The generated clip loops with 2.5 s equal-power crossfades, is normalised to −20 dBFS RMS, then held 12 dB down between sentences and ducked 22 dB down under speech (speech envelope over a 0.5 s window), with a 1 s fade in and a 3 s fade out.
- **SFX, three in four minutes,** each tied to a spoken word: a soft wooden tick on "One." when the query returns true, a short dry glass crack on "weird" when the chips collide, and a warm two-note chime on "Scape." in the close. Gains −10 to −12 dB below the voice.
- **Master:** two-pass `loudnorm` to −16 LUFS integrated, −1.5 dBTP, LRA 11, AAC 192 kb/s.

## 6. Picture

**One hero per beat**, filling most of the frame; everything else is dimmed or absent. Beats crossfade over 18 ticks (0.3 s) inside `Scene`.

**Colour is meaning, fixed for the whole video:**

| colour | means | examples |
|---|---|---|
| `C.live` amber | the source of truth's data (Gmail) | label chips, "GMAIL" panel |
| `C.cool` blue | our system | "SCAPE" panel, server boxes |
| `C.claude` orange | code and the change | SQL card dot, new key, `CONCAT` marks |
| `C.ok` green | the fix, a pass | ids glowing, ticks, "next sync" |
| `C.bad` red | the failure | the recased `N`, the stray `e`, crosses |
| `C.mute` grey | context | old values, comments |

**Primitives that carried the detail:**

- **Chips with ids** (`Tag`). Every label is a mono chip with its Gmail id underneath (`id Label_1`). The id fades in when the voice says the names differ, and turns green when the root cause names it.
- **Live query cards** (`Sql`). The card types itself in at about 100 characters a second, colours keywords, strings and template parameters, and its title is the real source (`mysql 8.0.46`, `staging: label-definition-repository.ts`). Marks highlight a line when the voice reaches it; a red squiggle runs under exactly the columns being blamed.
- **Counting characters** (`Cells`, `Dim`). The rename bug is arithmetic, so the video does the arithmetic: `Straße` in six cells with a bracket "6 chars", `Strasse/Inner` in cells beneath with "7 chars", the seventh cell red, the cut line drawn through it. Nobody has to imagine an off-by-one.
- **One letter at a time** (`spans`, `charX`, `Ring`). A chip's text can be split into coloured spans, so the lowercase `n` turns into a red `N`, and a ring lands on a single glyph using monospace geometry (`charX(cx, n, i, size)`).
- **Verdicts.** A cross where staging went wrong, a tick where the fix lands, never a sentence saying so.
- **Numbers that move.** `Counter` ticks from old to new with its unit and a small "median, was 2.221 s" under it; `Bar` shrinks from a dashed outline that keeps the old value visible.
- **Now and later.** The tradeoff is two panels: a solid "NOW" and a dashed "AFTER OLD KEY DROP", with a dashed arrow for what the next sync does.
- **Captions** at most six words, carrying the load-bearing phrase, never the sentence being spoken: "accent + case blind", "same name?", "edited by a collation", "one invented parent", "the id is the identity", "expand now, contract later", "no guessing, no Gmail write", "check the whole tree first", "merge the live copy", "private MySQL benchmark", "next sync nests it", "two labels, two rows". The `em` word gets a hand-drawn underline in its concept colour.

## 7. Binding picture to voice

Every visual event hangs on a spoken phrase. Each beat starts with a cue table:

```tsx
const S = useCues();
const q = (id: string, phrase: string) => S.at(phrase, S.beat(id));
const rn = {
  rename: q("renamede", "Rename Straße"),
  substr: q("renamede", "SUBSTRING"),
  six: q("renamede", "Straße is six"),
  seven: q("renamede", "Seven."),
  youget: q("renamede", "So you get"),
  stray: q("renamede", "stray e,"),
};
```

Then entrances, highlights and camera moves use those ticks with small offsets (ticks are 1/60 s):

- Elements enter **10–30 ticks after** their cue, so the word lands first and the picture answers it.
- The camera starts moving **6–10 ticks before** its cue, so it arrives as the word is spoken.
- A caption enters on its phrase and leaves **10 ticks before** the next beat.
- Siblings in a group stagger by 6–14 ticks (`B.renamede + 10`, `+ 24`, `+ 30`) so the group reads in order.

```tsx
<Scene from={B.renamede} to={N.renamede} shots={[
  { at: 0, x: 960, y: 580, zoom: 1.15 },
  { at: rn.substr - 4, x: 960, y: 300, zoom: 1.28, dur: 50 },  // push into SUBSTRING as it is said
  { at: rn.six - 16, x: 960, y: 540, zoom: 1.0, dur: 60 },     // pull back for the counting
]}>
  <Sql x={220} y={50} w={1480} size={40} at={rn.rebuilt} title="staging: repository.ts"
       lines={["UPDATE label_definitions", "SET name = CONCAT(", "      ${name},", "      SUBSTRING(name, CHAR_LENGTH(${current.name}) + 1)"]}
       marks={[{ line: 3, at: rn.substr, color: C.live }]} squiggle={{ line: 3, c0: 22, c1: 50, at: rn.len }} />
  <Cells x={RX} y={515} chars="Straße" at={rn.six + 30} color={() => C.live} />
  <Dim x0={RX} x1={RX + 6 * 78 - 6} y={500} at={rn.six + 30} text="6 chars" color={C.live} />
  <Cells x={RX} y={645} chars="Strasse/Inner" at={rn.child} color={(i) => (i === 6 && f >= rn.youget ? C.bad : C.cool)} />
  <Ring x={charX(900, 14, 7, 60)} y={880} r={30} at={rn.stray} color={C.bad} />
</Scene>
```

## 8. Camera

Every beat has two or three framings and is never static for the whole beat:

- open slightly tight on the hero (zoom 1.15–1.3),
- push in when the voice names the culprit (the SUBSTRING line, the lowercase `n`),
- pull back to 1.0 for the consequence, so the viewer sees the whole result.

Moves glide over 50–120 ticks with an ease-out; nothing snaps except a ring popping on and a few-pixel jolt when the chips collide.

## 9. Review

1. `check.mjs` at every sentence end: no small, clipped or overlapping text.
2. A contact sheet of the rendered video at 60% of each beat, read beat by beat against the script: the picture must show what the voice is saying at that moment.
3. Whisper's transcript of every take, read against the script; mishearings point at lines to rewrite (that is how "Renamede" was caught).
4. One full listen with the picture.

## 10. Rendering and delivery

- 7310 frames at 30 fps. On a CI runner one browser rendered about 1.4 frames a second, so a single job could not finish within its 20-minute limit.
- The video was cut into 20 slices of 366 frames, rendered in parallel (about 4.5 minutes each), and joined with `ffmpeg -f concat -c copy`, then the mix was laid over once. `publish.mjs --frames` and `join.mjs` do this directly.
- The first join came out 0.87 s long: each slice carried its own audio, which ran slightly past its video and left a 0.079 s gap at every seam. Slices are now silent and the concat list pins every slice to its frame count.
- The seam with the most motion was checked frame by frame against a local render (PSNR, best match at the same frame index on both sides); no off-by-one.
- 1080p came to 40 MB; a 720p copy at CRF 30 with `-tune animation` was 5.6 MB and still crisp, which is what went into the PR.
