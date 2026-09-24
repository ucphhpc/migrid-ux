"""
Route definitions for migux.apps.admin
"""

import os
from typing import Any, Optional

from flask import Request


class SelectedFieldsEntry:
    """
    Wraps an entry dictionary, allowing indexing of entry values by key, and
    iteration of entry values in the order specified by a list of field names.
    """

    def __init__(self, entry: dict[str, Any], field_names: list[str]) -> None:
        self._entry = entry
        self._field_names = field_names

    def __getitem__(self, key: str) -> Any:
        """
        Access an entry value by key, even if the key is not in the specified
        field names.
        """
        return self._entry[key]

    def __iter__(self):
        """
        Iterate over entry values indexed by, and in the order of the specified
        field names.
        """
        return (
            self._entry[key] for key in self._field_names if key in self._entry
        )


def _select_entries_fields(
    data: list[dict[str, Any]], field_names: list[str]
) -> list[SelectedFieldsEntry]:
    """
    Wraps each entry dictionary of `data` in a `SelectedFieldsEntry`, in order
    to select the specified fields of each entry, and enable iteration of entry
    values in the order specified by `field_names`.
    """
    return [SelectedFieldsEntry(entry, field_names) for entry in data]


def list_account_requests(
    request: Request, data: Optional[list[dict[str, Any]]] = None
):
    """
    Generate render_info for the listing of account requests.
    """

    field_names = request.args.get("fields", [])

    return {
        "template_args": {
            "account_requests": _select_entries_fields(data or [], field_names),
        },
        "template_name": "account_requests",
    }


def list_server_logs(
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


def list_server_daemons(
    _request: Request, data: Optional[list[dict[str, Any]]] = None
):
    """
    Generate render_info for the listing of server logs.
    """

    return {
        "template_args": {"server_daemons": (data or [])},
        "template_name": "server_daemons",
    }


def list_site_stats(
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
    "GET /account_requests": {"generate_args": list_account_requests},
    "GET /server/logs": {"generate_args": list_server_logs},
    "GET /server/daemons": {"generate_args": list_server_daemons},
    "GET /site/stats": {"generate_args": list_site_stats},
}
