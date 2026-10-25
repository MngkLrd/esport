#!/usr/bin/env python3
"""Read-only inspector for unknown Sony/embedded TV firmware packages.

No device access, patching, signing, flashing, or DRM key handling.
"""
import argparse
import hashlib
import json
import os
import re
import stat
import sys
import zipfile
from pathlib import Path

CHUNK = 1024 * 1024
TEXT_EXTENSIONS = {'.xml', '.json', '.js', '.html', '.htm', '.css', '.ini', '.cfg', '.conf', '.txt', '.sh', '.properties', '.desktop', '.url', '.m3u', '.lua'}
KEYWORDS = re.compile(r'(?i)vewd|opera[ -]?tv|berliner|widget|applicast|launcher|app[ -]?catalog|\.wgt\b|manifest|(?:https?://[^\s"\'<>]{1,170})')


def sha256_file(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(CHUNK), b''):
            h.update(b)
    return h.hexdigest()


def magic(data):
    signatures = [(b'PK\x03\x04', 'ZIP'), (b'\x7fELF', 'ELF'),
                  (b'hsqs', 'SquashFS little-endian'), (b'sqsh', 'SquashFS big-endian'),
                  (b'\x1f\x8b', 'gzip'), (b'\xfd7zXZ\x00', 'XZ'),
                  (b'\x27\x05\x19\x56', 'uImage'), (b'\xd0\x0d\xfe\xed', 'FDT/FIT'),
                  (b'\x85\x19', 'JFFS2 candidate')]
    found = [n for marker, n in signatures if data.startswith(marker)]
    if len(data) >= 1082 and data[1080:1082] == b'\x53\xef':
        found.append('ext2/3/4 candidate (superblock magic)')
    return found or ['unknown; may be proprietary, signed, compressed or encrypted']


def inspect_file(path):
    with path.open('rb') as f:
        head = f.read(4096)
    return {'name': path.name, 'size': path.stat().st_size,
            'sha256': sha256_file(path), 'magic': magic(head),
            'header_hex_32': head[:32].hex()}


def inspect_zip(path, max_entries=5000):
    report = {'archive': str(path), 'archive_sha256': sha256_file(path), 'members': [], 'warnings': []}
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        report['entry_count'] = len(infos)
        if len(infos) > max_entries:
            report['warnings'].append(f'Only first {max_entries} of {len(infos)} members listed')
        for item in infos[:max_entries]:
            name = item.filename
            parts = Path(name.replace('\\', '/')).parts
            unsafe = name.startswith(('/', '\\')) or any(p == '..' for p in parts) or bool(re.match(r'^[A-Za-z]:', name))
            mode = (item.external_attr >> 16) & 0xffff
            if stat.S_ISLNK(mode):
                unsafe = True
            r = {'name': name, 'size': item.file_size, 'compressed_size': item.compress_size,
                 'encrypted': bool(item.flag_bits & 1), 'unsafe_path': unsafe}
            report['members'].append(r)
            if unsafe:
                report['warnings'].append(f'Unsafe archive entry (not extracted): {name}')
    return report


def scan(root, max_hits=100, max_file_bytes=2 * 1024 * 1024):
    root = Path(root)
    report = {'root': str(root), 'matches': [], 'scanned_files': 0, 'skipped_symlinks': 0}
    for current, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if not (Path(current) / d).is_symlink())
        for name in sorted(files):
            p = Path(current) / name
            if p.is_symlink():
                report['skipped_symlinks'] += 1
                continue
            try:
                if p.suffix.lower() not in TEXT_EXTENSIONS or p.stat().st_size > max_file_bytes:
                    continue
                report['scanned_files'] += 1
                with p.open('r', encoding='utf-8', errors='replace') as f:
                    for i, line in enumerate(f, start=1):
                        if KEYWORDS.search(line):
                            report['matches'].append({'path': str(p.relative_to(root)),
                                                      'line': i, 'text': line.strip()[:240]})
                            if len(report['matches']) >= max_hits:
                                report['truncated'] = True
                                return report
            except (OSError, UnicodeError):
                continue
    report['truncated'] = False
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description='Offline, read-only firmware reconnaissance')
    subs = parser.add_subparsers(dest='command', required=True)
    for command in ('inspect', 'zip', 'scan'):
        sub = subs.add_parser(command)
        sub.add_argument('path', type=Path)
        sub.add_argument('--output', type=Path, help='Optional JSON report path')
    args = parser.parse_args(argv)
    if args.command == 'scan':
        if not args.path.is_dir():
            parser.error('scan expects an existing directory')
        result = scan(args.path)
    else:
        if not args.path.is_file():
            parser.error('expected an existing file')
        if args.command == 'zip':
            if not zipfile.is_zipfile(args.path):
                parser.error('not a ZIP file')
            result = inspect_zip(args.path)
        else:
            result = inspect_file(args.path)
    data = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(data + '\n', encoding='utf-8')
    print(data)
    return 0


if __name__ == '__main__':
    sys.exit(main())
