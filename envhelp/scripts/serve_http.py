#!/usr/bin/env python3


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
