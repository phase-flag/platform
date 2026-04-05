PROVIDER_NAME  := terraform-provider-phaseflag
BINARY         := $(PROVIDER_NAME)
VERSION        ?= 0.1.0
OS             := $(shell go env GOOS)
ARCH           := $(shell go env GOARCH)

# Terraform plugin mirror path (used by `make install`).
TF_PLUGIN_DIR  := ~/.terraform.d/plugins/phaseflag/phaseflag/$(VERSION)/$(OS)_$(ARCH)

.PHONY: all build install clean fmt vet test

## all: build the provider binary (default target)
all: build

## build: compile the provider binary
build:
	go build -o $(BINARY) .

## install: build and install into the local Terraform plugin cache
install: build
	mkdir -p $(TF_PLUGIN_DIR)
	cp $(BINARY) $(TF_PLUGIN_DIR)/$(BINARY)
	@echo "Provider installed to $(TF_PLUGIN_DIR)/$(BINARY)"

## fmt: run gofmt on all source files
fmt:
	gofmt -s -w .

## vet: run go vet
vet:
	go vet ./...

## test: run unit tests
test:
	go test ./... -v -count=1

## clean: remove build artefacts
clean:
	rm -f $(BINARY)
