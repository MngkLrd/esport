#!/usr/bin/env python3
"""Read-only check of Cobalt DevTools port 9224 on a single authorized TV LAN IP.

This does NOT submit commands, evaluate JavaScript, use WebSockets or flash firmware.
"""
import argparse,ipaddress,json,sys
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError

PORT=9224
PATHS=('/json/version','/json','/')
LAN=tuple(ipaddress.IPv4Network(x) for x in ('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'))

def validate_address(value):
    try: ip=ipaddress.IPv4Address(value)
    except ipaddress.AddressValueError as e:raise ValueError('Provide one private IPv4 (not URL, CIDR or hostname)') from e
    if not any(ip in n for n in LAN):raise ValueError('Only RFC1918 LAN IPv4 permitted')
    return str(ip)

def classify(path,code,headers,body):
    category='http_response';count=None
    if 'json' in str(headers.get('Content-Type','')).lower() or body.lstrip().startswith((b'[',b'{')):
        try:
            data=json.loads(body.decode('utf-8','replace'))
            if path=='/json' and isinstance(data,list):
                category='devtools_targets_candidate';count=len(data)
            elif path=='/json/version' and isinstance(data,dict) and any(k in data for k in ('Browser','Protocol-Version','webSocketDebuggerUrl')):
                category='devtools_version_candidate'
            else:category='json_response'
        except ValueError:category='not_json'
    elif path=='/' and b'html' in body[:800].lower():category='html_debugger_candidate'
    return {'path':path,'status':code,'category':category,'target_count':count}

def probe(ip,timeout=1.5,opener=urlopen):
    host=validate_address(ip);out=[]
    for path in PATHS:
        req=Request('http://'+host+':'+str(PORT)+path,headers={'User-Agent':'BRAVIA-ReadOnly-Probe/1.0'})
        try:
            with opener(req,timeout=timeout) as r:
                data=r.read(32769)
                out.append({'path':path,'status':r.status,'category':'oversized_response'} if len(data)>32768 else classify(path,r.status,r.headers,data))
        except HTTPError as e:out.append({'path':path,'status':e.code,'category':'http_error'})
        except (URLError,OSError,TimeoutError) as e:out.append({'path':path,'category':'not_reachable','error':type(e).__name__})
    return {'host':'[private-lan-device]','port':PORT,'method':'GET_ONLY','paths':out,
    'warning':'Availability does not prove custom firmware support, signing bypass or installation.'}

if __name__=='__main__':
    p=argparse.ArgumentParser(description='Read-only Cobalt port 9224 on one private LAN host')
    p.add_argument('tv_ip');p.add_argument('--timeout',type=float,default=1.5)
    x=p.parse_args()
    if not 0.2<=x.timeout<=5:p.error('Timeout must be 0.2–5 seconds')
    try:res=probe(x.tv_ip,x.timeout)
    except ValueError as e:p.error(str(e))
    print(json.dumps(res,ensure_ascii=False,indent=2))
