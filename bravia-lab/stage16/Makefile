CC ?= cc
CLANG ?= clang
CFLAGS = -std=c99 -O2 -Wall -Wextra -Werror -pedantic
CORE = ../native_core/home_core.c ../native_core/host_dispatch.c ../native_core/render.c
.PHONY: all test sanitize arm bench clean
all: console test_sim
console: $(CORE) sim.c console.c sim.h
	$(CC) $(CFLAGS) -I../native_core $(CORE) sim.c console.c -o console
test_sim: $(CORE) sim.c test_sim.c sim.h
	$(CC) $(CFLAGS) -I../native_core $(CORE) sim.c test_sim.c -o test_sim
test: all
	./test_sim
	./console --demo --script hsdddo > /tmp/bravia-stage16-demo.txt
	grep -q 'owner=app' /tmp/bravia-stage16-demo.txt
sanitize:
	$(CC) -std=c99 -O1 -g -Wall -Wextra -Werror -pedantic -fsanitize=address,undefined -fno-omit-frame-pointer -I../native_core $(CORE) sim.c test_sim.c -o /tmp/bravia-stage16-sanitized
	/tmp/bravia-stage16-sanitized
arm:
	$(CLANG) -target armv7-linux-gnueabi -march=armv7-a -mfpu=vfpv4 -mfloat-abi=softfp -std=c99 -ffreestanding -fno-builtin -fno-stack-protector -O2 -Wall -Wextra -Werror -I../native_core -c sim.c -o /tmp/bravia-stage16-sim-armv7.o
	readelf -h /tmp/bravia-stage16-sim-armv7.o | grep -E 'Class:|Type:|Machine:|Flags:'
bench: console
	./console --benchmark 100000
clean:
	rm -f console test_sim
