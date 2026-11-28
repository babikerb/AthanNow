"""
Builds src/data/ayahOfTheDay.json: ayahs from across the Quran that stand on their own and speak to
everyday life, each with a theme, for the Quran home's Ayah of the day.

An ayah is taken when its meaning (Sahih International, the bundled translation) touches one of the
themes below, it is short enough for the card, and it doesn't lean on the ayah before it (no "And
they said", "So when", "Then", a reply in a story...). Run: python scripts/build-ayah-of-the-day.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'modules', 'quran-reader', 'ios', 'QuranReaderResources')

THEMES = [
    ('worry and hardship', r'\b(ease|hardship|distress|grieve|grief|fear not|do not fear|anxiety|burden|relief)\b'),
    ('patience', r'\b(patien\w*|persever\w*|steadfast)\b'),
    ('hope', r'\b(despair not|do not despair|good tidings|glad tidings)\b'),
    ('gratitude', r'\b(grateful|gratitude|thank\w*)\b'),
    ('mercy', r'\b(merciful|mercy)\b'),
    ('forgiveness', r'\b(forgiv\w*|repent\w*|pardon)\b'),
    ('family', r'\b(parents|mother|father|children|spouses|wives|husband|kindred|relatives|orphan\w*)\b'),
    ('kindness', r'\b(kind\w*|good manner|gently|gentle|courtesy|neighbou?r)\b'),
    ('charity', r'\b(spend\w*|charit\w*|give\w* zakah|zakah|the poor|the needy)\b'),
    ('honesty and justice', r'\b(justice|just|truthful|honest\w*|trust\w*|fairly|equity)\b'),
    ('knowledge', r'\b(knowledge|learn\w*|reflect\w*|reason|understand|ponder|wisdom)\b'),
    ('nature and creation', r'\b(heavens|earth|rain|night and day|the sun|the moon|stars|mountains|sea|plants|fruits|cattle)\b'),
    ('the hereafter', r'\b(hereafter|paradise|gardens beneath|resurrect\w*|the day of judgement|death|die)\b'),
    ('prayer', r'\b(prayer|prostrat\w*|bow\w*|remembrance|remember allah|glorif\w*|exalt\w*)\b'),
    ('dua', r'\b(our lord|my lord|invoke|supplicat\w*|call upon me|respond)\b'),
    ('trusting God', r'\b(rely|reliance|sufficient|disposer|trust upon|put (their|your) trust)\b'),
    ('humility', r'\b(humble|humility|humbly)\b'),
    ('speech', r'\b(speak|word\w*|say to|lie|lies|backbit\w*|ridicule)\b'),
    ('God being near', r'\b(near|close to (him|you)|with you wherever|knows what is within)\b'),
    ('the Quran', r'\b(the qur\'?an|this book|revelation|recite)\b'),
    ('faith', r'\b(believe[rs]?|faith|the righteous|righteousness|fear allah|taqwa|guided)\b'),
]

# Openings that hang on what came before.
DEPENDENT = re.compile(
    r'^\W*(and|so|then|but|or|thus|indeed,? we|when|until|except|nay|rather|he said|she said|they said|'
    r'say,? "|they will say|he will say|so when|and when|and if|and they|and he|and she|and we|'
    r'(\[?allah\]?|moses|pharaoh|noah|abraham|joseph|jesus|mary|they|he|she|those|these)\b.{0,12}\bsaid)',
    re.I,
)
# Subjects better kept out of a daily card.
AVOID = re.compile(r'\b(wrongdo\w*|evil|fight\w*|kill\w*|slay|slaughter|war|punishment|torment|hell\w*|fire|curse\w*|disbeliev\w*|hypocrit\w*|polythe\w*|idol\w*|usury|divorc\w*|menstrua\w*|thief|amputat\w*|flog\w*|booty|spoils|captives?|punish\w*|deities|partners?|associate\w*|claim\w*|private conversation|consultation)\b', re.I)

# Stories of earlier peoples, best met in their place rather than alone on a card.
STORY = re.compile(r"\b(pharaoh|thamud|aad|lot|midian|israel|noah|the people of|qarun|haman|samiri|the calf|the ship|moses|jews|christians|sabeans|hypocrites)\b", re.I)
# Openings that continue a description or a list from the ayah before.
CONTINUES = re.compile(r'^(to |for those who do not|knower|the one who|who |which |whom |those who|that is|o descendants|in gardens|on a day|the day|a day|on that day|reclining|and )', re.I)
# A question that argues rather than speaks: best in its place.
ARGUES = re.compile(r'^(say,|do (you|they|he) not|have (you|they) not|does (he|man)|is (he|it|there)|are (you|they)|had there|did (you|they)|or (do|have|is|are)|what is (the matter|wrong)|how (can|could|will))', re.I)
# Speaking to people: you, the believers, mankind.
TO_PEOPLE = re.compile(r'\b(you|your|believers|mankind|man|people|those who believe|the righteous|servants|whoever)\b', re.I)

surahs_ts = open(os.path.join(ROOT, 'src', 'data', 'surahs.ts'), encoding='utf-8').read()
counts = {int(m.group(1)): int(m.group(2)) for m in re.finditer(r'\{ id: (\d+), .*?totalVerses: (\d+)', surahs_ts)}
translations = json.load(open(os.path.join(RES, 'translation.json'), encoding='utf-8'))['ayahs']
words = {}
for page in json.load(open(os.path.join(RES, 'mushaf.json'), encoding='utf-8'))['pages']:
    for line in page:
        for w in line.get('w', []):
            if w[2] > 0:
                words[(w[0], w[1])] = words.get((w[0], w[1]), 0) + 1

out = []
i = 0
for s in range(1, 115):
    for a in range(1, counts[s] + 1):
        text = translations[i]
        i += 1
        n = words.get((s, a), 0)
        if not (5 <= n <= 26) or len(text) > 330:
            continue
        plain = re.sub(r'\[[^\]]*\]', '', text).strip()
        if DEPENDENT.search(plain) or AVOID.search(plain) or STORY.search(plain):
            continue
        # A whole thought: it starts a sentence, ends one, and isn't a line of dialogue.
        if text.lstrip().startswith(('[', '"', '(')) or not plain[:1].isupper():
            continue
        if not re.search(r'[.!?]\W*$', text) or text.count('"') % 2 == 1 or CONTINUES.search(plain):
            continue
        if ARGUES.search(plain) or not TO_PEOPLE.search(plain):
            continue
        if s == 1:
            continue  # Al-Fatihah is read every day already
        for theme, pattern in THEMES:
            if re.search(pattern, plain, re.I):
                out.append([s, a, theme])
                break

json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'ayahOfTheDay.json'), 'w'), separators=(',', ':'))
by = {}
for _, _, t in out:
    by[t] = by.get(t, 0) + 1
print(len(out), 'ayahs')
print(sorted(by.items(), key=lambda x: -x[1]))
