# -*- coding: utf-8 -*-
#
# --- BEGIN_HEADER ---
#
# peers.py - dual licensed source code file
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
Development facing implementation of a peers API.
"""

import os
from types import SimpleNamespace

from flask import request

import devserver.common as server_common
import migux.apps.peers as migux_apps_peers

EXAMPLE_DATA = {
    "GET /accepted": server_common.import_example_data("peers/accepted.json"),
    "GET /requested": server_common.import_example_data("peers/requested.json"),
}
MIGUX_APPS_PEERS_TEMPLATE_FOLDER = os.path.join(
    os.path.dirname(migux_apps_peers.__file__), "templates"
)


def _fill_distinguished_name(user):
    distinguished_name = ""
    for key, val in [
        ("country", "C"),
        ("state", "ST"),
        ("locality", "L"),
        ("organization", "O"),
        ("organizational_unit", "OU"),
        ("full_name", "CN"),
        ("email", "emailAddress"),
    ]:
        setting = user.get(key, "")
        if not setting:
            setting = "NA"
        distinguished_name += "/%s=%s" % (val, setting)
    return distinguished_name


def _unconcatify(value, sep):
    assert isinstance(value, str)
    result = value.split(sep)
    if len(result) == 1 and result[0] == "":
        return []
    return result


def create_handler_response(
    status, message=None, error=None, **ui_response_kwargs
):
    """
    A helper function to create route handler responses.
    """
    return {"message": message, "error": error, **ui_response_kwargs}, status


def _create_form_response(payload, simulate_error=False):
    """
    Helper function for creating the devserver API response
    """
    success_map = {"0": not simulate_error}
    errors_map = {}

    if simulate_error:
        simulated_errors = {
            key: "%s error occurred" % (key,) for key in payload.keys()
        }
        errors_map = {"0": simulated_errors}

    return {"success_map": success_map, "errors_map": errors_map}


def migux_apps_peers__GET_summary():
    """
    Request handler: GET /peers/summary
    """

    return {
        "accepted_count": len(EXAMPLE_DATA["GET /accepted"]),
        "requested_count": len(EXAMPLE_DATA["GET /requested"]),
    }


def migux_apps_peers__GET_accepted():
    """
    Request handler: GET /peers/accepted
    """

    template_route = migux_apps_peers.TEMPLATE_ROUTES["GET /accepted"]
    request_info = SimpleNamespace(
        args={
            "query": request.values.get("query"),
            "fields": _unconcatify(request.values.get("fields", ""), ","),
            "kind": request.values.get("kind", ""),
        }
    )
    example_data = EXAMPLE_DATA["GET /accepted"]

    # Filter by kind if provided
    kind = request_info.args.get("kind", "")
    if kind:
        example_data = [d for d in example_data if d.get("kind") == kind]

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )


def migux_apps_peers__GET_requested():
    """
    Request handler: GET /peers/requested
    """

    template_route = migux_apps_peers.TEMPLATE_ROUTES["GET /requested"]
    request_info = SimpleNamespace(
        args={
            "query": request.values.get("query"),
            "fields": _unconcatify(request.values.get("fields", ""), ","),
        }
    )
    example_data = EXAMPLE_DATA["GET /requested"]

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )


def migux_apps_peers__POST_accepted_delete():
    """
    Request handler: GET /peers/delete
    """

    payload = request.json
    peer_dns_to_delete = set(payload["peers"])

    example_data = EXAMPLE_DATA["GET /accepted"]
    remaining_peers = [
        peer_dn
        for peer_dn in example_data
        if peer_dn["distinguished_name"] not in peer_dns_to_delete
    ]
    EXAMPLE_DATA["GET /accepted"] = remaining_peers
    return create_handler_response(200)


def migux_apps_peers__POST_accepted_import():
    """
    Request handler: GET /peers/accepted/import
    """

    payload = request.json

    # Global values applied to all rows
    global_label = payload.get("label", "")
    global_kind = payload.get("kind", "")
    global_expire = payload.get("expire", "")

    input_label = payload.get("label", "")
    if input_label == "ERROR":
        errors_map = {
            "csvtext": payload.get("csvtext", ""),
            "label": global_label,
            "kind": global_kind,
            "expire": global_expire,
        }

        return {
            "errors_map": errors_map,
        }, 404

    # Parse CSV text
    csv_lines = _unconcatify(payload.get("csvtext", ""), "\n")
    if not csv_lines:
        return {}, 400

    # First line is the header
    header = [col.strip() for col in csv_lines[0].split(";")]

    # Iterate each body line
    for line in csv_lines[1:]:
        line = line.strip()
        if not line:
            continue

        values = [val.strip() for val in line.split(";")]
        user_dict = {}
        for i, col_name in enumerate(header):
            if i < len(values):
                user_dict[col_name] = values[i]

        # Apply global values
        if global_label:
            user_dict["label"] = global_label
        if global_expire:
            user_dict["expire"] = global_expire
        if global_kind:
            user_dict["kind"] = global_kind

        # Since this is only a dev dummy endpoint, we fill in any missing values required
        # to make a distinguished name
        # Fill missing fields with defaults from example data
        example_user_dict = EXAMPLE_DATA["GET /accepted"][0]
        for key in example_user_dict:
            if key not in user_dict:
                user_dict[key] = example_user_dict[key]

        # Generate distinguished name
        user_dict["distinguished_name"] = _fill_distinguished_name(user_dict)
        EXAMPLE_DATA["GET /accepted"].append(user_dict)
    return {}


def migux_apps_peers__POST_accepted_fetch():
    """
    Request handler: POST /peers/accepted/fetch
    """

    payload = request.json
    peer_dn = payload.get("peer_dn", None)

    example_data = EXAMPLE_DATA["GET /accepted"]

    found_peer = None
    for item in example_data:
        if item["distinguished_name"] == peer_dn:
            found_peer = item
            break

    if found_peer is None:
        return create_handler_response(
            404, error="Failed to find the specified Peer"
        )

    return create_handler_response(200, **found_peer)


def migux_apps_peers__POST_accepted_update():
    """
    Request handler: POST /peers/accepted/update
    """

    payload = request.json
    peer_dn = payload.pop("peer_dn", None)

    example_data = EXAMPLE_DATA["GET /accepted"]

    should_simulate_error = payload["label"] == "ERROR"
    form_response = _create_form_response(
        payload, simulate_error=should_simulate_error
    )
    if should_simulate_error:
        return create_handler_response(
            404, error="Failed to update Peer", **form_response
        )

    found_peer = None
    for item in example_data:
        if item["distinguished_name"] == peer_dn:
            found_peer = item
            break

    if found_peer is None:
        return create_handler_response(
            404, error="Failed to find the specified Peer"
        )

    found_peer.update(payload)
    return create_handler_response(200, **found_peer)


def migux_apps_peers__POST_accepted_send_invitation():
    """
    Request handler: POST /peers/accepted/send_invitation
    """

    payload = request.json
    peer_dns_to_invite = set(payload.get("peers", []))
    if not peer_dns_to_invite:
        return create_handler_response(
            422, error="No peers selected for invitation"
        )

    accepted_distinguished_names = [
        peer["distinguished_name"] for peer in EXAMPLE_DATA["GET /accepted"]
    ]

    peer_invitations = {}
    for peer_dn in peer_dns_to_invite:
        if peer_dn in accepted_distinguished_names:
            peer_invitations[peer_dn] = True
        else:
            peer_invitations[peer_dn] = False

    return create_handler_response(200, peer_invitations=peer_invitations)


def migux_apps_peers__POST_requested_accept():
    """
    Request handler: GET /peers/requested/accept
    """

    payload = request.json

    all_requested = EXAMPLE_DATA["GET /requested"]
    peer_dns_for_accept = set(payload["peers"])

    requested_dicts = [
        d
        for d in all_requested
        if d["distinguished_name"] not in peer_dns_for_accept
    ]
    accepted_dicts = [
        d
        for d in all_requested
        if d["distinguished_name"] in peer_dns_for_accept
    ]

    EXAMPLE_DATA["GET /requested"] = requested_dicts

    all_accepted = EXAMPLE_DATA["GET /accepted"]
    EXAMPLE_DATA["GET /accepted"] = all_accepted + accepted_dicts
    return create_handler_response(200)


def migux_apps_peers__POST_requested_delete():
    """
    Request handler: POST /peers/requested/delete
    """

    payload = request.json

    example_data = EXAMPLE_DATA["GET /requested"]
    peer_dns_for_removal = set(payload["peers"])

    filtered_example_data = [
        item
        for item in example_data
        if item["distinguished_name"] not in peer_dns_for_removal
    ]
    EXAMPLE_DATA["GET /requested"] = filtered_example_data

    return create_handler_response(200)


def migux_apps_peers__POST_new():
    """
    Request handler: POST /peers/new
    """
    example_data = EXAMPLE_DATA["GET /accepted"]
    example_user_dict = EXAMPLE_DATA["GET /accepted"][0]

    payload = request.json
    should_simulate_error = payload["full_name"] == "ERROR"

    form_response = _create_form_response(
        payload, simulate_error=should_simulate_error
    )
    if should_simulate_error:
        return create_handler_response(
            404, error="Failed to create a new Peer", **form_response
        )

    # simulate a valid user payload by only allowing values
    # for keys that we expect to be present in a user entry
    user_dict = {
        key: value for key, value in payload.items() if key in example_user_dict
    }
    user_dict.update({"distinguished_name": _fill_distinguished_name(payload)})
    example_data.append(user_dict)

    return create_handler_response(
        200, message="Created a new Peer", **form_response
    )


ROUTES = {
    "POST /new": migux_apps_peers__POST_new,
    "GET /summary": migux_apps_peers__GET_summary,
    "POST /send_invitation": migux_apps_peers__POST_accepted_send_invitation,
    "GET /requested": migux_apps_peers__GET_requested,
    "POST /requested/accept": migux_apps_peers__POST_requested_accept,
    "POST /requested/delete": migux_apps_peers__POST_requested_delete,
    "GET /accepted": migux_apps_peers__GET_accepted,
    "POST /accepted/delete": migux_apps_peers__POST_accepted_delete,
    "POST /accepted/fetch": migux_apps_peers__POST_accepted_fetch,
    "POST /accepted/import": migux_apps_peers__POST_accepted_import,
    "POST /accepted/update": migux_apps_peers__POST_accepted_update,
}


BLUEPRINT = server_common.routes_to_blueprint(
    "peers",
    __name__,
    ROUTES,
    template_folder=MIGUX_APPS_PEERS_TEMPLATE_FOLDER,
)
