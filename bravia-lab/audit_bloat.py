#!/usr/bin/env python3
"""Read-only, dependency-aware assessment of a verified Sony service inventory.

This script DOES NOT disable/remove anything or modify firmware.
Names alone never prove tracking.
"""
import argparse
import json
from pathlib import Path

CRITICAL = frozenset(('boot','kernel','drivers','tuner','channels','epg','settings',
'remote','audio','video','input','hdmi','cec','storage','network','drm',
'auth','ota','recovery','system','unknown'))
REVIEW = frozenset(('vendor-app','optional-telemetry','diagnostics','obsolete-app'))

def assess(items):
    if not isinstance(items,list):
        raise ValueError('inventory must be a list')
    by_name={}
    for item in items:
        if not isinstance(item,dict) or not isinstance(item.get('name'),str) or not item['name'].strip():
            raise ValueError('Each component must contain a nonempty name')
        n=item['name']
        if n in by_name:raise ValueError('Duplicate component: '+n)
        by_name[n]=item
    deps={n:set(x.get('depends_on') or ()) for n,x in by_name.items()}
    for n, ds in deps.items():
        if any(not isinstance(v,str) for v in ds):
            raise ValueError('depends_on must contain names only: '+n)
    reverse={n:[] for n in by_name}
    for n,ds in deps.items():
        for dep in ds:
            if dep in reverse:reverse[dep].append(n)
    result=[]
    for n,item in by_name.items():
        category=item.get('category','unknown')
        verified=item.get('evidence_verified') is True
        used_by=sorted(reverse[n])
        critical=item.get('required_for_tv') is True or category in CRITICAL
        if critical:
            status='KEEP';reason='Core/TV/unknown component protected'
        elif not verified:
            status='KEEP_PENDING_EVIDENCE';reason='Unverified independence / purpose'
        elif used_by:
            status='DEPENDENCY_REVIEW';reason='Used by: '+', '.join(used_by)
        elif category=='vendor-app':
            status='HIDE_UI_FIRST';reason='Hide icon first; check if it runs in background'
        elif category in REVIEW:
            status='REVIEW_DISABLE';reason='Requires measured impact, rollback and real TV regression tests'
        else:
            status='KEEP_PENDING_EVIDENCE';reason='Unrecognized category'
        result.append({'name':n,'category':category,'status':status,
          'cpu_percent_observed':item.get('cpu_percent_observed'),
          'rss_kib_observed':item.get('rss_kib_observed'),
          'dependents':used_by,'evidence':item.get('evidence',''),'reason':reason})
    return {'mode':'READ_ONLY_NO_CHANGES','component_count':len(result),'items':result,
      'warning':'Evidence and classification must be confirmed on the exact television; never auto-disable services.'}

def main(argv=None):
    p=argparse.ArgumentParser(description='Sony Linux service inventory classification; no writes to device')
    p.add_argument('inventory',type=Path);p.add_argument('--output',type=Path)
    x=p.parse_args(argv)
    raw=json.loads(x.inventory.read_text(encoding='utf-8'))
    result=json.dumps(assess(raw['components'] if isinstance(raw,dict) else raw),indent=2,ensure_ascii=False)+'\n'
    if x.output:
        x.output.parent.mkdir(parents=True,exist_ok=True)
        x.output.write_text(result,encoding='utf-8')
    print(result,end='')
    return 0
if __name__=='__main__':raise SystemExit(main())
