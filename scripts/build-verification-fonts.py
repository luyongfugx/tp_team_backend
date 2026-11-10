#!/usr/bin/env python3
"""Refresh self-hosted, OFL-licensed report UI font subsets after catalog edits.

Only reviewed public UI text is sent to Google Fonts; never send photo metadata.
The generated files are served locally at runtime (no Google Fonts requests).
"""
import urllib.request,urllib.parse,json,re,base64
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'public/fonts/verification';out.mkdir(parents=True,exist_ok=True)
data=json.loads((root/'lib/photoShareTranslations.generated.json').read_text())
ua='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
for family,stem,locales,licensepath in [('Noto Sans SC','noto-sans-sc',['zh-Hans'],'notosanssc'),('Noto Sans TC','noto-sans-tc',['zh-Hant','zh-HK'],'notosanstc'),('Noto Sans Arabic','noto-sans-arabic',['ar','arz','fa','ur','ps'],'notosansarabic')]:
 chars=''.join(sorted(set(''.join(str(v) for k in locales if k in data for v in data[k].values()))))
 assert chars
 url='https://fonts.googleapis.com/css2?'+urllib.parse.urlencode({'family':family+':wght@100..900','text':chars,'display':'swap'})
 css=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':ua}),timeout=30).read().decode();urls=re.findall(r'url\((https[^)]+)\)',css)
 assert len(set(urls))==1
 font=urllib.request.urlopen(urls[0],timeout=30).read();assert font[:4]==b'wOF2';(out/(stem+'.woff2')).write_bytes(font)
 license=json.loads(urllib.request.urlopen('https://api.github.com/repos/google/fonts/contents/ofl/'+licensepath+'/OFL.txt',timeout=30).read());(out/(stem+'-OFL.txt')).write_bytes(base64.b64decode(license['content']))
 (out/(stem+'-source.json')).write_text(json.dumps({'family':family,'source':'https://fonts.google.com/specimen/'+family.replace(' ','+'),'licenseSource':license['html_url'],'locales':locales,'characters':chars,'weights':'100..900','size':len(font)},ensure_ascii=False,indent=2)+'\n')
 print(family,len(chars),len(font),flush=True)
