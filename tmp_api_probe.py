import urllib.request
import urllib.error
import json

urls = ['https://DevNumb-MLYorkchillerOptimzer.hf.space', 'https://huggingface.co/spaces/DevNumb/MLYorkchillerOptimzer']
for url in urls:
    print('URL:', url)
    for path in ['/health', '/', '/predict']:
        full = url.rstrip('/') + path
        try:
            req = urllib.request.Request(full, method='GET')
            with urllib.request.urlopen(req, timeout=10) as r:
                body = r.read(5000).decode('utf-8', errors='replace')
                print('  GET', path, 'OK', r.status, body[:200].replace('\n', ' '))
        except Exception as e:
            print('  GET', path, 'ERR', repr(e))
    print()

sample = {'features': [1200, 18.6, 6.5, 90, 10, 5, 0, 1, 1, 0, 0, 2]}
formats = [
    ('array', sample),
    ('named', {
        'cooling_load': 1200,
        'wet_bulb_temp': 18.6,
        'chw_setpoint': 6.5,
        'current_limit': 90,
        'hour': 10,
        'month': 5,
        'weekend': 0,
        'chiller1': 1,
        'chiller2': 1,
        'chiller3': 0,
        'chiller4': 0,
        'total_chillers': 2,
    }),
    ('data', {'data': [[1200, 18.6, 6.5, 90, 10, 5, 0, 1, 1, 0, 0, 2]]}),
]
for fmt, payload in formats:
    print('POST format', fmt)
    try:
        req = urllib.request.Request(
            'https://DevNumb-MLYorkchillerOptimzer.hf.space/predict',
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read(1000).decode('utf-8', errors='replace')
            print('  OK', r.status, body[:400].replace('\n', ' '))
    except urllib.error.HTTPError as e:
        print('  HTTPERR', e.code, e.read(1000).decode('utf-8', errors='replace')[:400].replace('\n', ' '))
    except Exception as e:
        print('  ERR', repr(e))
