#!/usr/bin/env python3
"""Portable, read-only ELF32 ARM analyzer for *local* Sony firmware files.

Does not execute, patch, unpack firmware, connect to a TV, or infer that a
software update is installable. No external Python modules are needed.
"""
from __future__ import annotations
import hashlib
import json
import os
import re
import struct
from pathlib import Path

MAX_SIZE = 64 * 1024 * 1024
ARM = 40
LOAD = 1
DYNAMIC = 2
INTERP = 3
DT_NULL = 0
DT_NEEDED = 1
DT_STRTAB = 5
DT_STRSZ = 10
DT_SONAME = 14

PINNED = {
    "launcher.bin": "1c29e9f4175e825500b57874b37c5257fd8ce162b53ca061cc43a47e8c579480",
    "app_man": "29fca75522ccd66abba528b8622ccda944e6b15455dd812c1f2036d710c14702",
    "libapp_client.so": "bbe9eb3d74c8e793b5d93e0a96edbb4d1e89fe8b3e259791c95b5836c3eb8636",
}
INDICATORS = {
    "dockui_xml": b"DockUI.xml",
    "service_list": b"service_list",
    "am_client_init": b"am_client_init",
    "am_send_cmd": b"am_send_cmd",
    "directfb": b"libdirectfb.so",
    "sony_browser": b"browser_base",
    "netflix": b"Netflix",
    "youtube": b"YouTube",
    "amazon": b"Amazon",
    "globoplay": b"globoplay",
    "samba": b"samba",
}

class ELFError(ValueError):
    pass


def _range(data: bytes, off: int, size: int) -> bytes:
    if off < 0 or size < 0 or off > len(data) or size > len(data) - off:
        raise ELFError("ELF points outside file")
    return data[off:off + size]


def _read_name(data: bytes, offset: int, cap: int = 256) -> str:
    if offset < 0 or offset >= len(data):
        raise ELFError("invalid string table offset")
    end = data.find(b"\0", offset, min(offset + cap, len(data)))
    if end < 0:
        raise ELFError("unterminated string-table entry")
    return data[offset:end].decode("ascii", "replace")


def inspect_elf_bytes(data: bytes) -> dict:
    if len(data) < 52 or len(data) > MAX_SIZE:
        raise ELFError("ELF file outside supported size")
    if data[:4] != b"\x7fELF" or data[4] != 1 or data[5] != 1:
        raise ELFError("expected little-endian ELF32")
    h = struct.unpack_from("<HHIIIIIHHHHHH", data, 16)
    etype, machine, version, entry, phoff, shoff, flags, ehsize, phentsize, phnum, shentsize, shnum, shstrndx = h
    if machine != ARM or version != 1 or ehsize != 52:
        raise ELFError("ELF is not ARM32 EABI")
    if (flags & 0xFF000000) != 0x05000000:
        raise ELFError("ELF ARM EABI version is not 5")
    if etype not in (2, 3):
        raise ELFError("only ARM executable or shared object supported")
    if phnum > 1024 or (phnum and phentsize != 32):
        raise ELFError("unsupported ELF program headers")
    if shnum > 8192 or (shnum and shentsize != 40):
        raise ELFError("unsupported ELF section headers")
    if phnum: _range(data, phoff, phnum * phentsize)
    if shnum: _range(data, shoff, shnum * shentsize)

    segments, dynamic_entries = [], []
    loader = None
    for i in range(phnum):
        ptype, off, vaddr, paddr, filesz, memsz, pflags, align = struct.unpack_from("<IIIIIIII", data, phoff + 32 * i)
        if filesz: _range(data, off, filesz)
        if ptype == LOAD:
            if filesz > memsz:
                raise ELFError("invalid load segment: file larger than memory")
            segments.append((off, vaddr, filesz, memsz, pflags))
        elif ptype == INTERP:
            loader = _read_name(data, off)
        elif ptype == DYNAMIC:
            if filesz % 8:
                raise ELFError("malformed ELF dynamic table")
            if filesz > 1_000_000:
                raise ELFError("dynamic table too large")
            for at in range(off, off + filesz, 8):
                tag, val = struct.unpack_from("<II", data, at)
                dynamic_entries.append((tag, val))
                if tag == DT_NULL: break

    def vaddr_to_offset(addr: int, n: int) -> int:
        for off, start, fsz, _, _ in segments:
            if addr >= start and n <= fsz and addr - start <= fsz - n:
                return off + addr - start
        raise ELFError("ELF virtual address not mapped into file")

    entries = {t: v for t, v in dynamic_entries}
    needed = []
    soname = None
    if any(t in (DT_NEEDED, DT_SONAME) for t, _ in dynamic_entries):
        if DT_STRTAB not in entries or DT_STRSZ not in entries:
            raise ELFError("missing dynamic string table")
        string_size = entries[DT_STRSZ]
        if string_size > 4_000_000:
            raise ELFError("oversized dynamic strings")
        string_data = _range(data, vaddr_to_offset(entries[DT_STRTAB], string_size), string_size)
        for tag, val in dynamic_entries:
            if tag == DT_NEEDED: needed.append(_read_name(string_data, val))
            elif tag == DT_SONAME: soname = _read_name(string_data, val)

    # Sections are inspected without ever publishing raw OEM strings.
    sections = []
    if shnum:
        shdrs = [struct.unpack_from("<IIIIIIIIII", data, shoff + 40 * i) for i in range(shnum)]
        if shstrndx >= shnum:
            raise ELFError("invalid section name table")
        shstring = shdrs[shstrndx]
        strtable = _range(data, shstring[4], shstring[5])
        for sh in shdrs:
            name = _read_name(strtable, sh[0]) if sh[0] else ""
            if sh[1] != 8 and sh[5]: _range(data, sh[4], sh[5])
            sections.append({"name": name, "size": sh[5], "virtual_address": sh[3]})

    flags_summary = [{"read":bool(f & 4), "write":bool(f & 2), "execute":bool(f & 1)}
                     for _,_,_,_,f in segments]
    references = {}
    for label, needle in INDICATORS.items():
        offsets = []
        pos = 0
        while len(offsets) < 20:
            at = data.find(needle, pos)
            if at < 0: break
            offsets.append(at)
            pos = at + len(needle)
        resolved = []
        for at in offsets:
            # Byte-offset to mapped address, with evidence of literal pointers.
            for off, start, fsz, _, _ in segments:
                if off <= at < off + fsz:
                    va = start + at - off
                    ptr = struct.pack("<I", va)
                    ptr_count = 0
                    search_from = 0
                    while True:
                        hit = data.find(ptr, search_from)
                        if hit < 0: break
                        if hit % 4 == 0: ptr_count += 1
                        search_from = hit + 1
                    resolved.append({"virtual_address":va, "literal_pointer_refs_at_aligned_offsets":ptr_count})
                    break
        references[label] = {"present":bool(offsets), "candidate_addresses":resolved,
                             "truncated": len(offsets) == 20}
    return {
        "elf_type": "ET_EXEC" if etype == 2 else "ET_DYN",
        "elf32_arm_eabi5": True,
        "entrypoint_va": entry,
        "program_header_count": phnum,
        "section_count": shnum,
        "load_segments": flags_summary,
        "interpreter": loader,
        "dependencies": needed,
        "soname": soname,
        "sections": sections,
        "static_string_indicators": {name: data.find(text) >= 0 for name, text in INDICATORS.items()},
        "static_reference_candidates": references,
        "firmware_modified": False,
        "runtime_exec_proven": False,
        "sony_abi_verified": False,
    }


def inspect_elf_path(path: str | Path, expected_sha: str | None = None) -> dict:
    p = Path(path)
    if not p.is_file() or p.is_symlink() or p.stat().st_size > MAX_SIZE:
        raise ELFError("input must be an ordinary bounded file")
    data = p.read_bytes()
    result = inspect_elf_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    result["sha256_matches_known_oem"] = digest == expected_sha if expected_sha else None
    result["oem_reference_trusted"] = expected_sha is not None and digest == expected_sha
    return result
