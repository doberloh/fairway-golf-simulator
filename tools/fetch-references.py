"""Pull reference photographs of coast redwood forest from Wikimedia Commons.

Run: python tools/fetch-references.py   (writes into a scratch refs/ folder)

These are REFERENCES, not assets. They stay in the scratchpad, never in the
repo, and nothing derived from them is a copy -- they are here to be measured
and looked at while building geometry from scratch.
"""
import json, os, re, subprocess, sys, time

OUT = os.environ.get('FAIRWAY_REFS') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'refs')
os.makedirs(OUT, exist_ok=True)
UA = 'FairwayAssetResearch/1.0 (local reference gathering; contact: local)'

QUERIES = [
    ('grove',      'Sequoia sempervirens forest'),
    ('grove',      'redwood forest old growth'),
    ('grove',      'Redwood National Park forest'),
    ('grove',      'Humboldt Redwoods State Park'),
    ('grove',      'Jedediah Smith Redwoods'),
    ('grove',      'Muir Woods'),
    ('grove',      'Armstrong Redwoods'),
    ('trunk',      'coast redwood trunk'),
    ('trunk',      'redwood bark'),
    ('trunk',      'Sequoia sempervirens bark'),
    ('trunk',      'redwood buttress base'),
    ('trunk',      'redwood burl'),
    ('canopy',     'redwood canopy'),
    ('canopy',     'coast redwood crown'),
    ('canopy',     'looking up redwood trees'),
    ('fir',        'Pseudotsuga menziesii forest'),
    ('fir',        'Douglas fir old growth'),
    ('hemlock',    'Tsuga heterophylla forest'),
    ('cedar',      'Thuja plicata forest'),
    ('cedar',      'western red cedar trunk'),
    ('understory', 'Polystichum munitum sword fern'),
    ('understory', 'Oxalis oregana redwood sorrel'),
    ('understory', 'redwood forest understory'),
    ('understory', 'Gaultheria shallon salal'),
    ('understory', 'temperate rainforest understory moss'),
    ('deadwood',   'nurse log forest'),
    ('deadwood',   'fallen redwood log'),
    ('deadwood',   'redwood stump'),
    ('deadwood',   'redwood snag'),
    ('deadwood',   'mossy log forest floor'),
    ('floor',      'redwood forest floor'),
    ('floor',      'conifer forest floor duff'),
    ('fog',        'redwood fog forest'),
    ('fog',        'coast redwood fog'),
]


# Categories, because search kept returning the same grove photographs and gave
# nothing at all for the understory, the deadwood or the forest floor -- which
# is most of what a grove actually looks like at eye level.
CATEGORIES = [
    ('understory', 'Polystichum munitum'), ('understory', 'Oxalis oregana'),
    ('understory', 'Gaultheria shallon'), ('understory', 'Vaccinium ovatum'),
    ('understory', 'Dryopteris expansa'),
    ('cedar', 'Thuja plicata'), ('hemlock', 'Tsuga heterophylla'),
    ('deadwood', 'Nurse logs'), ('deadwood', 'Tree stumps'),
]

OK_LICENCE = re.compile(r'cc0|public domain|cc by|cc-by|attribution', re.I)


def api(params):
    url = 'https://commons.wikimedia.org/w/api.php?' + '&'.join(f'{k}={v}' for k, v in params.items())
    out = subprocess.run(['curl', '-sS', '-m', '45', '-A', UA, url],
                         capture_output=True, text=True)
    try:
        return json.loads(out.stdout)
    except Exception:
        return {}


def quote(s):
    return s.replace(' ', '%20').replace('&', '%26')


manifest, seen = [], set()
for tag, q in QUERIES:
    data = api({
        'action': 'query', 'format': 'json', 'generator': 'search',
        'gsrsearch': quote(q), 'gsrnamespace': '6', 'gsrlimit': '12',
        'prop': 'imageinfo', 'iiprop': 'url%7Cextmetadata', 'iiurlwidth': '1000',
    })
    pages = data.get('query', {}).get('pages', {})
    for p in pages.values():
        ii = (p.get('imageinfo') or [{}])[0]
        thumb = ii.get('thumburl')
        title = p.get('title', '')
        if not thumb or title in seen:
            continue
        if not re.search(r'\.(jpe?g|png)$', title, re.I):
            continue
        meta = ii.get('extmetadata', {})
        lic = meta.get('LicenseShortName', {}).get('value', '')
        if not OK_LICENCE.search(lic):
            continue
        seen.add(title)
        manifest.append({
            'tag': tag, 'query': q, 'title': title, 'url': thumb,
            'licence': lic,
            'author': re.sub('<[^>]+>', '', meta.get('Artist', {}).get('value', ''))[:70],
            'page': ii.get('descriptionurl', ''),
        })
    print(f'{tag:11s} {q[:38]:40s} -> {len(manifest):3d} total', flush=True)
    time.sleep(0.2)

print(f'\n{len(manifest)} candidates')

got = 0
for i, m in enumerate(manifest):
    name = f"{m['tag']}_{i:03d}.jpg"
    path = os.path.join(OUT, name)
    m['file'] = name
    if os.path.exists(path) and os.path.getsize(path) > 20000:
        got += 1
        continue
    subprocess.run(['curl', '-sS', '-m', '60', '-A', UA, '-o', path, m['url']],
                   capture_output=True)
    if os.path.exists(path) and os.path.getsize(path) > 20000:
        with open(path, 'rb') as f:
            if f.read(2) == b'\xff\xd8':
                got += 1
                continue
    if os.path.exists(path):
        os.remove(path)
    m['file'] = None

manifest = [m for m in manifest if m.get('file')]
with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=1)
print(f'downloaded {got} images into {OUT}')
by = {}
for m in manifest:
    by[m['tag']] = by.get(m['tag'], 0) + 1
print('by subject:', by)
