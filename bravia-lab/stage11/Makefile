CC ?= cc
CLANG ?= clang
CFLAGS=-std=c99 -O2 -Wall -Wextra -Werror -pedantic
.PHONY: test sanitize arm clean
all: test
bin:
	mkdir -p bin
test: bin
	$(CC) $(CFLAGS) ipc_observer.c test_ipc_observer.c -I. -o bin/test_observer
	./bin/test_observer
sanitize: bin
	$(CC) $(CFLAGS) -O1 -g -fsanitize=address,undefined -fno-omit-frame-pointer ipc_observer.c test_ipc_observer.c -I. -o bin/test_observer_san
	./bin/test_observer_san
arm: bin
	$(CLANG) --target=armv7-linux-gnueabi -march=armv7-a -mfpu=vfpv4 -mfloat-abi=softfp -ffreestanding -fno-builtin -fno-stack-protector -std=c99 -O2 -Wall -Wextra -Werror -c ipc_observer.c -o bin/ipc_observer_armv7.o
	readelf -h bin/ipc_observer_armv7.o | grep -E 'Class:|Machine:|Type:'
clean:
	rm -rf bin
