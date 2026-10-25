#!/usr/bin/env python3
"""Read-only rootfs inventory for embedded Linux television firmware.

Input: previously unpacked firmware filesystem. No writes to that tree,
no flash, no service disabling and no automatic 'tracker' verdicts.
"""
import argparse
import configparser
import json
import os
import re
from pathlib import Path
from urllib.parse import urlsplit

MAX_FILES = 300000
MAX_TEXT = 1024 * 1024
TEXT_SUFFIXES = {'.xml','.json','.js','.html','.htm','.cfg','.conf','.ini',
 '.service','.sh','.txt','.properties','.lua','.desktop','.url'}
SERVICES = ('etc/init.d/', 'etc/init/', 'etc/systemd/system/',
            'lib/systemd/system/', 'usr/lib/systemd/system/')
SITE_WORDS = re.compile(r'(?i)vewd|opera[ -]?tv|berliner|netflix|youtube|application|launcher|widget|applicast|catalog|msx')
DOMAINS = re.compile(r'(?i)https?://[^\s<>\"\'\`]{1,255}')
ABS_PATHS = re.compile(r'(?<![\w/])/(?:usr/)?(?:s?bin|opt|etc|lib|var)/[\w+./-]{2,200}')
UNIT_DEPENDENCIES = ('Requires','Wants','After','BindsTo')


def safe_text(path):
    try:
        if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_TEXT:
            return None
        raw=path.read_bytes()
        if b'\x00' in raw[:2048]:return None
        return raw.decode('utf-8',errors='replace')
    except (OSError,ValueError):
        return None


def normalize_path(path,root):
    try:return path.relative_to(root).as_posix()
    except ValueError:return str(path)


def unit_details(text):
    """Conservatively extract explicit unit configuration, no guessed dependencies."""
    ini=configparser.ConfigParser(interpolation=None,strict=False)
    ini.optionxform=str
    try:ini.read_string(text)
    except configparser.Error:return {'exec':[],'dependencies':[]}
    cmds=[]; deps=[]
    for sec in ini.sections():
        for key,val in ini.items(sec):
            if key in ('ExecStart','ExecStartPre','ExecStartPost','ExecReload'):
                cmds.extend([x.strip()[:240] for x in val.splitlines() if x.strip()])
            if key in UNIT_DEPENDENCIES:deps.extend(x.strip() for x in val.split() if x.strip())
    return {'exec':cmds[:30], 'dependencies':sorted(set(deps))[:100]}


def init_details(text):
    cmds=[]
    for line in text.splitlines():
        val=line.strip()
        if len(val)>600 or not val or val.startswith('#'):continue
        if re.search(r'(?i)\b(start-stop-daemon|exec|daemon|service|insmod|modprobe)\b',val):
            cmds.append(val[:240])
    return {'exec':cmds[:35],'dependencies':[]}


def domain_host(url):
    try:
        host=urlsplit(url.rstrip(',.);')).hostname
        if not host or len(host)>150 or not re.fullmatch(r'[a-zA-Z0-9.\-]+',host):return None
        return host.lower()
    except ValueError:return None


def catalog_candidate(rel,text):
    r=rel.lower()
    return SITE_WORDS.search(text[:MAX_TEXT]) and (
        any(x in r for x in ('app','widget','catalog','launcher','web','portal','vewd','opera')) or
        any(x in text.lower() for x in ('berliner','vewd','opera tv','widget')))


def inspect_rootfs(root,max_files=MAX_FILES,max_hits=300,max_domains=300):
    root=Path(root).resolve()
    if not root.is_dir():raise ValueError('Expected previously extracted directory')
    components=[]; seen=set(); catalogs=[]; domains={}; skipped=0; count=0; exceeds=False; symlinks=0
    startup=[]
    for current,dirs,files in os.walk(root,followlinks=False):
        dirs[:]=sorted(x for x in dirs if not (Path(current)/x).is_symlink())
        for name in sorted(files):
            p=Path(current)/name
            count+=1
            if count>max_files:exceeds=True;break
            rel=normalize_path(p,root)
            if p.is_symlink():
                symlinks+=1
                if re.match(r'etc/rc\d?\.d/S\d+',rel):
                    try:target=os.readlink(p)
                    except OSError:target='unreadable'
                    startup.append({'path':rel,'symlink_target':target,'note':'Not resolved or executed'})
                continue
            is_service=rel.startswith(SERVICES) and (rel.endswith('.service') or rel.startswith('etc/init.d/') or rel.endswith('.conf'))
            is_startup=rel=='etc/inittab' or bool(re.match(r'etc/rc\d?\.d/S\d+',rel))
            is_text=rel.endswith(tuple(TEXT_SUFFIXES)) or is_service or is_startup
            if not is_text:continue
            content=safe_text(p)
            if content is None:skipped+=1;continue
            if is_service and rel not in seen:
                seen.add(rel)
                details=unit_details(content) if rel.endswith('.service') else init_details(content)
                components.append({
                  'name':rel,'category':'unknown','required_for_tv':False,
                  'evidence_verified':False,'depends_on':[],
                  'startup_commands':details['exec'],
                  'unit_dependencies':details['dependencies'],
                  'evidence':'Static service file: '+rel,
                  'cpu_percent_observed':None,'rss_kib_observed':None})
            if is_startup:startup.append({'path':rel,'entries':[x.strip()[:200] for x in content.splitlines() if x.strip() and not x.strip().startswith('#')][:35]})
            if len(catalogs)<max_hits and catalog_candidate(rel,content):
                matches=[]
                for idx,line in enumerate(content.splitlines(),1):
                    if SITE_WORDS.search(line):
                        matches.append({'line':idx,'snippet':line.strip()[:240]})
                    if len(matches)>=6:break
                if matches:catalogs.append({'path':rel,'matches':matches})
            if len(domains)<max_domains:
                for m in DOMAINS.finditer(content):
                    host=domain_host(m.group(0))
                    if host:
                        record=domains.setdefault(host, {'host':host,'locations':[],'classification':'UNCLASSIFIED - NOT PROOF OF TRACKING'})
                        if len(record['locations'])<6:record['locations'].append(rel)
        if exceeds:break
    component_by_basename={Path(x['name']).name:x['name'] for x in components}
    for item in components:
        item['depends_on']=sorted(set(component_by_basename[d] for d in item['unit_dependencies'] if d in component_by_basename and component_by_basename[d]!=item['name']))
    return {
      'mode':'READ_ONLY_STATIC_ONLY','root':str(root),'files_seen':min(count,max_files),
      'files_limit_reached':exceeds,'symlink_files_skipped':symlinks,'text_files_skipped':skipped,
      'components':components,'startup_entries':startup[:max_hits],
      'webapp_catalog_candidates':catalogs,'domains':list(domains.values()),
      'assessment_warning':'No service is safe to remove based on this scan alone. Any URLs are unclassified. Run dependency/CPU/RAM verification on your exact TV.'}


def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('rootfs',type=Path)
    ap.add_argument('--output',type=Path)
    a=ap.parse_args(argv)
    result=inspect_rootfs(a.rootfs)
    data=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if a.output:
        a.output.parent.mkdir(parents=True,exist_ok=True)
        a.output.write_text(data,encoding='utf-8')
    print(data)
    return 0

if __name__=='__main__':raise SystemExit(main())
