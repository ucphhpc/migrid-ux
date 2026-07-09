#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# --- BEGIN_HEADER ---
#
# serve_http.py - dual licensed source code file
# Copyright (C) 2025 - 2026  SCIENCE HPC Center at UCPH
#
# This file is part of MiGrid-UX.
#
# MiGrid-UX is free software: you can redistribute it and/or modify it under
# the terms of either
# the MIT License (LICENSES/LICENSE.MIT or https://opensource.org/licenses/MIT)
# OR
# the GNU General Public License version 2 (LICENSES/LICENSE.GPLv2 or
# https://opensource.org/license/gpl-2.0) or any later version
# at your option. The MiGrid-UX files may NOT be copied, modified, or
# distributed except according to those terms.
#
# --- END_HEADER ---



import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler, test

SCRIPT_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "../.."))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args):
        super().__init__(*args, directory=PUBLIC_DIR)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        SimpleHTTPRequestHandler.end_headers(self)


if __name__ == "__main__":
    test(
        CORSRequestHandler,
        HTTPServer,
        port=8880,
    )
