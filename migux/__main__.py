# -*- coding: utf-8 -*-
#
# --- BEGIN_HEADER ---
#
# __main__.py - dual licensed source code file
# Copyright (C) 2025 - 2026  SCIENCE HPC Center at UCPH
#
# This file is part of MiGrid-UX.
#
# MiGrid-UX is free software: you can redistribute it and/or modify it under
# the terms of the GNU General Public License version 2 (LICENSES/LICENSE.GPLv2 or
# https://opensource.org/license/gpl-2.0) or any later version
# at your option. The MiGrid-UX files may NOT be copied, modified, or
# distributed except according to those terms.
#
# --- END_HEADER ---

"""
Plugin package CLI that provides an overview of its contents.
"""

import sys

import migux


def main(_):
    """
    Main function for CLI.
    """

    print("`%s` plugin for MiGrid" % (migux.MIG_PLUGIN,))
    print("")
    print("template packages:")
    print(*("- %s" % (pkg,) for pkg in migux.TEMPLATE_PACKAGES), "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
