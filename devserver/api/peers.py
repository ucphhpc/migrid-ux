"""
Development facing implementation of a peers API.
"""

import os
from types import SimpleNamespace

from flask import request

import migux.apps.peers as migux_apps_peers
import devserver.common as server_common

EXAMPLE_DATA = {
    "GET /accepted": server_common.import_example_data(
        "peers/accepted.json"
    ),
    "GET /requested": server_common.import_example_data(
        "peers/requested.json"
    ),
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


def migux_apps_peers__GET_summary():
    """
    Request handler: GET /peers/summary
    """

    return [
        {
            "object_type": "objects",
            "objects": {
                "status": 200,
                "error": None,
                "data": {
                    "accepted_count": len(EXAMPLE_DATA["GET /accepted"]),
                    "requested_count": len(EXAMPLE_DATA["GET /requested"]),
                },
            },
        }
    ]


def migux_apps_peers__GET_accepted():
    """
    Request handler: GET /peers/accepted
    """

    template_route = migux_apps_peers.TEMPLATE_ROUTES["GET /accepted"]
    request_info = SimpleNamespace(
        args={
            "query": request.values.get("query"),
            "fields": _unconcatify(request.values.get("fields", ""), ","),
        }
    )
    example_data = EXAMPLE_DATA["GET /accepted"]

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

    example_data = EXAMPLE_DATA["GET /accepted"]
    for peer_dn in payload["peers"]:
        filtered_example_data = [
            item
            for item in example_data
            if item["distinguished_name"] != peer_dn
        ]
        EXAMPLE_DATA["GET /accepted"] = filtered_example_data

    return [
        {"object_type": "objects", "objects": {"status": 200, "error": None}}
    ]


def migux_apps_peers__POST_accepted_import():
    """
    Request handler: GET /peers/accepted/import
    """

    payload = request.json

    input_label = payload.get("label", "")
    if input_label == "ERROR":
        errors_map = {
            "csvtext": payload.get("csvtext", ""),
            "expire": payload.get("expire", ""),
            "kind": payload.get("kind", ""),
            "label": payload.get("label", ""),
        }

        return [
            {
                "object_type": "objects",
                "objects": {
                    "status": 400,
                    "error": "unable to save the form",
                    "data": {
                        "errors_map": errors_map,
                    },
                },
            }
        ]

    return [
        {
            "object_type": "objects",
            "objects": {
                "status": 200,
                "error": None,
            },
        }
    ]


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
        return [
            {
                "object_type": "objects",
                "objects": {
                    "status": 404,
                    "error": "no such peer",
                    "data": {},
                },
            }
        ]

    return [
        {
            "object_type": "objects",
            "objects": {"status": 200, "error": None, "data": found_peer},
        }
    ]


def migux_apps_peers__POST_accepted_update():
    """
    Request handler: POST /peers/accepted/update
    """

    payload = request.json
    peer_dn = payload.pop("peer_dn", None)

    example_data = EXAMPLE_DATA["GET /accepted"]

    found_peer = None
    for item in example_data:
        if item["distinguished_name"] == peer_dn:
            found_peer = item
            break

    if found_peer is None:
        return [
            {
                "object_type": "objects",
                "objects": {
                    "status": 404,
                    "error": "no such peer",
                    "data": {},
                },
            }
        ]

    found_peer.update(payload)

    return [
        {
            "object_type": "objects",
            "objects": {"status": 200, "error": None, "data": found_peer},
        }
    ]


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

    return [
        {"object_type": "objects", "objects": {"status": 200, "error": None}}
    ]


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

    return [
        {"object_type": "objects", "objects": {"status": 200, "error": None}}
    ]


def migux_apps_peers__POST_new():
    """
    Request handler: POST /peers/new
    """

    example_data = EXAMPLE_DATA["GET /requested"]
    example_user_dict = EXAMPLE_DATA["GET /accepted"][0]

    payload = request.json
    should_simulate_error = payload["full_name"] == "ERROR"

    success_map = {
        "0": not should_simulate_error,
    }
    errors_map = {}

    if should_simulate_error:
        simulated_errors = {
            key: "%s error occcurred" % (key,)
            for key in payload.keys()
            if key != "full_name"
        }
        errors_map = {"0": simulated_errors}

        return [
            {
                "object_type": "objects",
                "objects": {
                    "status": 400,
                    "error": "unable to save the form",
                    "data": {
                        "success_map": success_map,
                        "errors_map": errors_map,
                    },
                },
            }
        ]

    # simulate a valid user payload by only allowing values
    # for keys that we expect to be present in a user entry
    user_dict = {
        key: value for key, value in payload.items() if key in example_user_dict
    }
    user_dict.update({"distinguished_name": _fill_distinguished_name(payload)})

    example_data.append(user_dict)

    return [
        {
            "object_type": "objects",
            "objects": {
                "status": 200,
                "data": {
                    "success_map": success_map,
                    "errors_map": errors_map,
                },
            },
        }
    ]


ROUTES = {
    "GET /summary": migux_apps_peers__GET_summary,
    "GET /requested": migux_apps_peers__GET_requested,
    "POST /requested/accept": migux_apps_peers__POST_requested_accept,
    "POST /requested/delete": migux_apps_peers__POST_requested_delete,
    "GET /accepted": migux_apps_peers__GET_accepted,
    "POST /accepted/delete": migux_apps_peers__POST_accepted_delete,
    "POST /accepted/fetch": migux_apps_peers__POST_accepted_fetch,
    "POST /accepted/import": migux_apps_peers__POST_accepted_import,
    "POST /accepted/update": migux_apps_peers__POST_accepted_update,
    "POST /new": migux_apps_peers__POST_new,
}


BLUEPRINT = server_common.routes_to_blueprint(
    "peers",
    __name__,
    ROUTES,
    template_folder=MIGUX_APPS_PEERS_TEMPLATE_FOLDER,
)
