#!/usr/bin/env python3

import os
import shutil
import sys
import urllib.request
import zipfile

SCRIPT_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "../.."))
ENVHELP_DIR = os.path.join(ROOT_DIR, "envhelp")
ENVHELP_NVM_DIR = os.path.join(ENVHELP_DIR, "nvm")
ENVHELP_STAGING_DIR = os.path.join(ENVHELP_DIR, "staging")


def detect_preexisting_nvm():
    return bool(os.getenv("NVM_DIR", None))


def make_nvm_release_url(nvm_version):
    return "https://github.com/nvm-sh/nvm/archive/refs/tags/v%s.zip" % (
        nvm_version,
    )


def main(argv):
    nvm_version = argv[0]

    if detect_preexisting_nvm():
        # nvm already installed; use it
        print("prexisting nvm detected; skipping installation")
        # satisfy the Makefile target
        os.makedirs(ENVHELP_NVM_DIR, exist_ok=True)
        return 0

    os.mkdir(ENVHELP_STAGING_DIR)

    nvm_relese_url = make_nvm_release_url(nvm_version)
    downloaded_archive_file = os.path.join(ENVHELP_STAGING_DIR, ".nvm.zip")

    urllib.request.urlretrieve(nvm_relese_url, downloaded_archive_file)

    archive = zipfile.ZipFile(downloaded_archive_file)
    archive.extractall(ENVHELP_STAGING_DIR)

    os.unlink(downloaded_archive_file)

    extracted_dir = os.path.join(ENVHELP_STAGING_DIR, "nvm-%s" % (nvm_version,))
    shutil.move(extracted_dir, ENVHELP_NVM_DIR)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
