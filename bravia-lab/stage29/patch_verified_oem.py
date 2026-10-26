#!/usr/bin/env python3
"""Offline deterministic owner-OEM v8.931 HOME webapp resource patch.

Requires owner-extracted file trees; never modifies inputs, signs, flashes,
changes boot partitions or reaches a television. All ten tiles in Sony Cobalt
HOME, with original service ID routing when a unique native match exists.
"""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

PIN = {
    'index.html': '91245c702dcf0864b42f369a6d0695fd2baefeaf9110602111ed0b238c21bd78',
    'allappsmodule.js': 'f7d1e1b598b59a5b6a42bf78059da72ddf168099dbbda088d3d6eb6edb097210',
}
KEYMAP_PIN = 'b70f89e832d9ec8199d97c06aac757e0e01003030c7598b0486bdcc8c0af107f'
HOME_LOCATIONS = ('3rd2/cobalt/content/web/html5ui', '3rd2/cobalt/apps/html5ui/ui')
APP_NAMES = ('Кинопоиск','Иви','START','Netflix','YouTube','RUTUBE',
             'Media Station X','Al(co)pac','Браузер','КИОН')
SCRIPT_MARK = '<script type="text/javascript" src="allappsmodule.js"></script>'
ASSIGN = 'if (tmpApplication != undefined)\n                    tmpApp = removeDuplicate(tmpApplication);'
CALLS = (
    "HomeUIAPI.launchApp(tmpApp['data'][(appIndex - 1) * 2]);",
    "HomeUIAPI.launchApp(tmpApp['data'][((appIndex - 1) * 2) + 1]);",
    "HomeUIAPI.launchApp(tmpApp['data'][(appIndex - 1) * 1]);",
)

def sha(data): return hashlib.sha256(data).hexdigest()

def original_file(source, filename):
    p=source/filename
    if not p.is_file() or p.is_symlink(): raise ValueError('Original Sony file missing or symlink: '+str(p))
    data=p.read_bytes()
    if sha(data)!=PIN[filename]: raise ValueError('Unexpected Sony firmware resource: '+filename)
    return data.decode('utf-8')

def ensure_single(text, token):
    if text.count(token)!=1:raise ValueError('Invalid Sony HOME patch anchor: '+token[:80])
    return text

def transform(index, apps):
    ensure_single(index,SCRIPT_MARK)
    index=index.replace(SCRIPT_MARK,
             '<script type="text/javascript" src="bravia_catalog.js"></script>\n'+SCRIPT_MARK)
    ensure_single(apps,ASSIGN)
    apps=apps.replace(ASSIGN,
        'if (tmpApplication != undefined)\n'
        '                    tmpApp = BraviaCatalog.mapServices(removeDuplicate(tmpApplication));\n'
        '                else\n'
        '                    tmpApp = BraviaCatalog.mapServices({data:[]});')
    for call in CALLS:
        ensure_single(apps,call)
        apps=apps.replace(call,call.replace('HomeUIAPI.launchApp(', 'BraviaCatalog.launch('))
    return index,apps

def browser_config_check(root):
    config=root/'root/basic/am_start.ini'
    profile=root/'3rdp/internet_browser/apps/web_app/bws_profile.ini'
    if not config.is_file() or not profile.is_file():
        return {'browser_base_registers_web_app':None,'web_app_mouse_disabled':None,
                'source':'MISSING_READ_ONLY_INPUT'}
    txt=config.read_text(errors='replace')
    profiletext=profile.read_text(errors='replace')
    section=re.search(r'(?ms)^\[ browser_base \]\s*\n(.*?)(?=^\[ |\Z)',txt)
    mouse=re.search(r'(?ms)^\[MOUSE_MODE\]\s*\n(.*?)(?=^\[|\Z)',profiletext)
    return {
      'browser_base_registers_web_app': bool(section and re.search(r'(?m)^app\s*=\s*web_app\s*$',section.group(1))),
      'web_app_mouse_disabled':bool(mouse and re.search(r'(?m)^enablemouse\s*=\s*0\s*$',mouse.group(1))),
      'browser_profile_modified':False,
      'browser_base_modified':False,
    }

def reroute_home(original_root, output):
    """Redirect only three OEM ROOT_MENU key routes to already-registered html5ui."""
    config=original_root/'root/basic/am_start.ini'
    keymap=original_root/'root/basic/keymap_tv.ini'
    if not config.is_file() or not keymap.is_file() or keymap.is_symlink():
        raise ValueError('Exact Sony root app registry and keymap required')
    if sha(keymap.read_bytes()) != KEYMAP_PIN:
        raise ValueError('Unexpected Sony keymap; refusing HOME key redirection')
    start=config.read_text(errors='replace')
    section=re.search(r'(?ms)^\[ html5ui \]\s*\n(.*?)(?=^\[ |\Z)',start)
    if not section or 'app  = html5ui' not in section.group(1) or 'file:///html5ui/index.html' not in section.group(1):
        raise ValueError('Sony html5ui executable is not confirmed registered; no redirect')
    original=keymap.read_text(encoding='utf-8')
    needle='ROOT_MENU=dockui(stop)[start]'
    if original.count(needle)!=3:
        raise ValueError('Sony original ROOT_MENU count differed from known firmware')
    modified=original.replace(needle,'ROOT_MENU=html5ui(stop)[start]')
    dest=output/'root/basic/keymap_tv.ini'
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(modified,encoding='utf-8')
    return {'file':'root/basic/keymap_tv.ini','original_sha256':KEYMAP_PIN,
            'modified_sha256':sha(modified.encode('utf-8')),
            'modified_home_routes':3,'other_keymap_rules_modified':False,
            'real_home_handoff_tested_on_hardware':False}

def build(root, output, authored, route_home=True):
    root=Path(root);output=Path(output);authored=Path(authored)
    if output.exists():raise ValueError('Output already exists; original inputs are never overwritten')
    source_candidates=[root/x for x in HOME_LOCATIONS]
    present=[(location,x) for location,x in zip(HOME_LOCATIONS,source_candidates) if x.is_dir()]
    if not present:raise ValueError('No extracted Sony HTML5UI original directories were supplied')
    originals=[]
    for location, src in present:
        originals.append((location,*transform(original_file(src,'index.html'),
                                               original_file(src,'allappsmodule.js'))))
    # In standalone ZIP: authored is the ZIP root. In GitHub: stage29/ itself.
    assetroot=authored if (authored/'client/rutube').is_dir() else authored/'stage29'
    catalog=assetroot/'bravia_catalog.js'
    if not catalog.is_file():
        catalog=assetroot/'stage29/bravia_catalog.js'
    client=assetroot/'client/rutube'
    icons=assetroot/'icons'
    needed=('index.html','style.css','remote.js','rutube_player.js','catalog_api.js','hls_fallback.js','app.js')
    if not catalog.is_file() or not icons.is_dir() or not all((client/x).is_file() for x in needed):
        raise ValueError('Stage29 authored catalog/assets/client not found')
    route_info=None
    if route_home:
        # Verify the original keymap and registered Cobalt service before any outputs.
        route_info=reroute_home(root,output)
    modified=[]
    # Cobalt has two original HTML5UI resource paths; patch both when present.
    for location,index,apps in originals:
        target=output/location
        target.mkdir(parents=True,exist_ok=True)
        for name,text in (('index.html',index),('allappsmodule.js',apps)):
            (target/name).write_text(text,encoding='utf-8')
            modified.append({'location':location+'/'+name,'sha256':sha(text.encode('utf-8'))})
        shutil.copyfile(catalog,target/'bravia_catalog.js')
        (target/'bravia_assets').mkdir()
        for ico in sorted(icons.glob('*.png')):shutil.copyfile(ico,target/'bravia_assets'/ico.name)
        loc=target/'bravia_clients/rutube';loc.mkdir(parents=True)
        for name in needed:shutil.copyfile(client/name,loc/name)
    rpt={
      'device':'Sony KD-55XG7096','oem_family':'8.931-1000','kind':'OFFLINE_OWNER_RESOURCE_PATCH_ONLY',
      'patched_own_home_copies':[x[0] for x in originals],
      'modified_vendor_file_hashes':modified,
      'root_menu_reroute':route_info,
      'ten_requested_apps':list(APP_NAMES),
      'works_without_bivl_list_on_mock':True,
      'browser_profile_original':browser_config_check(root),
      'home_launcher_in_use_on_physical_tv':'UNKNOWN',
      'regional_service_registration_changed':False,
      'home_keymap_changed_offline':bool(route_info),
      'stock_channels_medias_settings_modified':False,
      'oem_app_man_or_dtv_modified':False,
      'oem_region_catalog_source_fully_identified':False,
      'launch_via_native_sony_web_app_profile_proven':False,
      'embedded_rutube_playback_on_tv_proven':False,
      'sony_signed_and_verity_valid':False,
      'installable_sony_usb_update':False,
      'recovery_method_verified':False,
    }
    (output/'PATCH_REPORT.json').write_text(json.dumps(rpt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return rpt

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oem-files',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    p.add_argument('--authored',default=Path(__file__).resolve().parents[1],type=Path)
    p.add_argument('--no-route-home',action='store_true',help='Patch Cobalt catalog without rewriting ROOT_MENU keymap')
    a=p.parse_args()
    print(json.dumps(build(a.oem_files,a.output,a.authored,route_home=not a.no_route_home),ensure_ascii=False,indent=2))
