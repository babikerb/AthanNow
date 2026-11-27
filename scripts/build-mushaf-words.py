"""
Builds the Quran reader's word data from quran.com's API: all 604 pages of the Madani mushaf, each
line with its words in KFGQPC Hafs (QPC) text, and the surah headers and Bismillahs the API leaves
out. Also measures every line in the bundled font, so the reader can size the page without guessing.

    python scripts/build-mushaf-words.py

Writes modules/quran-reader/ios/QuranReaderResources/mushaf.json:
  { "ref": em width the page is sized to, "names": Arabic surah names,
    "pages": [ [ line, ... ] x15 (8 on pages 1 and 2) ] }
  line = {"h": surah} | {"b": 1} | {"w": [[surah, ayah, word, text, glyph], ...], "e": em width}
  word 0 is an ayah's end marker (its number). text is KFGQPC Hafs (for the flowing, zoomed view);
  glyph is the word's single glyph in quran.com's QCF V2 font for that page, which draws the
  printed Madani page exactly (fonts are downloaded per page by the reader).
"""
import json, os, sys, time, urllib.request, concurrent.futures as cf

import uharfbuzz as hb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'modules', 'quran-reader', 'ios', 'QuranReaderResources')
FONT = os.path.join(RES, 'UthmanicHafs.ttf')
CACHE = os.path.join(os.environ.get('TEMP', '/tmp'), 'mushaf-pages-v2')
os.makedirs(CACHE, exist_ok=True)


def fetch_page(p):
    path = os.path.join(CACHE, f'{p}.json')
    if os.path.exists(path):
        return json.load(open(path, encoding='utf-8'))
    verses, page = [], 1
    while True:
        url = f'https://api.quran.com/api/v4/verses/by_page/{p}?words=true&word_fields=text_qpc_hafs,code_v2,v2_page,line_number&per_page=50&page={page}'
        for attempt in range(5):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'mushaf-builder'})
                d = json.load(urllib.request.urlopen(req, timeout=30))
                break
            except Exception:
                time.sleep(2 * (attempt + 1))
        else:
            raise SystemExit(f'page {p} failed')
        verses += d['verses']
        if not d['pagination'].get('next_page'):
            break
        page += 1
    json.dump(verses, open(path, 'w', encoding='utf-8'))
    return verses


with cf.ThreadPoolExecutor(8) as ex:
    raw = list(ex.map(fetch_page, range(1, 605)))

blob = hb.Blob.from_file_path(FONT)
face = hb.Face(blob)
font = hb.Font(face)
upem = face.upem


def em(text):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {})
    return sum(p.x_advance for p in buf.glyph_positions) / upem


pages = []
pending_bismillah = None  # a header ended the last page; its Bismillah opens this one
for p, verses in enumerate(raw, start=1):
    total = 8 if p <= 2 else 15
    lines = {}
    for v in verses:
        s, a = map(int, v['verse_key'].split(':'))
        for w in v['words']:
            if w['char_type_name'] not in ('word', 'end'):
                continue
            n = w['position'] if w['char_type_name'] == 'word' else 0
            # An ayah that runs across two pages comes back with both pages: keep this page's words.
            if w.get('v2_page') != p:
                continue
            lines.setdefault(w['line_number'], []).append([s, a, n, w['text_qpc_hafs'], w['code_v2']])
    out = []
    missing = [n for n in range(1, total + 1) if n not in lines]
    # Each run of missing lines is a surah's header (and Bismillah), for the surah that follows it.
    runs, run = [], []
    for n in missing:
        if run and n != run[-1] + 1:
            runs.append(run)
            run = []
        run.append(n)
    if run:
        runs.append(run)
    filled = {}
    for run in runs:
        after = next((lines[n] for n in range(run[-1] + 1, total + 1) if n in lines), None)
        surah = after[0][0] if after else (lines[max(lines)][-1][0] + 1)
        kinds = []
        if run[0] == 1 and pending_bismillah == surah and len(run) == 1:
            kinds = ['b']
        elif surah in (1, 9):
            kinds = ['h'] * len(run)
        elif len(run) >= 2:
            kinds = ['h', 'b'] + ['h'] * (len(run) - 2)
        else:
            kinds = ['h']
        for n, k in zip(run, kinds):
            filled[n] = {'h': surah} if k == 'h' else {'b': 1}
        pending_bismillah = surah if (not after and kinds == ['h'] and surah not in (1, 9)) else None
    if lines:
        last = max(lines)
        if last == total:
            pending_bismillah = None
    for n in range(1, total + 1):
        if n in lines:
            ws = lines[n]
            out.append({'w': ws, 'e': round(sum(em(w[3]) for w in ws), 3)})
        else:
            out.append(filled.get(n, {'h': 0}))
    pages.append(out)

widths = sorted(max((l['e'] + 0.25 * (len(l['w']) - 1)) for l in pg if 'w' in l) for pg in pages[2:])
ref = widths[int(len(widths) * 0.97)]
chapters = json.load(urllib.request.urlopen(urllib.request.Request('https://api.quran.com/api/v4/chapters?language=en', headers={'User-Agent': 'mushaf-builder'})))['chapters']
names = [c['name_arabic'] for c in sorted(chapters, key=lambda c: c['id'])]
json.dump({'ref': round(ref, 3), 'names': names, 'pages': pages}, open(os.path.join(RES, 'mushaf.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('pages', len(pages), 'ref em', round(ref, 3), 'max', widths[-1], 'min', widths[0])
unk = [(i + 1, j + 1) for i, pg in enumerate(pages) for j, l in enumerate(pg) if l.get('h') == 0]
print('unfilled lines', unk[:20])

# The JS side only needs where each page starts: the first word printed on it, as [surah, ayah, word]
# (src/data/mushafIndex.json). A page can begin partway through an ayah.
starts = []
for pg in pages:
    first = next(w for l in pg if 'w' in l for w in l['w'])
    starts.append([first[0], first[1], first[2] or 999])
json.dump({'pageStarts': starts}, open(os.path.join(ROOT, 'src', 'data', 'mushafIndex.json'), 'w'), separators=(',', ':'))
print('index pages', len(starts))
