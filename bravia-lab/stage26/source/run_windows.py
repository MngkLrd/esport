#!/usr/bin/env python3
"""Windows console UI for an owner-initiated RAM-only stock HOME test."""
from pathlib import Path
import sys
import tv_live_trial as trial

def main():
    print('BRAVIA Stage26 — Sony original HOME, local RAM test')
    print('PC and TV must be on the same private LAN.')
    print('Keep the TV HOME open. Port 9224 may be unavailable on your TV.')
    ip=input('TV IPv4 (e.g. 192.168.1.50): ').strip()
    try:
        trial.private_ip(ip)
        target=trial.probe(ip)
        print('Factory Cobalt HOME debug target found. No firmware files touched.')
    except Exception as exc:
        print('Probe failed:',str(exc))
        print('The TV may expose debugging only to itself. No change was made.')
        return 2
    print('1 = Status   2 = Apply catalog (RAM)   3 = Undo RAM catalog   0 = Exit')
    action=input('Choose: ').strip()
    if action not in ('1','2','3'):return 0
    if action=='2':
        answer=input('Confirm RAM-only changes on your own TV? Type YES: ').strip()
        if answer!='YES':return 0
    try:
        selected={'1':'status','2':'apply','3':'revert'}[action]
        result=trial.run_expression(target,trial.expression(selected,Path(__file__).resolve().parent))
        print('TV returned:',result)
        print('A power cycle/reload also restores the original UI.')
        return 0
    except Exception as exc:
        print('Action not confirmed:',str(exc))
        print('For active tests, install: python -m pip install websocket-client')
        return 3
if __name__=='__main__':sys.exit(main())
