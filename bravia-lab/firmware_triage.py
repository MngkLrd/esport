#!/usr/bin/env python3
"""Official Sony archive triage. Read-only, no USB-flashable output."""
import argparse
import hashlib
import json
import math
import re
import zipfile
from pathlib import Path
from firmware_lab import inspect_file,inspect_zip,magic

MAX_ENTRIES=5000
MAX_COMPRESSED=512*1024*1024
MAX_TOTAL_UNCOMPRESSED=1024*1024*1024
MAX_MEMBER_UNCOMPRESSED=512*1024*1024
SONY_8931='sony_tvupdate_2017_8931_eff_auth.zip'
EXPECTED_SIZE_8931=289426738

def sample_entropy(data):
    if not data:return 0.
    counts=[0]*256
    for byte in data:counts[byte]+=1
    n=len(data)
    return round(-sum((v/n)*math.log2(v/n) for v in counts if v),4)


def assess_package(path):
    path=Path(path)
    outer=inspect_file(path)
    out={'mode':'READ_ONLY_NO_DEVICE_ACCESS','file':outer,'zip':None,'members':[],
         'signature_verified':False,'safe_to_flash':False,'source_file_present':True,
         'warnings':[]}
    if path.name==SONY_8931 and path.stat().st_size!=EXPECTED_SIZE_8931:
        out['warnings'].append('Official v8.931 filename, but file size differs from Sony documentation')
    if not zipfile.is_zipfile(path):
        out['warnings'].append('Input is not a ZIP; no further package parsing')
        return out
    meta=inspect_zip(path,max_entries=MAX_ENTRIES)
    out['zip']={'entry_count':meta['entry_count'],'warnings':meta['warnings']}
    with zipfile.ZipFile(path) as archive:
        infos=archive.infolist()
        total=sum(i.file_size for i in infos)
        if len(infos)>MAX_ENTRIES or total>MAX_TOTAL_UNCOMPRESSED:
            out['warnings'].append('Archive member count/expanded size exceeds passive-analysis limits')
            return out
        for item in infos:
            if item.is_dir():continue
            rel=next((m for m in meta['members'] if m['name']==item.filename),None)
            if rel and rel['unsafe_path']:
                out['warnings'].append('Unsafe member path: '+item.filename)
                continue
            if item.file_size>MAX_MEMBER_UNCOMPRESSED or item.compress_size>MAX_COMPRESSED:
                out['warnings'].append('Oversized archive member not opened: '+item.filename)
                continue
            if item.flag_bits & 1:
                out['members'].append({'name':item.filename,'size':item.file_size,'encrypted':True})
                continue
            with archive.open(item) as fp:head=fp.read(16384)
            out['members'].append({'name':item.filename,'size':item.file_size,
                                   'magic':magic(head),'entropy_sample_bits_per_byte':sample_entropy(head),
                                   'header_hex_16':head[:16].hex()})
    out['warnings'].append('Structural inspection is NOT signature validation or compatibility proof')
    return out


def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('archive',type=Path)
    ap.add_argument('--output',type=Path)
    a=ap.parse_args(argv)
    if not a.archive.is_file():ap.error('Input file not found')
    r=assess_package(a.archive)
    text=json.dumps(r,indent=2,ensure_ascii=False)+'\n'
    if a.output:
        a.output.parent.mkdir(parents=True,exist_ok=True)
        a.output.write_text(text,encoding='utf-8')
    print(text)
    return 0

if __name__=='__main__':raise SystemExit(main())
