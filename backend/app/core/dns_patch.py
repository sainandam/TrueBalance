"""
Resilient DNS resolver for environments where the local router/OS
DNS resolver exhibits timeouts or intermittent failures on cloud endpoints.
Queries public DNS servers (8.8.8.8, 1.1.1.1) directly for known cloud hostnames.
"""

import socket
import struct
from typing import Optional

_orig_getaddrinfo = socket.getaddrinfo
_dns_cache: dict[str, str] = {
    "ep-red-block-b3imgi43-pooler.c-4.ap-southeast-1.aws.neon.tech": "52.76.246.190",
    "ep-red-block-b3imgi43.c-4.ap-southeast-1.aws.neon.tech": "52.76.246.190",
}


def _dns_query_udp(hostname: str, dns_server: str = "8.8.8.8") -> Optional[str]:
    try:
        tid = 0x2468
        flags = 0x0100
        packet = struct.pack(">HHHHHH", tid, flags, 1, 0, 0, 0)
        for part in hostname.split("."):
            encoded = part.encode("ascii")
            packet += bytes([len(encoded)]) + encoded
        packet += b"\x00" + struct.pack(">HH", 1, 1)

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(2.0)
        sock.sendto(packet, (dns_server, 53))
        data, _ = sock.recvfrom(2048)
        sock.close()

        ancount = struct.unpack(">H", data[6:8])[0]
        if ancount == 0:
            return None

        idx = 12
        while idx < len(data) and data[idx] != 0:
            if (data[idx] & 0xC0) == 0xC0:
                idx += 2
                break
            idx += 1 + data[idx]
        else:
            idx += 1
        idx += 4

        for _ in range(ancount):
            if idx >= len(data):
                break
            if (data[idx] & 0xC0) == 0xC0:
                idx += 2
            else:
                while idx < len(data) and data[idx] != 0:
                    idx += 1 + data[idx]
                idx += 1

            if idx + 10 > len(data):
                break
            atype, aclass, ttl, rdlen = struct.unpack(">HHIH", data[idx : idx + 10])
            idx += 10

            if atype == 1 and rdlen == 4:
                return socket.inet_ntoa(data[idx : idx + 4])
            idx += rdlen

        return None
    except Exception:
        return None


def _fast_getaddrinfo(host, port, *args, **kwargs):
    if isinstance(host, str) and not host.replace(".", "").isdigit():
        if host in _dns_cache:
            return _orig_getaddrinfo(_dns_cache[host], port, *args, **kwargs)
        if "neon.tech" in host:
            resolved_ip = _dns_query_udp(host, "8.8.8.8") or _dns_query_udp(host, "1.1.1.1")
            if resolved_ip:
                _dns_cache[host] = resolved_ip
                return _orig_getaddrinfo(resolved_ip, port, *args, **kwargs)

    try:
        return _orig_getaddrinfo(host, port, *args, **kwargs)
    except socket.gaierror:
        if isinstance(host, str) and not host.replace(".", "").isdigit():
            resolved_ip = _dns_query_udp(host, "8.8.8.8") or _dns_query_udp(host, "1.1.1.1")
            if resolved_ip:
                _dns_cache[host] = resolved_ip
                return _orig_getaddrinfo(resolved_ip, port, *args, **kwargs)
        raise


def apply_dns_patch():
    if socket.getaddrinfo != _fast_getaddrinfo:
        socket.getaddrinfo = _fast_getaddrinfo


apply_dns_patch()
