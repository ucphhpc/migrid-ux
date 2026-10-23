"""
Route definitions for migux.apps.admin
"""

import os
from typing import Any, Optional

from flask import Request


def list_logs(
    request: Request, data: Optional[list[dict[str, Any]]] = None
):
    """
    Generate render_info for the listing of server logs.
    """

    last_lines = 10
    try:
        last_lines = int(request.args.get("last_lines"))
    except (ValueError, TypeError):
        pass

    return {
        "template_args": {"server_log_entries": (data or [])[-last_lines:]},
        "template_name": "server_logs",
    }


def list_daemons(
    _request: Request, data: Optional[list[dict[str, Any]]] = None
):
    """
    Generate render_info for the listing of server logs.
    """

    return {
        "template_args": {"server_daemons": (data or [])},
        "template_name": "server_daemons",
    }


def list_stats(
    _request: Request, data: Optional[list[dict[str, Any]]] = None
):
    """
    Generate render_info for the listing of site stats.
    """
    return {
        "template_args": {"site_stats": (data or [])},
        "template_name": "site_stats",
    }


TEMPLATE_FOLDER = os.path.join(os.path.dirname(__file__), "templates")
TEMPLATE_ROUTES = {
    "GET /logs": {"generate_args": list_logs},
    "GET /daemons": {"generate_args": list_daemons},
    "GET /stats": {"generate_args": list_stats},
}
