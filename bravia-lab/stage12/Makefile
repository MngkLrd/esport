CC ?= cc
CLANG ?= clang
CFLAGS = -std=c99 -O2 -Wall -Wextra -Werror -pedantic
.PHONY: test arm sanitize clean fragment-test
all: test
test:
	mkdir -p bin
	$(CC) $(CFLAGS) ipc_frame_observer.c tests/test_frame_observer.c -I. -o bin/test_frame
	./bin/test_frame
fragment-test:
	mkdir -p bin
	$(CC) $(CFLAGS) ipc_frame_observer.c tests/test_frame_fragments.c -I. -o bin/test_fragments
	./bin/test_fragments
sanitize:
	mkdir -p bin
	$(CC) $(CFLAGS) -g -O1 -fsanitize=address,undefined -fno-omit-frame-pointer ipc_frame_observer.c tests/test_frame_observer.c -I. -o bin/test_frame_san
	./bin/test_frame_san
arm:
	mkdir -p bin
	$(CLANG) --target=armv7-linux-gnueabi -march=armv7-a -mfpu=vfpv4 -mfloat-abi=softfp -ffreestanding -fno-builtin -fno-stack-protector -std=c99 -O2 -Wall -Wextra -Werror -c ipc_frame_observer.c -o bin/ipc_frame_armv7.o
	readelf -h bin/ipc_frame_armv7.o | grep -E 'Class:|Machine:|Type:'
clean:
	rm -rf bin
