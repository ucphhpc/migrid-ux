# -*- coding: utf-8 -*-
#
# --- BEGIN_HEADER ---
#
# templating.py - dual licensed source code file
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

"""
Helpers for template serving in the development server.
"""

from jinja2 import Environment as JinjaEnv
from jinja2 import PackageLoader


def _autoescape(template_name):
    if template_name is None:
        return False
    if template_name.endswith((".html.jinja")):
        return True
    return False


def load_templates_for_package(package):
    """
    Load the templates for a given package.
    """
    return JinjaEnv(loader=PackageLoader(package), autoescape=_autoescape)
