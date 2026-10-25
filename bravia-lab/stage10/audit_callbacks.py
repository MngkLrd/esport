#!/usr/bin/env python3
"""Read-only Sony v8.931 ARM callback verifier, pinned to original OEM ELF hashes.
No sockets, IPC transmit, flash, OEM binaries or proprietary material included.
For complete test suite and metadata JSON, see BRAVIA_STAGE10_REAL_IPC_ABI.zip.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

HASHES = {
 'lib': 'bbe9eb3d74c8e793b5d93e0a96edbb4d1e89fe8b3e259791c95b5836c3eb8636',
 'dock': '1c29e9f4175e825500b57874b37c5257fd8ce162b53ca061cc43a47e8c579480',
 'manager': '29fca75522ccd66abba528b8622ccda944e6b15455dd812c1f2036d710c14702',
}
CALLBACKS = (
 (0,0x963c,'am_resumed'),(4,0x96a0,'am_paused'),
 (8,0x9704,'am_stopped'),(12,0x9734,'am_shutdowned'),
 (16,0x9764,'am_suspended'),(20,0x9798,'am_wakeuped'),
 (24,0x97c4,None),
)
def shell(*argv):
 return subprocess.run(argv,check=True,text=True,capture_output=True,timeout=25).stdout

def verify_sha(filename,expected):
 raw=Path(filename).read_bytes()
 actual=hashlib.sha256(raw).hexdigest()
 if actual!=expected:raise ValueError(f'Wrong original Sony build: {filename}')
 return raw

def disasm(path,start,stop):
 return shell('llvm-objdump','-d','--arch=arm',
              '--start-address=0x%x'%start,'--stop-address=0x%x'%stop,str(path))

def audit(lib,dock,manager):
 binary=verify_sha(lib,HASHES['lib'])
 verify_sha(dock,HASHES['dock'])
 manager_bytes=verify_sha(manager,HASHES['manager'])
 rels=shell('readelf','-W','-r',str(dock))
 plt={}
 for line in rels.splitlines():
  m=re.search(r'R_ARM_JUMP_SLOT\s+([0-9a-f]{8})\s+(\S+)',line)
  if m and int(m.group(1),16):plt[int(m.group(1),16)]=m.group(2).split('@')[0]
 registration=disasm(dock,0xa0e0,0xa148)
 for offset,entry,target in CALLBACKS:
  hi='movw\tr3, #0x%x'%entry
  lo='str\tr3, [r11, #-0x%x]'%(0x44-offset)
  if hi not in registration or lo not in registration:
   raise ValueError('Unexpected callback registration slot: %d'%offset)
 for i,(offset,entry,target) in enumerate(CALLBACKS):
  end=CALLBACKS[i+1][1] if i+1<len(CALLBACKS) else entry+0x24
  text=disasm(dock,entry,end)
  calls=[plt.get(int(x,16)) for x in re.findall(r'\bbl\s+0x([0-9a-f]+)',text)]
  external=[s for s in calls if s and s.startswith('am_')]
  if target is None:
   if external or re.search(r'\bblx?\s',text):raise ValueError('Unexpected seventh callback')
  elif external!=[target]:raise ValueError('Wrong original callback target')
 fmt=b'\n:%s,%s,%s:%s\n\0'
 if binary[0x77ac:0x77ac+len(fmt)]!=fmt:
  raise ValueError('Outgoing format differs')
 if 'bl\t0x13ec' not in disasm(lib,0x424c,0x445c):
  raise ValueError('Formatter not referenced by am_send_cmd')
 paths=['/tmp/%s_write','/tmp/%s_read','/tmp/fifo_am_write','/tmp/fifo_am_read']
 if not all(p.encode() in manager_bytes for p in paths):
  raise ValueError('Manager IPC strings differ')
 return {
  'firmware':'v8.931-1000', 'callback_slots':[
   {'offset':ofs,'handler':'0x%x'%addr,'forwards_to':name}
   for ofs,addr,name in CALLBACKS],
  'send_cmd_template':'\n:%s,%s,%s:%s\n',
  'app_manager_paths':paths,
  'callback_signatures_known':False,'native_ipc_safe_to_send':False,
  'installable':False,
 }

if __name__=='__main__':
 p=argparse.ArgumentParser()
 p.add_argument('--lib',type=Path,required=True)
 p.add_argument('--dockui',type=Path,required=True)
 p.add_argument('--app-manager',type=Path,required=True)
 a=p.parse_args()
 print(json.dumps(audit(a.lib,a.dockui,a.app_manager),indent=2))
