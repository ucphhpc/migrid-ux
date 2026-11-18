"""
Route definitions for migux.apps.accountreqs
"""

from __future__ import annotations

import os
from typing import Any

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
    request: Request, data: list[dict[str, Any]] | None = None
):
    """
    Generate render_info for the listing of account requests.
    """

    field_names = request.args.get("fields", [])

    return {
        "template_args": {
            "account_requests": _select_entries_fields(data or [], field_names),  # type: ignore
        },
        "template_name": "account_requests",
    }


def list_csrf_tokens(_request, data=None):
    """
    Generate render_info for the listing of tokens.
    """

    return {
        "template_args": {
            "csrf_tokens": data,
        },
        "template_name": "csrf_tokens",
    }


TEMPLATE_FOLDER = os.path.join(os.path.dirname(__file__), "templates")
TEMPLATE_ROUTES = {
    "GET /": {"generate_args": list_account_requests},
    "GET /csrf_tokens": {"generate_args": list_csrf_tokens},
}
