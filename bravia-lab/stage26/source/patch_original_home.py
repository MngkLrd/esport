#!/usr/bin/env python3
"""Offline, exact-version overlay for ORIGINAL Cobalt HTML5UI (NOT an OTA installer).
Copies exactly two modified Sony files to PRIVATE output, plus our own JS/assets.
The OEM originals must be owner-extracted; no OEM bytes enter our distributed ZIP.
"""
import argparse, hashlib, json, shutil
from pathlib import Path

# SHA pins are for the user-supplied actual 8.931 OEM filesystem resources.
PINS_FILE = Path(__file__).with_name('oem_home_pins.json')
INSERT_MARK='<script type="text/javascript" src="allappsmodule.js"></script>'
SOURCE_ASSIGN='tmpApp = removeDuplicate(tmpApplication);'
LAUNCH_CALLS=(
 "HomeUIAPI.launchApp(tmpApp['data'][(appIndex - 1) * 2]);",
 "HomeUIAPI.launchApp(tmpApp['data'][((appIndex - 1) * 2) + 1]);",
 "HomeUIAPI.launchApp(tmpApp['data'][(appIndex - 1) * 1]);",
)

def checked(root, fname):
    path=Path(root)/fname
    if not path.is_file() or path.is_symlink():raise ValueError('Missing original Sony file: '+fname)
    data=path.read_bytes()
    pins=json.loads(PINS_FILE.read_text(encoding='utf-8'))
    if hashlib.sha256(data).hexdigest()!=pins[fname]:raise ValueError('Sony OEM resource hash mismatch: '+fname)
    return data.decode('utf-8')

def build(original, destination, own):
    original,destination,own=map(Path,(original,destination,own))
    if not own.is_dir() or not (own/'bravia_catalog.js').is_file():raise ValueError('Authored files missing')
    if destination.exists():raise ValueError('Refusing to overwrite an existing destination')
    if original.resolve()==destination.resolve():raise ValueError('Destination must be separate from factory files')
    index=checked(original,'index.html');apps=checked(original,'allappsmodule.js')
    if index.count(INSERT_MARK)!=1 or apps.count(SOURCE_ASSIGN)!=1:
        raise ValueError('Unknown Sony HOME version/anchor')
    index=index.replace(INSERT_MARK,
        '<script type="text/javascript" src="bravia_catalog.js"></script>\n'+INSERT_MARK)
    apps=apps.replace(SOURCE_ASSIGN,'tmpApp = BraviaCatalog.mapServices(removeDuplicate(tmpApplication));')
    for call in LAUNCH_CALLS:
        if apps.count(call)!=1:raise ValueError('Unknown Sony HOME launch anchor: '+call)
        apps=apps.replace(call,call.replace('HomeUIAPI.launchApp(', 'BraviaCatalog.launch('))
    destination.mkdir(parents=True)
    (destination/'index.html').write_text(index,encoding='utf-8')
    (destination/'allappsmodule.js').write_text(apps,encoding='utf-8')
    shutil.copy2(own/'bravia_catalog.js',destination/'bravia_catalog.js')
    assetdir=own.parent/'assets'
    if assetdir.is_dir():
        (destination/'bravia_assets').mkdir()
        for p in assetdir.glob('*.png'):shutil.copy2(p,destination/'bravia_assets'/p.name)
    result={
      'status':'OEM_HOME_RESOURCE_OVERLAY_FOR_OFFLINE_BENCH_ONLY',
      'source_version':'Sony HTML5UI 2.0.32.27052021',
      'patched_files':['index.html','allappsmodule.js'],
      'added_files':['bravia_catalog.js']+sorted('bravia_assets/'+p.name for p in assetdir.glob('*.png')),
      'stock_channels_untouched':True,'stock_media_untouched':True,
      'stock_settings_untouched':True,'oem_binary_modified':False,
      'sony_signature_preserved':False,'sony_usb_installable':False
    }
    (destination/'PATCH_MANIFEST.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--original-html5ui',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    p.add_argument('--authored',type=Path,default=Path(__file__).resolve().parent)
    args=p.parse_args()
    print(json.dumps(build(args.original_html5ui,args.output,args.authored),ensure_ascii=False,indent=2))
