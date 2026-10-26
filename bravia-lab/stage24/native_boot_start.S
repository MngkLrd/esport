.syntax unified
.arm
.text
.global _start
.type _start,%function
_start:
 bl bravia_boot_probe_main
 mov r7, #1
 svc #0
.size _start, .-_start
