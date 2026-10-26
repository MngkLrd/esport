#!/usr/bin/env python3
"""Optional, reversible RAM-only trial inside ORIGINAL Sony Cobalt HOME.
Connects only to a user-specified private IPv4 and port 9224 exposed in OEM
am_start.ini. Never writes Sony files or issues firmware/system commands.
Applies only to a tab whose URL ends /html5ui/index.html.
Requires websocket-client for --apply/--revert/--status.
"""
import argparse
import base64
import ipaddress
import json
from pathlib import Path
import urllib.request
from urllib.parse import urlparse,urlunparse

PORT = 9224

def private_ip(host):
    try:
        ip = ipaddress.IPv4Address(host)
    except ipaddress.AddressValueError as ex:
        raise ValueError('Enter TV numeric IPv4 address, e.g. 192.168.1.50') from ex
    networks = [ipaddress.IPv4Network('10.0.0.0/8'),
                ipaddress.IPv4Network('172.16.0.0/12'),
                ipaddress.IPv4Network('192.168.0.0/16')]
    if not any(ip in network for network in networks):
        raise ValueError('Only a private LAN TV address is allowed')
    return str(ip)

def select_home(targets, ip):
    if not isinstance(targets,list):raise ValueError('Invalid Sony debug target list')
    for target in targets:
        if not isinstance(target,dict) or target.get('type')!='page':continue
        u=str(target.get('url',''))
        if u.split('?',1)[0].split('#',1)[0]=='file:///html5ui/index.html':
            ws=str(target.get('webSocketDebuggerUrl',''))
            info=urlparse(ws)
            if info.scheme not in ('ws','wss') or not info.path.startswith('/devtools/page/'):
                raise ValueError('Missing or unsupported Sony HOME debug WebSocket')
            # Only use path and port from the TV, never remote IP/hostname supplied by page.
            if info.port not in (None,PORT):raise ValueError('Unexpected WebSocket port')
            ws=urlunparse((info.scheme, ip+':'+str(PORT), info.path, '', info.query, ''))
            return {'title':'Sony stock Cobalt HOME','url':'file:///html5ui/index.html','ws':ws}
    raise ValueError('Sony original HOME tab not found; not applying to a different web page')

def probe(ip,timeout=5):
    ip=private_ip(ip)
    endpoint='http://'+ip+':'+str(PORT)+'/json'
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(endpoint,timeout=timeout) as response:
        if response.status!=200:raise ValueError('Sony debugging endpoint not available')
        blob=response.read(1024*1024+1)
    if len(blob)>1024*1024:raise ValueError('Too many debugging targets')
    targets=json.loads(blob)
    return select_home(targets,ip)

def run_expression(target, expression):
    try:
        import websocket
    except ImportError as ex:
        raise RuntimeError('Install websocket-client: python -m pip install websocket-client') from ex
    # Runtime.evaluate invokes JS in the already-open, Sony-provided HOME only.
    sock=websocket.create_connection(target['ws'], timeout=5, origin='http://localhost')
    try:
        sock.send(json.dumps({'id':1,'method':'Runtime.evaluate','params':{
            'expression':expression,'returnByValue':True,'awaitPromise':False,
            'userGesture':False}},separators=(',',':')))
        for _ in range(35):
            reply=json.loads(sock.recv())
            if reply.get('id')!=1:continue
            if 'error' in reply:raise RuntimeError('Remote debugging rejected Runtime.evaluate')
            result=reply.get('result',{})
            if result.get('exceptionDetails'):raise RuntimeError('Sony HOME JS error while evaluating')
            return result.get('result',{}).get('value','NO_RETURN_VALUE')
        raise RuntimeError('No reply from Sony HOME debugger')
    finally:
        sock.close()

def expression(action, source_dir):
    if action=='status':
        return '(window.__braviaRamUndo ? "BRAVIA_RAM_ACTIVE" : "BRAVIA_RAM_OFF")'
    if action=='revert':
        return '(window.__braviaRamUndo ? window.__braviaRamUndo() : "BRAVIA_ALREADY_OFF")'
    if action=='apply':
        folder=Path(source_dir)
        code=(folder/'bravia_catalog.js').read_text(encoding='utf-8')
        hook=(folder/'ram_hook.js').read_text(encoding='utf-8')
        if len(code)+len(hook)>64*1024:raise ValueError('Unreasonably large RAM trial')
        assets=folder.parent/'assets'
        icons={}
        for key in ('kinopoisk','ivi','start','netflix','youtube','rutube','msx','alcopac','browser','kion'):
            img=assets/(key+'.png')
            if not img.is_file() or img.stat().st_size>10000:raise ValueError('Missing bounded authored PNG: '+key)
            icons[key]='data:image/png;base64,'+base64.b64encode(img.read_bytes()).decode('ascii')
        return code+'\nBraviaCatalog.setIconMap('+json.dumps(icons,separators=(',',':'))+');\n'+hook
    raise ValueError('Unsupported action')

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('action',choices=('probe','status','apply','revert'))
    cli.add_argument('tv_ip',help='Private LAN IPv4 of your own Sony TV')
    cli.add_argument('--confirm-I-own-tv',action='store_true',dest='confirmed')
    args=cli.parse_args()
    if args.action=='apply' and not args.confirmed:
        cli.error('--apply requires --confirm-I-own-tv')
    target=probe(args.tv_ip)
    if args.action=='probe':
        print('SONY_STOCK_HOME_DEBUG_PORT_AVAILABLE')
        print('Target is original file:///html5ui/index.html; no code executed')
        return
    result=run_expression(target,expression(args.action,Path(__file__).resolve().parent))
    print(result)
    if result not in ('BRAVIA_RAM_CATALOG_ACTIVE','BRAVIA_RAM_ACTIVE','BRAVIA_RAM_OFF',
                      'BRAVIA_REVERTED','BRAVIA_ALREADY_OFF','BRAVIA_ALREADY_PATCHED'):
        raise SystemExit('HOME not patched, check version: '+str(result))
if __name__=='__main__':main()
