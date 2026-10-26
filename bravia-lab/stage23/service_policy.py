#!/usr/bin/env python3
"""Read-only OEM service de-bloat assessment. Never writes to a television."""
import argparse
import json
import re
from pathlib import Path
APPS=("Кинопоиск","Иви","START","Netflix","YouTube","RUTUBE",
      "Media Station X","Al(co)pac","Браузер","КИОН")
REQUIRED=("dtv_svc","dtv_app_mtk","sony_dockui","app_man","browser_base",
          "cobalt","libapp_client","directfb","drm","tuner","hdmi","epg",
          "guide","volume","network","settings","ota","usb_media")
REVIEW=("samba","cidclient","mixpanel","globoplay","amazon","vudu","wasu",
        "opera_tv_store","crashreport","diagnostic")
HIDE=("Prime Video","Okko","Netflix","YouTube","ivi","START","Мегафон",
      "Берлинская филармония","Радио","Часы","Записи")

def safe_text(root, relative):
    file=Path(root)/relative
    if not file.is_file() or file.is_symlink():return None
    if file.stat().st_size>1048576:raise ValueError("OEM source config oversized")
    return file.read_text(encoding="utf-8",errors="replace")

def audit(root=None):
    names={"am_config":"basic/am_config",
           "am_start.ini":"basic/am_start.ini",
           "DockUI.xml":"basic/DockUI.xml/DockUI.xml"}
    files={}
    for key,rel in names.items():
        files[key]=safe_text(root,rel) if root is not None else None
    content="\n".join(v for v in files.values() if v is not None).lower()
    return {
      "mode":"READ_ONLY_STATIC_INVENTORY",
      "running_telemetry_or_cpu_verified":False,
      "on_device_sony_services_disabled":False,
      "sources_available":{k:v is not None for k,v in files.items()},
      "new_home_application_labels":APPS,
      "old_home_tiles_to_hide":HIDE,
      "keep_without_removal":REQUIRED,
      "optional_candidates_review_only":{
        name:{"static_config_reference":bool(re.search(
                  r"(?<![\w])"+re.escape(name)+r"(?![\w])",content)),
              "run_state":"UNKNOWN","disable_now":False,
              "cpu_savings_proven":False,
              "dependencies_proven_separable":False} for name in REVIEW
      },
      "privacy":"Stock Samba Interactive TV opt-out if activated; original enabled=false is only OEM default",
      "next_measurement":"Live idle process CPU RSS and egress destinations on authorized test hardware",
      "writes_or_flashes":False
    }

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--extracted-root",type=Path)
    p.add_argument("--json",type=Path)
    args=p.parse_args()
    report=json.dumps(audit(args.extracted_root),ensure_ascii=False,indent=2)+"\n"
    if args.json:
        args.json.parent.mkdir(parents=True,exist_ok=True)
        args.json.write_text(report,encoding="utf-8")
    print(report,end="")
if __name__=="__main__":main()
