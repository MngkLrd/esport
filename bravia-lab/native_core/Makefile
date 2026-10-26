CC ?= cc
CFLAGS ?= -std=c99 -O2 -Wall -Wextra -Werror -Wconversion -pedantic
SRC = home_core.c render.c
.PHONY: all test clean directfb-check adapter-test
all: tests render_dump test_host_dispatch test_product test_catalog_host

tests: $(SRC) test_home_core.c test_render.c
	$(CC) $(CFLAGS) $(SRC) test_home_core.c -o test_home_core
	$(CC) $(CFLAGS) $(SRC) test_render.c -o test_render

test_host_dispatch: home_core.c host_dispatch.c test_host_dispatch.c
	$(CC) $(CFLAGS) home_core.c host_dispatch.c test_host_dispatch.c -o test_host_dispatch

test_product: $(SRC) host_dispatch.c test_product.c
	$(CC) $(CFLAGS) $(SRC) host_dispatch.c test_product.c -o test_product

test_catalog_host: home_core.c host_dispatch.c native_catalog.c catalog_host.c ../stage20/test_catalog_host.c
	$(CC) $(CFLAGS) -I. home_core.c host_dispatch.c native_catalog.c catalog_host.c ../stage20/test_catalog_host.c -o test_catalog_host

render_dump: $(SRC) render_dump.c
	$(CC) $(CFLAGS) $(SRC) render_dump.c -o render_dump

test: all
	./test_home_core
	./test_render
	./test_host_dispatch
	./test_product
	./test_catalog_host
	./render_dump 1280 720 home >/dev/null
	./render_dump 1920 1080 home >/dev/null
	./render_dump 1280 720 detail >/dev/null

# Optional; may only be built on a host with the matching DirectFB 1.x headers.
directfb-check:
	$(CC) $(CFLAGS) -DBRAVIA_WITH_DIRECTFB $$(pkg-config --cflags directfb) -fsyntax-only directfb_backend.c

clean:
	rm -f test_home_core test_render render_dump test_adapter test_logos test_host_dispatch test_product test_catalog_host
# A test-only header validates calling shape; it is NOT Sony's DirectFB ABI.
adapter-test:
	$(CC) $(CFLAGS) -DBRAVIA_WITH_DIRECTFB -I../tests/directfb_stub -I. home_core.c render.c directfb_backend.c ../tests/test_directfb_adapter.c -o test_adapter
	./test_adapter
	$(CC) $(CFLAGS) -DBRAVIA_WITH_DIRECTFB -I../tests/directfb_stub -I. directfb_logos.c ../tests/test_directfb_logo_loader.c -o test_logos
	./test_logos
