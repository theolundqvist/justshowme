#!/usr/bin/env python3
"""Narration, word timings, music bed, SFX and the final mix for a videoviz video.

  voice.py <dir>                 TTS every beat, write <dir>/timeline.json and <dir>/audio/mix.m4a
  voice.py <dir> --silent        no audio; word timings synthesised at 150 wpm so cues still resolve
  voice.py --audition "<text>" --voices gemini:Puck,gemini:Charon [--out DIR]

Voices: gemini:<voice> is Gemini 2.5 Pro TTS on Vertex AI (gcloud login), read with STYLE and verified verbatim
by local faster-whisper, which also supplies the word timings. Default gemini:Puck.
"""
import argparse, base64, difflib, hashlib, json, os, re, subprocess, sys, tempfile, unicodedata, urllib.error, urllib.request
import numpy as np

SR = 48000
CACHE = os.path.expanduser('~/.cache/videoviz')
TTS_MODEL = 'gemini-2.5-pro-tts'
DEFAULT_VOICE = 'gemini:Puck'
TRIES = 4
WHISPER = 'small.en'
STYLE = ('Read this as a narrator: conversational, lightly energetic, plain, about 155 words per minute, '
         'like a relaxed, curious teacher showing a friend something; read exactly as written')


def setting(name, default=None):
    v = os.environ.get(name)
    if not v and os.path.exists(os.path.expanduser('~/.config/.env')):
        for line in open(os.path.expanduser('~/.config/.env')):
            if line.startswith(name + '='):
                v = line.split('=', 1)[1].strip().strip('"\'')
    return v or default


def env(name):
    return setting(name) or sys.exit(f'{name} is not set')


ELEVEN = setting('ELEVENLABS_API_BASE', 'https://api.elevenlabs.io')


def gcloud(*a):
    return subprocess.check_output(['gcloud', *a], text=True, stderr=subprocess.DEVNULL).strip()


def vertex():
    """(project, bearer header) for Vertex AI from the gcloud login."""
    project = setting('GOOGLE_CLOUD_PROJECT') or gcloud('config', 'get-value', 'project')
    return project, {'Authorization': f'Bearer {gcloud("auth", "print-access-token")}'}


def http(url, body=None, headers=None, raw=None, timeout=300):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {'Content-Type': 'application/json'} if body is not None else {}
    req = urllib.request.Request(url, data=data, headers={**h, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{url.split("?")[0]} -> {e.code}: {e.read()[:300].decode(errors="replace")}') from None


def cached(kind, key, ext, make):
    os.makedirs(f'{CACHE}/{kind}', exist_ok=True)
    path = f'{CACHE}/{kind}/{hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()[:24]}.{ext}'
    if not os.path.exists(path):
        tmp = path + '.tmp'
        open(tmp, 'wb').write(make())
        os.replace(tmp, path)
        print(f'  generated {kind} {os.path.basename(path)}', file=sys.stderr)
    return path


def decode(path):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).copy()


def norm(w):
    """Whisper spells accents and ß its own way (Cafe, Strasse); compare words without them."""
    w = w.lower().replace('’', "'").replace('ß', 'ss')
    w = ''.join(c for c in unicodedata.normalize('NFKD', w) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9']+", '', w)


def align(script_words, heard):
    """Map every script word to a time, using the heard [(word, start, end)] and interpolating misses."""
    a, b = [norm(w) for w in script_words], [norm(w) for w, _, _ in heard]
    times = [None] * len(a)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = heard[blk.b + k][1:]
    end = heard[-1][2] if heard else 0.0
    i = 0
    while i < len(a):
        if times[i]:
            i += 1
            continue
        j = i
        while j < len(a) and not times[j]:
            j += 1
        t0 = times[i - 1][1] if i else 0.0
        t1 = times[j][0] if j < len(a) else end
        span = sum(len(w) + 1 for w in script_words[i:j])
        acc = 0
        for k in range(i, j):
            s = t0 + (t1 - t0) * acc / span
            acc += len(script_words[k]) + 1
            times[k] = (s, t0 + (t1 - t0) * acc / span)
        i = j
    return [{'w': w, 's': round(s, 3), 'e': round(e, 3)} for w, (s, e) in zip(script_words, times)]


# ---- narration: Gemini TTS, every take checked verbatim by local Whisper, which also gives the word times ----
def gemini_pcm(text, voice, style):
    project, auth = vertex()
    body = {'contents': [{'role': 'user', 'parts': [{'text': f'{style}: {text}'}]}],
            'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    url = f'https://aiplatform.googleapis.com/v1/projects/{project}/locations/global/publishers/google/models/{TTS_MODEL}:generateContent'
    part = json.loads(http(url, body, auth))['candidates'][0]['content']['parts'][0]['inlineData']
    if not part['mimeType'].startswith('audio/L16') or 'rate=24000' not in part['mimeType']:
        raise RuntimeError(f"unexpected audio format {part['mimeType']}")
    return base64.b64decode(part['data'])


def misread(script_words, heard):
    """Script words Whisper did not hear in order. One isolated miss per ~30 words is Whisper's own error; adjacent misses are a paraphrase."""
    a, b = [norm(w) for w in script_words], [norm(w) for w, _, _ in heard]
    hit = [False] * len(a)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            hit[blk.a + k] = True
    misses = [w for w, h in zip(script_words, hit) if not h]
    adjacent = any(not hit[i] and not hit[i + 1] for i in range(len(hit) - 1))
    extra = len(b) - len(a)
    ok = len(misses) <= max(1, len(a) // 30) and not adjacent and extra <= max(1, len(a) // 20)
    return None if ok else (misses, extra)


_whisper = None


def transcribe(mp3, text):
    """[(word, start, end)] heard in the take; the script is the prompt so names and jargon are spelled as written."""
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel(WHISPER, device='cpu', compute_type='int8', cpu_threads=2)
    with tempfile.NamedTemporaryFile(suffix='.mp3') as f:
        f.write(mp3)
        f.flush()
        segs, _ = _whisper.transcribe(f.name, language='en', word_timestamps=True, initial_prompt=text, vad_filter=False)
        return [(w.word.strip(), float(w.start), float(w.end)) for s in segs for w in s.words if w.word.strip()]


def take(text, voice, style):
    reasons = []
    for attempt in range(1, TRIES + 1):
        pcm = gemini_pcm(text, voice, style)
        mp3 = subprocess.run(['ffmpeg', '-v', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', '-', '-b:a', '160k', '-f', 'mp3', '-'],
                             input=pcm, capture_output=True, check=True).stdout
        heard = transcribe(mp3, text)
        bad = misread(text.split(), heard)
        if bad is None:
            return mp3, heard
        misses, extra = bad
        reasons.append(f'take {attempt}: missed {misses[:8]}{"..." if len(misses) > 8 else ""}, {extra:+d} words; heard: {" ".join(w for w, _, _ in heard)[:200]}')
        print(f'  retake ({reasons[-1][:160]})', file=sys.stderr)
    raise RuntimeError(f'{TTS_MODEL} {voice} did not read this beat verbatim in {TRIES} takes:\n  ' + '\n  '.join(reasons) + f'\n  script: {text}')


def speak(text, spec, style=STYLE):
    provider, voice = spec.split(':', 1)
    if provider != 'gemini':
        sys.exit(f'unknown voice {spec}: use gemini:<voice>, e.g. {DEFAULT_VOICE}')
    out = {}

    def make():
        mp3, out['words'] = take(text, voice, style)
        return mp3
    mp3 = cached('tts', {'p': provider, 'm': TTS_MODEL, 'v': voice, 't': text, 's': style}, 'mp3', make)
    wpath = mp3[:-4] + '.words.json'
    if 'words' in out:
        json.dump(out['words'], open(wpath, 'w'))
    return mp3, [tuple(w) for w in json.load(open(wpath))]


def trimmed(path):
    a = decode(path)
    idx = np.where(np.abs(a) > 0.006)[0]
    if not len(idx):
        return a, 0.0
    s, e = max(0, idx[0] - int(0.04 * SR)), min(len(a), idx[-1] + int(0.15 * SR))
    return a[s:e], s / SR


# ---- music and SFX ----
def music(prompt, seconds):
    path = cached('music', {'prompt': prompt, 'p': 'lyria'}, 'wav', lambda: lyria(prompt))
    bed = decode(path)
    xf = int(2.5 * SR)
    ramp = np.linspace(0, 1, xf, dtype=np.float32)
    out = np.zeros(int(seconds * SR) + len(bed), dtype=np.float32)
    pos = 0
    while pos < seconds * SR:
        seg = bed.copy()
        seg[:xf] *= np.sin(ramp * np.pi / 2)
        seg[-xf:] *= np.cos(ramp * np.pi / 2)
        out[pos:pos + len(seg)] += seg
        pos += len(seg) - xf
    return out[:int(seconds * SR)]


def lyria(prompt):
    project, auth = vertex()
    url = f'https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/us-central1/publishers/google/models/lyria-002:predict'
    d = json.loads(http(url, {'instances': [{'prompt': prompt, 'negative_prompt': 'vocals, singing, drums, percussion'}], 'parameters': {'sample_count': 1}}, auth))
    return base64.b64decode(d['predictions'][0]['bytesBase64Encoded'])


def sfx(prompt, dur):
    return decode(cached('sfx', {'prompt': prompt, 'dur': dur}, 'mp3', lambda: http(f'{ELEVEN}/v1/sound-generation',
                  {'text': prompt, 'duration_seconds': dur, 'prompt_influence': 0.5}, {'xi-api-key': env('ELEVENLABS_API_KEY')})))


def db(x):
    return 10 ** (x / 20)


def rms(a):
    return float(np.sqrt(np.mean(a.astype(np.float64) ** 2)) + 1e-9)


def build(d, args):
    script = json.load(open(f'{d}/script.json'))
    tier = script.get('tier', 'quick')
    spec = args.voice or script.get('voice', DEFAULT_VOICE)
    style = script.get('style', STYLE)
    beats, t, voice_parts, used = [], 0.0, [], set()
    for i, b in enumerate(script['beats']):
        text = b.get('say', '')
        lead = b.get('lead', 0.8 if i == 0 else 0.6)
        hold = b.get('hold', 2.0)
        words, vdur = [], 0.0
        if text and not args.silent:
            mp3, heard = speak(text, spec, style)
            used.add(spec)
            audio, cut = trimmed(mp3)
            vdur = len(audio) / SR
            words = align(text.split(), [(w, max(0.0, s - cut), max(0.0, e - cut)) for w, s, e in heard])
            voice_parts.append((t + lead, audio))
        elif text:
            per = 60 / 150
            words = [{'w': w, 's': round(k * per, 3), 'e': round((k + 1) * per, 3)} for k, w in enumerate(text.split())]
            vdur = len(words) * per
        dur = b.get('dur') or (lead + vdur + hold)
        for w in words:
            w['s'] = round(w['s'] + lead, 3); w['e'] = round(w['e'] + lead, 3)
        beats.append({'id': b['id'], 'text': text, 'start': round(t, 3), 'dur': round(dur, 3), 'voice': [lead, round(lead + vdur, 3)],
                      'words': words, 'transition': b.get('transition', 'fade'), 'sfx': b.get('sfx', [])})
        t += dur
    total = round(t, 3)
    n_words = sum(len(b['words']) for b in beats)
    tl = {'title': script.get('title', ''), 'tier': tier, 'theme': script.get('theme', 'dark'), 'fps': script.get('fps', 30),
          'total': total, 'voice': sorted(used), 'audio': None, 'beats': beats}
    os.makedirs(f'{d}/audio', exist_ok=True)
    if voice_parts:
        n = int((total + 0.5) * SR)
        voice = np.zeros(n, dtype=np.float32)
        for start, a in voice_parts:
            s = int(start * SR); voice[s:s + len(a)] += a[:n - s]
        voice *= db(-20) / rms(voice[np.abs(voice) > 0.01])
        mix = voice.copy()
        m = script.get('music')
        if m and not args.no_music:
            prompt = m if isinstance(m, str) else m['prompt']
            bed = music(prompt, total + 0.5)
            bed *= db(-20) / rms(bed)
            speech = (np.abs(voice) > 0.01).astype(np.float32)
            k = int(0.5 * SR)
            cs = np.concatenate([[0], np.cumsum(speech)])
            idx = np.arange(n)
            env_ = np.clip((cs[np.minimum(idx + k, n)] - cs[np.maximum(idx - k, 0)]) / k * 3, 0, 1)
            gain = db(-12) * (1 - env_) + db(-22) * env_
            fin, fout = int(1.0 * SR), int(3.0 * SR)
            gain[:fin] *= np.linspace(0, 1, fin); gain[-fout:] *= np.linspace(1, 0, fout)
            mix += bed * gain
        for b in beats:
            for fx in b['sfx']:
                at = fx['at'] if isinstance(fx['at'], (int, float)) else next(w['s'] for w in b['words'] if norm(w['w']) == norm(fx['at']))
                a = sfx(fx['prompt'], fx.get('dur', 1.0)) * db(-20 + fx.get('gain', -4)) / rms(sfx(fx['prompt'], fx.get('dur', 1.0)))
                s = int((b['start'] + at) * SR); mix[s:s + len(a)] += a[:n - s]
        wav = f'{d}/audio/.mix.wav'
        write_wav(wav, mix)
        write_wav(f'{d}/audio/narration.wav', voice)
        loudnorm(wav, f'{d}/audio/mix.m4a')
        os.remove(wav)
        tl['audio'] = 'audio/mix.m4a'
    json.dump(tl, open(f'{d}/timeline.json', 'w'), indent=1)
    if args.words_out:
        json.dump([{'word': w['w'], 'start': round(b['start'] + w['s'], 3), 'end': round(b['start'] + w['e'], 3)} for b in beats for w in b['words']], open(args.words_out, 'w'), indent=1)
    for b in beats:
        print(f"{b['id']:18s} start {b['start']:6.1f}  voice {b['voice'][1] - b['voice'][0]:5.1f}  dur {b['dur']:5.1f}")
    print(f"total {total:.1f} s, {n_words} words, {n_words / total * 60:.0f} wpm overall (target ~150), voice {', '.join(sorted(used)) or 'none'}")


def write_wav(path, a):
    a = np.clip(a, -1, 1)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', path], input=a.astype(np.float32).tobytes(), check=True)


def loud_json(stderr):
    return json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}', stderr)[-1])


def loudnorm(src, dst, target=-16):
    f = f'loudnorm=I={target}:TP=-1.5:LRA=11'
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', f + ':print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    m = loud_json(r.stderr)
    f2 = f + f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true:print_format=json"
    r = subprocess.run(['ffmpeg', '-hide_banner', '-y', '-i', src, '-af', f2, '-ar', str(SR), '-c:a', 'aac', '-b:a', '192k', dst], capture_output=True, text=True)
    out = loud_json(r.stderr)
    print(f"mix {dst}: {out['output_i']} LUFS, true peak {out['output_tp']} dBTP")


def audition(text, specs, out):
    os.makedirs(out, exist_ok=True)
    for spec in specs:
        try:
            mp3, heard = speak(text, spec)
        except RuntimeError as e:
            print(f'{spec:22s} FAILED {str(e)[:120]}')
            continue
        name = spec.replace(':', '-')
        subprocess.run(['cp', mp3, f'{out}/{name}.mp3'], check=True)
        a, b = [norm(w) for w in text.split()], [norm(w) for w, _, _ in heard]
        sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
        wer = 1 - sum(x.size for x in sm.get_matching_blocks()) / len(a)
        audio, _ = trimmed(mp3)
        frame = int(0.03 * SR)
        e = np.array([rms(audio[i:i + frame]) for i in range(0, len(audio) - frame, frame)])
        pauses = float(np.mean(e < rms(audio) * 0.12))
        print(f'{spec:22s} {len(audio) / SR:5.1f} s  {len(a) / (len(audio) / SR) * 60:4.0f} wpm  WER {wer:.1%}  pause {pauses:.0%}  pitch sd {pitch_sd(audio):.1f} st  -> {out}/{name}.mp3')


# Spread of the voiced F0 in semitones: low is flat, around 3-4 is lively speech, high is sing-song.
def pitch_sd(audio):
    x, sr, n = audio[::3].astype(np.float64), SR // 3, int(0.04 * SR / 3)
    lo, hi, f0 = sr // 300, sr // 70, []
    for i in range(0, len(x) - n, n):
        f = x[i:i + n] - np.mean(x[i:i + n])
        if rms(f) < rms(x) * 0.5:
            continue
        ac = np.correlate(f, f, 'full')[n - 1:]
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.4 * ac[0]:
            f0.append(sr / lag)
    return float(np.std(12 * np.log2(np.array(f0) / np.median(f0)))) if len(f0) > 10 else 0.0


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('dir', nargs='?')
    p.add_argument('--silent', action='store_true')
    p.add_argument('--no-music', action='store_true')
    p.add_argument('--voice')
    p.add_argument('--words-out', help='also write flat [{word,start,end}] in video seconds')
    p.add_argument('--audition')
    p.add_argument('--voices', default='gemini:Puck,gemini:Charon,gemini:Fenrir,gemini:Kore')
    p.add_argument('--out', default='/tmp/videoviz-audition')
    a = p.parse_args()
    if a.audition:
        audition(a.audition, a.voices.split(','), a.out)
    else:
        build(os.path.abspath(a.dir), a)
