"""
Development facing implementation of a admin API.
"""

from collections import defaultdict
from types import SimpleNamespace
from typing import Any

from flask import Blueprint, request

import devserver.common as server_common
from devserver.common import (
    create_handler_response,
    extract_csrf_tokens_from_request,
    make_csrf_token,
    unconcatify,
    validate_csrf_token,
)
from migux.apps.accountreqs import TEMPLATE_FOLDER, TEMPLATE_ROUTES

EXAMPLE_DATA = {
    "GET /": server_common.import_example_data(
        "accountreqs/account_requests.json"
    ),
}


blueprint = Blueprint("accountreqs", __name__, template_folder=TEMPLATE_FOLDER)


def _accountreqs_of_state(state: str) -> list[dict[str, Any]]:
    """Filters the example data for account requests of a given state."""
    return [
        entry
        for entry in EXAMPLE_DATA["GET /"]
        if entry["account_request_state"] == state
    ]


@blueprint.get("/summary")
def summary():
    """
    Request handler: GET /summary
    """

    return {
        "total": len(EXAMPLE_DATA["GET /"]),
        "invalid_peer_contact": len(
            _accountreqs_of_state("invalid_peer_contact")
        ),
        "requested": len(_accountreqs_of_state("requested")),
        "pending": len(_accountreqs_of_state("pending")),
        "accepted": len(_accountreqs_of_state("accepted")),
    }


@blueprint.get("/csrf_tokens")
def csrf_tokens():
    """
    Request handler: GET /csrf_tokens
    """
    template_route = TEMPLATE_ROUTES["GET /csrf_tokens"]
    req_csrf_tokens = extract_csrf_tokens_from_request(request)

    request_info = SimpleNamespace()
    # Generate tokens based on the operation requested
    return server_common.render_app_template(
        template_route, request_info=request_info, data=req_csrf_tokens
    )


@blueprint.get("")
@blueprint.get("/")
def account_requests():
    """
    Request handler: GET /
    """

    template_route = TEMPLATE_ROUTES["GET /"]
    request_info = SimpleNamespace(
        args={
            "query": request.values.get("query"),
            "state": request.values.get("state"),
            "fields": unconcatify(request.values.get("fields", ""), ","),
        },
    )

    query = request.values.get("query", "").lower()
    example_data = EXAMPLE_DATA["GET /"]
    if state := request.values.get("state"):
        example_data = _accountreqs_of_state(state)

    def matches_query(entry) -> bool:
        return any(query in str(val).lower() for val in entry.values())

    example_data = filter(matches_query, example_data)

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )


@blueprint.post("/reject")
def reject():
    """
    Request handler: POST /accountreqs/reject
    """
    payload = request.json
    expected_token = make_csrf_token("POST", "/accountreqs/reject")

    is_valid, error = validate_csrf_token(payload, expected_token)
    if not is_valid:
        return create_handler_response(403, error=error)

    accreq_ids_to_reject = payload.get("account_request_ids", [])
    if not accreq_ids_to_reject:
        return create_handler_response(
            422, error="No account requests selected for rejecting"
        )

    errors: dict[str, list[str]] = defaultdict(list)
    successes: list[str] = []
    for accreq_id in accreq_ids_to_reject:
        accreq = next(
            (
                entry
                for entry in EXAMPLE_DATA["GET /"]
                if entry["account_request_id"] == accreq_id
            ),
            None,
        )
        if accreq is None:
            errors[accreq_id].append("account request not found")
            continue

        successes.append(accreq_id)

    # remove from exampel data
    EXAMPLE_DATA["GET /"] = [
        entry
        for entry in EXAMPLE_DATA["GET /"]
        if entry["account_request_id"] not in successes
    ]

    return create_handler_response(
        400 if errors else 200,
        data={"successes": successes, "errors": errors},
    )


@blueprint.post("/forward")
def forward():
    """
    Request handler: POST /accountreqs/forward
    """
    payload = request.json
    expected_token = make_csrf_token("POST", "/accountreqs/forward")

    is_valid, error = validate_csrf_token(payload, expected_token)
    if not is_valid:
        return create_handler_response(403, error=error)

    accreq_ids_to_forward = payload.get("account_request_ids", [])
    if not accreq_ids_to_forward:
        return create_handler_response(
            422, error="No account requests selected for forwarding"
        )

    errors: dict[str, list[str]] = defaultdict(list)
    successes: list[str] = []
    for accreq_id in accreq_ids_to_forward:
        accreq = next(
            (
                entry
                for entry in EXAMPLE_DATA["GET /"]
                if entry["account_request_id"] == accreq_id
            ),
            None,
        )
        if accreq is None:
            errors[accreq_id].append("account request not found")
            continue

        if accreq["account_request_state"] != "requested":
            errors[accreq_id].append(
                "account request is in state {!r}, only 'requested' "
                "account requests can be forwarded".format(
                    accreq["account_request_state"]
                )
            )
            continue

        accreq["account_request_state"] = "pending"
        successes.append(accreq_id)

    return create_handler_response(
        400 if errors else 200,
        data={"forwarded": successes, "errors": errors},
    )


@blueprint.post("/create_user")
def create_user():
    """
    Request handler: POST /accountreqs/create_user
    """
    payload = request.json
    expected_token = make_csrf_token("POST", "/accountreqs/create_user")

    is_valid, error = validate_csrf_token(payload, expected_token)
    if not is_valid:
        return create_handler_response(403, error=error)

    accreq_ids = payload.get("account_request_ids", [])
    if not accreq_ids:
        return create_handler_response(
            422, error="No account requests selected for user creation"
        )

    errors: dict[str, list[str]] = defaultdict(list)
    successes: list[str] = []
    for accreq_id in accreq_ids:
        accreq = next(
            (
                entry
                for entry in EXAMPLE_DATA["GET /"]
                if entry["account_request_id"] == accreq_id
            ),
            None,
        )
        if accreq is None:
            errors[accreq_id].append("account request not found")
            continue

        if accreq["account_request_state"] != "accepted":
            errors[accreq_id].append(
                "account request is in state {!r}, only 'accepted' "
                "account requests can be forwarded".format(
                    accreq["account_request_state"]
                )
            )
            continue

        successes.append(accreq_id)

    # remove account request for created user
    EXAMPLE_DATA["GET /"] = [
        accreq
        for accreq in EXAMPLE_DATA["GET /"]
        if accreq["account_request_id"] not in successes
    ]

    return create_handler_response(
        400 if errors else 200,
        data={"forwarded": successes, "errors": errors},
    )
