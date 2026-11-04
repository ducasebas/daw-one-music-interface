#!/bin/bash
# Pure target policy, shared by installer and tests. No commands or hardware writes.
daw_validate_install_target() {
  local target=$1 architecture=$2 model=$3 virtualization=$4
  case "$architecture" in aarch64|arm64) ;; *) echo 'Use a 64-bit ARM Linux guest or 64-bit Raspberry Pi OS.' >&2; return 1 ;; esac
  case "$target" in
    pi4)
      if [[ $model != *'Raspberry Pi 4'* ]]; then
        echo 'Pi 4 not detected. For an ARM64 VM explicitly use --target vm.' >&2; return 1
      fi ;;
    pi3-experimental)
      case "$model" in
        'Raspberry Pi 3 Model B Plus'*|'Raspberry Pi 3 Model B+'*) ;;
        *) echo 'Experimental target requires an actual Raspberry Pi 3 Model B+.' >&2; return 1 ;;
      esac ;;
    vm)
      if [[ -z $virtualization || $virtualization == none ]]; then
        echo 'No virtual machine detected; refusing VM-target installation.' >&2; return 1
      fi ;;
    *) echo 'Target must be pi4, pi3-experimental or vm.' >&2; return 2 ;;
  esac
}

# Pure detection: no default fallback to a different board or to a VM.
daw_detect_install_target() {
  case "$1" in
    'Raspberry Pi 3 Model B Plus'*|'Raspberry Pi 3 Model B+'*) echo pi3-experimental ;;
    'Raspberry Pi 4 Model B'*) echo pi4 ;;
    *) echo 'Unsupported/unknown board. ARM64 virtual machines require explicit --target vm.' >&2; return 1 ;;
  esac
}
