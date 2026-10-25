#!/usr/bin/env python3
"""Read-only extraction of Sony v8.931 HOME service-catalog evidence.

Requires owner-supplied, already-decrypted root.bin, 3rd2.bin, 3rdp.bin.
The script reports only file names and safe check results; no OEM content
is exported, no device access is required, and nothing is patched/flashed.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from squash_reader import Squash

ARM_ACCESS_CALL = (struct.pack('<I',0xe3040740)+struct.pack('<I',0xe3400002)
                   +struct.pack('<I',0xe3a01004)+struct.pack('<I',0xebffaad6))

FILES={
 'root':('basic/am_config','basic/am_start.ini','basic/keymap_tv.ini',
         'basic/DockUI.xml/DockUI.xml'),
 '3rd2':('cobalt/content/web/html5ui/allappsmodule.js',
         'cobalt/content/web/html5ui/homeuiapi.js',
         'cobalt/content/web/html5ui/service_list'),
 '3rdp':('sony/sony_dockui/launcher.bin',)
}

def scan(parts):
    data={};inode_info={};digest={}
    for part,files in FILES.items():
        src=Path(parts)/(part+'.bin')
        sq=Squash(src)
        try:
            for file in files:
                inode=sq.find_file(file)
                inode_info[(part,file)]=inode
                if inode['type'] in (2,9):
                    b=sq.extract_bytes(inode,max_size=400000)
                    data[(part,file)]=b
                    digest[(part,file)]=hashlib.sha256(b).hexdigest()
        finally:sq.close()
    r=lambda part,name:data[(part,name)]
    dock=r('3rdp','sony/sony_dockui/launcher.bin')
    cobalt=r('3rd2','cobalt/content/web/html5ui/allappsmodule.js')
    api=r('3rd2','cobalt/content/web/html5ui/homeuiapi.js')
    c=r('root','basic/am_config')
    config=r('root','basic/am_start.ini')
    symlink=inode_info[('3rd2','cobalt/content/web/html5ui/service_list')]
    checks={
      'sony_dockui_exec_in_app_man':b'/3rd/sony/sony_dockui/launcher.bin' in c,
      'cobalt_home_fixed_file_url':b'file:///html5ui/index.html' in config,
      'stock_home_service_list_symlink':symlink['type']==3 and symlink.get('target')=='/3rd_rw/service_list',
      'native_dockui_catalog_path':b'/3rd_rw/service_list/dockui' in dock,
      'binary_arm_elf':dock[:5]==b'\x7fELF\x01' and struct.unpack_from('<H',dock,18)[0]==40,
      'binary_checks_read_access':ARM_ACCESS_CALL in dock,
      'cobalt_reads_native_bivl_list':b'currentBivlList' in cobalt and b'JSON.parse' in cobalt,
      'cobalt_sorts_by_service_index':b'service_index' in cobalt and b'AppSort' in cobalt,
      'cobalt_uses_service_icon':b'icon_url' in cobalt,
      'sony_homeui_uses_launchapp':b'homeui.LaunchApp(JSON.stringify(arr))' in api,
      'sony_homeui_passes_registered_service_id':b"appName['service_id']" in api,
    }
    return {
      'target':'KD-55XG7096 / v8.931-1000',
      'method':'original owner OTA, read-only static analysis',
      'checks':checks,
      'passed':sum(checks.values()),'total':len(checks),
      'observed_service_fields':['service_name','service_id','service_type','service_index','icon_url','uri'],
      'critical_caveat':'Native launch requires actual registered service entry. /3rd_rw content and write access not in OTA.',
      'binary_access_note':'ARM sequence uses access(path,R_OK), not evidence of parsing the catalog file.',
      'home_replacement_verified':False,
      'catalog_write_verified':False,
      'flashable':False
    }

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--parts',type=Path,required=True)
    ap.add_argument('--output',type=Path)
    args=ap.parse_args()
    result=scan(args.parts)
    txt=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if args.output:args.output.write_text(txt,encoding='utf-8')
    print(txt,end='')
