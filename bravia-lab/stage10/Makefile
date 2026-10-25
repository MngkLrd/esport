CC ?= cc
CLANG ?= clang
CFLAGS = -std=c99 -Wall -Wextra -Werror -pedantic -O2
.PHONY: test arm
test:
	$(CC) $(CFLAGS) verified_callback_layout.c test_verified_layout.c -o /tmp/bravia_stage10_test
	/tmp/bravia_stage10_test
arm:
	$(CLANG) -target armv7-linux-gnueabi -march=armv7-a -mfpu=vfpv4 -mfloat-abi=softfp -std=c99 -O2 -ffreestanding -Wall -Wextra -Werror -c verified_callback_layout.c -o /tmp/bravia_stage10_arm.o
	readelf -h /tmp/bravia_stage10_arm.o | grep -E 'Class:|Machine:|Flags:'
