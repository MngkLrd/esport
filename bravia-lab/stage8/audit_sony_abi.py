#!/usr/bin/env python3
"""Sony v8.931 ABI read-only auditor. Requires owner-extracted OEM binaries.
Reports metadata, never firmware bytes. No system/device writes.
"""
import argparse,json,re,subprocess
from pathlib import Path
EXPORTS=('am_client_init','am_client_uninit','am_started','am_stopped',
 'am_send_cmd','am_send_cmd_to_remote','am_send_raw_cmd',
 'am_get_focus_process_name','am_get_process_name')
IMPORTS=('am_client_init','am_client_uninit','am_started','am_stopped',
 'am_paused','am_resumed','am_shutdowned','am_wakeuped','am_suspended')
def run(*args):
 return subprocess.run(args,check=True,text=True,capture_output=True,timeout=15).stdout
def examine(lib,dockui,arm_object=None):
 lib=str(lib);dockui=str(dockui)
 lh=run('readelf','-h',lib);dh=run('readelf','-h',dockui)
 la=run('readelf','-A',lib);da=run('readelf','-A',dockui)
 ls=run('readelf','-W','--dyn-syms',lib)
 ds=run('readelf','-W','--dyn-syms',dockui)
 ld=run('readelf','-l',dockui)
 ai=run('llvm-objdump','-d','--arch=arm','--start-address=0x3394',
        '--stop-address=0x3400',lib)
 ac=run('llvm-objdump','-d','--arch=arm','--start-address=0xa08c',
        '--stop-address=0xa148',dockui)
 def named(table,name,exported):
  rows=[row for row in table.splitlines() if re.search(
    r'\b'+re.escape(name)+r'(?:@|$)',row)]
  return any((' UND ' not in row) if exported else (' UND ' in row)
             for row in rows)
 offsets=('-0x44','-0x40','-0x3c','-0x38','-0x34','-0x30','-0x2c')
 checks={
 'lib_is_arm32_shared':'ELF32' in lh and 'ARM' in lh and 'DYN' in lh,
 'dockui_is_arm32_executable':'ELF32' in dh and 'ARM' in dh and 'EXEC' in dh,
 'dockui_interpreter':'/lib/ld-linux.so.3' in ld,
 'lib_arch_armv7a':'Tag_CPU_arch: v7' in la,
 'dockui_arch_armv7a':'Tag_CPU_arch: v7' in da,
 'lib_vfpv4':'Tag_FP_arch: VFPv4' in la,
 'lib_exports':all(named(ls,n,True) for n in EXPORTS),
 'dockui_imports':all(named(ds,n,False) for n in IMPORTS),
 'init_takes_pointer_r0':'str\tr0, [r11, #-0x18]' in ai,
 'init_name_offset_36':'add\tr3, r3, #36' in ai,
 'dockui_zeroes_60_bytes':'mov\tr2, #60' in ac,
 'dockui_seven_callbacks':all(
   re.search(r'str\tr3, \[r11, #'+re.escape(o)+r'\]',ac)
   for o in offsets),
 'dockui_init_plt':'bl\t0x9298' in ac and 'am_client_init' in ds
 }
 if arm_object:
  h=run('readelf','-h',str(arm_object))
  syms=run('readelf','-W','-s',str(arm_object))
  unknown=[s for s in syms.splitlines() if re.search(r'\bUND\b',s)
           and not re.search(r'\bLOCAL\b',s)]
  checks['arm_core_reloc_32_eabi5']=all(s in h for s in
    ('ELF32','ARM','Version5 EABI','REL ('))
  checks['arm_core_no_external_imports']=len(unknown)==0
 result={
 'source':'OWNER_ORIGINAL_SONY_OTA_READ_ONLY',
 'checks':checks,'passed':sum(checks.values()),'total':len(checks),
 'registration_record':{'bytes':60,'name_offset':36,
  'callbacks_set':7,'callback_prototypes_known':False,
  'safe_to_invoke_am_client_init':False},
 'exported_functions':list(EXPORTS),
 'dockui_imported_functions':list(IMPORTS),
 'flashable':False}
 return result
if __name__=='__main__':
 p=argparse.ArgumentParser()
 p.add_argument('--lib',required=True)
 p.add_argument('--dockui',required=True)
 p.add_argument('--arm-object')
 p.add_argument('--out')
 x=p.parse_args();result=examine(x.lib,x.dockui,x.arm_object)
 doc=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
 if x.out:Path(x.out).write_text(doc,encoding='utf8')
 print(doc,end='')
 raise SystemExit(0 if result['passed']==result['total'] else 1)
