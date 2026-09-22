# -*- coding: utf-8 -*-
#
# --- BEGIN_HEADER ---
#
# conf.py - dual licensed source code file
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

project = "migrid-ux"
author = "Alex Jeff Burke, Rasmus Munk, Jonas Bardino"
version = "1.19.0"
release = "main"

extensions = ["myst_parser"]

myst_heading_anchor_level = 2

html_theme = "alabaster"

exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]
