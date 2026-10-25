#!/usr/bin/env python3
"""Read-only Sony 8.931 IPC machine-code auditor. No TV I/O or firmware writes."""
import argparse,hashlib,json,re,subprocess
from pathlib import Path
DIGESTS={
 'lib':'bbe9eb3d74c8e793b5d93e0a96edbb4d1e89fe8b3e259791c95b5836c3eb8636',
 'dock':'1c29e9f4175e825500b57874b37c5257fd8ce162b53ca061cc43a47e8c579480',
 'manager':'29fca75522ccd66abba528b8622ccda944e6b15455dd812c1f2036d710c14702'
}
def run(*cmd):
 return subprocess.run(cmd,text=True,capture_output=True,check=True,timeout=15).stdout
def verify(p,key):
 path=Path(p)
 with path.open('rb') as f: digest=hashlib.file_digest(f,'sha256').hexdigest()
 if digest!=DIGESTS[key]:raise ValueError('Wrong Sony build for '+key+': SHA256 mismatch')
 return path
def arm(p,begin,end):
 return run('llvm-objdump','-d','--arch=arm',f'--start-address={begin}',f'--stop-address={end}',str(p))
def audit(library,dockui,manager):
 lib=verify(library,'lib');verify(dockui,'dock');verify(manager,'manager')
 helper=arm(lib,0x1d20,0x1e58)
 dispatcher=arm(lib,0x1e58,0x2484)
 worker=arm(lib,0x25b0,0x3010)
 syms=run('readelf','-W','-r',str(lib))
 checkpoints={
  'exact_owner_binary_digests':True,
  'read_127_bytes':bool(re.search(r'1d74:.*mov\s+r2, #127',helper)),
  'read_plt_1308':bool(re.search(r'1d78:.*bl\s+0x1308',helper)),
  'relay_strlen':bool(re.search(r'1dd0:.*bl\s+0x13b0',helper)),
  'relay_write_to_second_fd':bool(re.search(r'1de8:.*bl\s+0x1410',helper)),
  'relay_close_second_fd':bool(re.search(r'1df0:.*bl\s+0x12c0',helper)),
  'relay_receive_path_one':bool(re.search(r'2ddc:.*bl\s+0x1d20',worker)),
  'relay_receive_path_two':bool(re.search(r'2ec0:.*bl\s+0x1d20',worker)),
  'read_relay_passes_three_words':all(re.search(x,worker) for x in (
     r'2dd0:.*mov\s+r0, r1',r'2dd4:.*mov\s+r1, r2',r'2dd8:.*mov\s+r2, r3',
     r'2eb4:.*mov\s+r0, r1',r'2eb8:.*mov\s+r1, r2',r'2ebc:.*mov\s+r2, r3')),
  'event_parser_separate_from_relay':bool(re.search(r'28a0:.*bl\s+0x1e58',worker))
                            and re.search(r'28c4:.*bl\s+0x1e58',worker)),
  'event_comparison_strncmp20':len(re.findall(r'mov\s+r2, #20',dispatcher))>=10,
  'event_strncmp_plt_1488':len(re.findall(r'bl\s+0x1488',dispatcher))>=10,
  'ordinary_callback_zeroes_r2':len(re.findall(r'mov\s+r2, #0',dispatcher))>=8,
  'ordinary_callback_forwards_r0_r1':len(re.findall(r'ldr\s+r0, \[r11, #-0x8\]',dispatcher))>=8
                  and len(re.findall(r'ldr\s+r1, \[r11, #-0xc\]',dispatcher))>=8,
  'generic_callback_forwards_r2':bool(re.search(r'2460:.*ldr\s+r2, \[r11, #-0x10\]',dispatcher))
                  and re.search(r'2464:.*blx\s+r3',dispatcher)),
  'special_56_offset_callback':bool(re.search(r'22e0:.*ldr\s+r3, \[r3, #0x38\]',dispatcher))
                  and re.search(r'2308:.*blx\s+r3',dispatcher)),
  'native_read_symbol':'read@GLIBC_2.4' in syms,
  'native_write_symbol':'write@GLIBC_2.4' in syms,
  'native_strncmp_symbol':'strncmp@GLIBC_2.4' in syms,
  'real_dockui_registration_60bytes':bool(re.search(r'a0ac:.*mov\s+r2, #60',arm(dockui,0xa088,0xa148)))
 }
 return {
 'firmware':'Sony v8.931-1000',
 'primary':'Original owner-supplied ELF, SHA256-pinned',
 'checks':checkpoints,'passed':sum(checkpoints.values()),'total':len(checkpoints),
 'receiver':'0x1d20 reads <=127 bytes and relays data; separate from the event decoder',
 'dispatcher':'0x1e58 called at 0x28a0 and 0x28c4; strncmp(...,20)',
 'callback_registers':{
   'ordinary':'r0=original arg0; r1=original arg1; r2=0',
   'fallback':'r0=original arg0; r1=original arg1; r2=original arg2'},
 'special_callback_offset':56,
 'caution':'If the same registration pointer is used, +56 overlaps name region from +36; unresolved, do not invoke.',
 'actual_inbound_framing_verified':False,
 'callback_C_prototypes_verified':False,
 'hardware_tested':False,'flashable':False
 }
if __name__=='__main__':
 p=argparse.ArgumentParser()
 p.add_argument('--lib',required=True,type=Path)
 p.add_argument('--dockui',required=True,type=Path)
 p.add_argument('--app-man',required=True,type=Path)
 p.add_argument('--output',type=Path)
 a=p.parse_args();r=audit(a.lib,a.dockui,a.app_man)
 txt=json.dumps(r,indent=2,ensure_ascii=False)+'\n'
 if a.output:a.output.write_text(txt,encoding='utf8')
 print(txt,end='')
 raise SystemExit(0 if r['passed']==r['total'] else 1)
